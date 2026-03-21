import { Router } from 'express'
import { getDb, saveDb } from '../db'
import { authMiddleware, type AuthRequest } from '../middleware/auth'
import { errorCategories } from '../core/errors/errorCodes'
import { logServerError } from '../core/errors/errorLogger'
import { buildRuntimeContext, parseWorldbookIds } from '../modules/runtime/assembler'
import { applyRegexRules, loadRegexRules } from '../modules/runtime/regexPipeline'
import {
  callLLMStream,
  maskApiKey,
  runOpenAICompatibleChatWithFallback,
  truncateForLog,
  type LLMConfig,
  type LLMMessage,
  type Provider,
} from '../services/llm'

const router = Router()

router.use(authMiddleware)

type SessionRow = {
  id: number
  user_id: number | null
  character_id: number | null
  title: string | null
  status: string | null
  preset_id: number | null
  api_profile_id: number | null
  worldbook_ids: string | null
  regex_ruleset_id: number | null
  created_at: number
  updated_at: number
}

type ChatMessageRow = {
  id: number
  chat_session_id: number
  role: string
  content: string
  content_format: string | null
  metadata: string | null
  status: string | null
  created_at: number
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value
  if (value == null) return ''
  return String(value)
}

function safeParseJsonObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'string' || !value.trim()) return {}
  try {
    const parsed = JSON.parse(value)
    return asObject(parsed) ?? {}
  } catch {
    return {}
  }
}

function mapSessionFromRow(row: SessionRow) {
  return {
    id: row.id,
    userId: row.user_id,
    characterId: row.character_id,
    title: row.title,
    status: row.status ?? 'active',
    presetId: row.preset_id,
    apiProfileId: row.api_profile_id,
    worldbookIds: parseWorldbookIds(row.worldbook_ids),
    regexRulesetId: row.regex_ruleset_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapMessageFromRow(row: ChatMessageRow) {
  return {
    id: row.id,
    chatSessionId: row.chat_session_id,
    role: row.role,
    content: row.content,
    contentFormat: row.content_format || 'text/plain',
    metadata: safeParseJsonObject(row.metadata),
    status: row.status || 'done',
    createdAt: row.created_at,
  }
}

async function getSessionById(sessionId: number) {
  const database = await getDb()
  const stmt = database.prepare(
    'SELECT id, user_id, character_id, title, status, preset_id, api_profile_id, worldbook_ids, regex_ruleset_id, created_at, updated_at FROM chat_sessions WHERE id = ? LIMIT 1'
  )
  stmt.bind([sessionId])

  let row: SessionRow | null = null
  if (stmt.step()) {
    row = stmt.getAsObject() as unknown as SessionRow
  }
  stmt.free()

  return row
}

function pickGreeting(characterData: Record<string, unknown>): string | null {
  const directFirstMessage = characterData.firstMessage
  if (typeof directFirstMessage === 'string' && directFirstMessage.trim()) {
    return directFirstMessage.trim()
  }

  const directFirstMes = characterData.first_mes
  if (typeof directFirstMes === 'string' && directFirstMes.trim()) {
    return directFirstMes.trim()
  }

  const nestedData = asObject(characterData.data)
  if (nestedData) {
    const nestedFirstMessage = nestedData.firstMessage
    if (typeof nestedFirstMessage === 'string' && nestedFirstMessage.trim()) {
      return nestedFirstMessage.trim()
    }

    const nestedFirstMes = nestedData.first_mes
    if (typeof nestedFirstMes === 'string' && nestedFirstMes.trim()) {
      return nestedFirstMes.trim()
    }
  }

  return null
}

async function insertChatMessage(options: {
  sessionId: number
  role: string
  content: string
  contentFormat?: string
  metadata?: Record<string, unknown>
  status?: string
  createdAt?: number
}) {
  const database = await getDb()
  const now = options.createdAt ?? Date.now()

  const stmt = database.prepare(
    'INSERT INTO chat_messages (chat_session_id, role, content, content_format, metadata, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
  stmt.run([
    options.sessionId,
    options.role,
    options.content,
    options.contentFormat ?? 'text/plain',
    JSON.stringify(options.metadata ?? {}),
    options.status ?? 'done',
    now,
  ])
  stmt.free()
}

async function touchSessionUpdatedAt(sessionId: number, now = Date.now()) {
  const database = await getDb()
  const stmt = database.prepare('UPDATE chat_sessions SET updated_at = ? WHERE id = ?')
  stmt.run([now, sessionId])
  stmt.free()
}

type ApiProfileRow = {
  id: number
  provider: string
  endpoint: string
  apiKey: string
  model: string
}

function parseProviderId(raw: string): Provider | null {
  const v = raw.trim()
  if (v === 'openai-compatible' || v === 'gemini' || v === 'claude' || v === 'ollama') {
    return v
  }
  return null
}

async function loadApiProfileForSession(session: SessionRow): Promise<ApiProfileRow | null> {
  const database = await getDb()

  const mapRow = (row: Record<string, unknown>): ApiProfileRow => ({
    id: Number(row.id),
    provider: String(row.provider || ''),
    endpoint: row.endpoint == null ? '' : String(row.endpoint).trim(),
    apiKey: row.api_key == null ? '' : String(row.api_key),
    model: row.model == null ? '' : String(row.model).trim(),
  })

  if (session.api_profile_id != null) {
    const stmt = database.prepare(
      'SELECT id, provider, endpoint, api_key, model FROM api_profiles WHERE id = ? LIMIT 1'
    )
    stmt.bind([session.api_profile_id])
    if (stmt.step()) {
      const row = stmt.getAsObject() as Record<string, unknown>
      stmt.free()
      return mapRow(row)
    }
    stmt.free()
  }

  const stmt = database.prepare(
    'SELECT id, provider, endpoint, api_key, model FROM api_profiles ORDER BY is_active DESC, created_at DESC LIMIT 1'
  )
  if (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>
    stmt.free()
    return mapRow(row)
  }
  stmt.free()
  return null
}

function defaultLLMParams(): LLMConfig['params'] {
  return {
    temperature: 0.7,
    maxTokens: 2048,
    topP: 0.9,
    topK: 40,
    frequencyPenalty: 0,
    presencePenalty: 0,
  }
}

type ChatStreamOutcome =
  | { ok: true; fullText: string; usedNonStreamFallback: boolean; streamChunksWithText?: number }
  | { ok: false; error: string }

async function runChatCompletionStreamed(
  config: LLMConfig,
  llmMessages: LLMMessage[],
  emitDelta: (text: string) => void
): Promise<ChatStreamOutcome> {
  if (config.provider === 'openai-compatible') {
    return runOpenAICompatibleChatWithFallback(config, llmMessages, emitDelta)
  }

  return await new Promise((resolve) => {
    let acc = ''
    let chunks = 0
    void callLLMStream({
      config,
      messages: llmMessages,
      onChunk: (t) => {
        acc += t
        if (t.length > 0) chunks += 1
        emitDelta(t)
      },
      onDone: () => {
        if (!acc.trim()) {
          resolve({ ok: false, error: '流式结束但未收到任何文本' })
        } else {
          resolve({ ok: true, fullText: acc, usedNonStreamFallback: false, streamChunksWithText: chunks })
        }
      },
      onError: (e) => resolve({ ok: false, error: e.message }),
    })
  })
}

async function injectGreetingIfNeeded(sessionId: number, characterId: number | null, now: number) {
  if (characterId == null) return

  const database = await getDb()

  const countStmt = database.prepare('SELECT COUNT(1) AS count FROM chat_messages WHERE chat_session_id = ?')
  countStmt.bind([sessionId])
  let messageCount = 0
  if (countStmt.step()) {
    const row = countStmt.getAsObject() as Record<string, unknown>
    messageCount = Number(row.count ?? 0)
  }
  countStmt.free()

  if (messageCount > 0) return

  const charStmt = database.prepare('SELECT data FROM characters WHERE id = ? LIMIT 1')
  charStmt.bind([characterId])
  let greeting: string | null = null
  if (charStmt.step()) {
    const row = charStmt.getAsObject() as Record<string, unknown>
    if (row.data) {
      try {
        const parsed = JSON.parse(String(row.data)) as Record<string, unknown>
        greeting = pickGreeting(parsed)
      } catch {
        greeting = null
      }
    }
  }
  charStmt.free()

  if (!greeting) return

  await insertChatMessage({
    sessionId,
    role: 'assistant',
    content: greeting,
    metadata: { source: 'greeting' },
    status: 'done',
    createdAt: now,
  })

  await touchSessionUpdatedAt(sessionId, now)
}

router.post('/sessions', async (req: AuthRequest, res) => {
  try {
    const { characterId, title, presetId, apiProfileId, worldbookIds, regexRulesetId } = req.body as {
      characterId?: number | null
      title?: string
      presetId?: number | null
      apiProfileId?: number | null
      worldbookIds?: number[]
      regexRulesetId?: number | null
    }

    const normalizedCharacterId = characterId == null ? null : Number(characterId)
    if (normalizedCharacterId != null && !Number.isFinite(normalizedCharacterId)) {
      await logServerError({
        userId: req.user?.userId,
        category: errorCategories.validation,
        message: 'Invalid characterId',
        details: { characterId },
      })
      return res.status(400).json({ error: 'Invalid characterId' })
    }

    const normalizedPresetId = presetId == null ? null : Number(presetId)
    if (normalizedPresetId != null && !Number.isFinite(normalizedPresetId)) {
      await logServerError({
        userId: req.user?.userId,
        category: errorCategories.validation,
        message: 'Invalid presetId',
        details: { presetId },
      })
      return res.status(400).json({ error: 'Invalid presetId' })
    }

    const normalizedApiProfileId = apiProfileId == null ? null : Number(apiProfileId)
    if (normalizedApiProfileId != null && !Number.isFinite(normalizedApiProfileId)) {
      await logServerError({
        userId: req.user?.userId,
        category: errorCategories.validation,
        message: 'Invalid apiProfileId',
        details: { apiProfileId },
      })
      return res.status(400).json({ error: 'Invalid apiProfileId' })
    }

    const normalizedRegexRulesetId = regexRulesetId == null ? null : Number(regexRulesetId)
    if (normalizedRegexRulesetId != null && !Number.isFinite(normalizedRegexRulesetId)) {
      await logServerError({
        userId: req.user?.userId,
        category: errorCategories.validation,
        message: 'Invalid regexRulesetId',
        details: { regexRulesetId },
      })
      return res.status(400).json({ error: 'Invalid regexRulesetId' })
    }

    const normalizedWorldbookIds = Array.isArray(worldbookIds)
      ? worldbookIds.map((id) => Number(id)).filter((id) => Number.isFinite(id))
      : []

    const database = await getDb()

    if (normalizedCharacterId != null) {
      const characterStmt = database.prepare('SELECT id FROM characters WHERE id = ? LIMIT 1')
      characterStmt.bind([normalizedCharacterId])
      const exists = characterStmt.step()
      characterStmt.free()
      if (!exists) {
        await logServerError({
          userId: req.user?.userId,
          category: errorCategories.validation,
          message: 'Character not found',
          details: { characterId: normalizedCharacterId },
        })
        return res.status(404).json({ error: 'Character not found' })
      }
    }

    const now = Date.now()
    const finalTitle = (typeof title === 'string' && title.trim()) || '新会话'

    const insertStmt = database.prepare(
      'INSERT INTO chat_sessions (user_id, character_id, title, status, preset_id, api_profile_id, worldbook_ids, regex_ruleset_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    insertStmt.run([
      req.user?.userId ?? null,
      normalizedCharacterId,
      finalTitle,
      'active',
      normalizedPresetId,
      normalizedApiProfileId,
      JSON.stringify(normalizedWorldbookIds),
      normalizedRegexRulesetId,
      now,
      now,
    ])
    insertStmt.free()

    const idRes = database.exec('SELECT last_insert_rowid() AS id')
    const id = Number(idRes?.[0]?.values?.[0]?.[0])

    await injectGreetingIfNeeded(id, normalizedCharacterId, now)

    saveDb()

    const created = await getSessionById(id)
    if (!created) {
      await logServerError({
        userId: req.user?.userId,
        category: errorCategories.internal,
        message: 'Failed to create session',
        details: { id },
      })
      return res.status(500).json({ error: 'Failed to create session' })
    }

    return res.status(201).json(mapSessionFromRow(created))
  } catch (e: any) {
    await logServerError({
      userId: req.user?.userId,
      category: errorCategories.internal,
      message: '创建会话失败',
      details: { error: e?.message ?? String(e) },
    })
    return res.status(500).json({ error: e?.message ?? 'Failed to create session' })
  }
})

router.post('/sessions/by-character/:characterId/open', async (req: AuthRequest, res) => {
  try {
    const characterId = Number(req.params.characterId)
    if (!Number.isFinite(characterId)) {
      await logServerError({
        userId: req.user?.userId,
        category: errorCategories.validation,
        message: 'Invalid characterId',
        details: { characterId: req.params.characterId },
      })
      return res.status(400).json({ error: 'Invalid characterId' })
    }

    const database = await getDb()

    const characterStmt = database.prepare('SELECT id, name FROM characters WHERE id = ? LIMIT 1')
    characterStmt.bind([characterId])
    let characterName = '对话'
    if (characterStmt.step()) {
      const character = characterStmt.getAsObject() as Record<string, unknown>
      characterName = String(character.name || '对话')
    } else {
      characterStmt.free()
      await logServerError({
        userId: req.user?.userId,
        category: errorCategories.validation,
        message: 'Character not found',
        details: { characterId },
      })
      return res.status(404).json({ error: 'Character not found' })
    }
    characterStmt.free()

    const findStmt = database.prepare(
      'SELECT id, user_id, character_id, title, status, preset_id, api_profile_id, worldbook_ids, regex_ruleset_id, created_at, updated_at FROM chat_sessions WHERE character_id = ? ORDER BY updated_at DESC LIMIT 1'
    )
    findStmt.bind([characterId])

    let found: SessionRow | null = null
    if (findStmt.step()) {
      found = findStmt.getAsObject() as unknown as SessionRow
    }
    findStmt.free()

    if (found) {
      return res.json({
        ...mapSessionFromRow(found),
        reused: true,
      })
    }

    const now = Date.now()
    const insertStmt = database.prepare(
      'INSERT INTO chat_sessions (user_id, character_id, title, status, preset_id, api_profile_id, worldbook_ids, regex_ruleset_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    insertStmt.run([
      req.user?.userId ?? null,
      characterId,
      `${characterName} 的会话`,
      'active',
      null,
      null,
      JSON.stringify([]),
      null,
      now,
      now,
    ])
    insertStmt.free()

    const idRes = database.exec('SELECT last_insert_rowid() AS id')
    const id = Number(idRes?.[0]?.values?.[0]?.[0])

    await injectGreetingIfNeeded(id, characterId, now)

    saveDb()

    const created = await getSessionById(id)
    if (!created) {
      await logServerError({
        userId: req.user?.userId,
        category: errorCategories.internal,
        message: 'Failed to create session by character',
        details: { characterId },
      })
      return res.status(500).json({ error: 'Failed to create session' })
    }

    return res.status(201).json({
      ...mapSessionFromRow(created),
      reused: false,
    })
  } catch (e: any) {
    await logServerError({
      userId: req.user?.userId,
      category: errorCategories.internal,
      message: '按角色打开会话失败',
      details: { error: e?.message ?? String(e) },
    })
    return res.status(500).json({ error: e?.message ?? 'Failed to open session by character' })
  }
})

router.get('/sessions', async (_req: AuthRequest, res) => {
  try {
    const database = await getDb()
    const stmt = database.prepare(
      'SELECT id, user_id, character_id, title, status, preset_id, api_profile_id, worldbook_ids, regex_ruleset_id, created_at, updated_at FROM chat_sessions ORDER BY updated_at DESC'
    )

    const sessions: ReturnType<typeof mapSessionFromRow>[] = []

    while (stmt.step()) {
      const row = stmt.getAsObject() as unknown as SessionRow
      sessions.push(mapSessionFromRow(row))
    }
    stmt.free()

    return res.json(sessions)
  } catch (e: any) {
    await logServerError({
      userId: _req.user?.userId,
      category: errorCategories.internal,
      message: '获取会话列表失败',
      details: { error: e?.message ?? String(e) },
    })
    return res.status(500).json({ error: e?.message ?? 'Failed to fetch sessions' })
  }
})

router.get('/sessions/recent', async (req: AuthRequest, res) => {
  try {
    const limitRaw = Number(req.query.limit)
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 10

    const database = await getDb()
    const stmt = database.prepare(
      'SELECT id, user_id, character_id, title, status, preset_id, api_profile_id, worldbook_ids, regex_ruleset_id, created_at, updated_at FROM chat_sessions ORDER BY updated_at DESC LIMIT ?'
    )
    stmt.bind([limit])

    const sessions: ReturnType<typeof mapSessionFromRow>[] = []
    while (stmt.step()) {
      const row = stmt.getAsObject() as unknown as SessionRow
      sessions.push(mapSessionFromRow(row))
    }
    stmt.free()

    return res.json({
      items: sessions,
      limit,
    })
  } catch (e: any) {
    await logServerError({
      userId: req.user?.userId,
      category: errorCategories.internal,
      message: '查询最近会话失败',
      details: { error: e?.message ?? String(e) },
    })
    return res.status(500).json({ error: e?.message ?? 'Failed to fetch recent sessions' })
  }
})

router.get('/sessions/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) {
      await logServerError({
        userId: req.user?.userId,
        category: errorCategories.validation,
        message: 'Invalid session id',
        details: { id: req.params.id },
      })
      return res.status(400).json({ error: 'Invalid id' })
    }

    const row = await getSessionById(id)
    if (!row) {
      return res.status(404).json({ error: 'Session not found' })
    }

    return res.json(mapSessionFromRow(row))
  } catch (e: any) {
    await logServerError({
      userId: req.user?.userId,
      category: errorCategories.internal,
      message: '获取会话详情失败',
      details: { error: e?.message ?? String(e) },
    })
    return res.status(500).json({ error: e?.message ?? 'Failed to fetch session detail' })
  }
})

router.get('/sessions/:id/messages', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) {
      await logServerError({
        userId: req.user?.userId,
        category: errorCategories.validation,
        message: 'Invalid session id when fetching messages',
        details: { id: req.params.id },
      })
      return res.status(400).json({ error: 'Invalid id' })
    }

    const session = await getSessionById(id)
    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }

    const database = await getDb()
    const stmt = database.prepare(
      'SELECT id, chat_session_id, role, content, content_format, metadata, status, created_at FROM chat_messages WHERE chat_session_id = ? ORDER BY created_at ASC'
    )
    stmt.bind([id])

    const messages: Array<ReturnType<typeof mapMessageFromRow>> = []

    while (stmt.step()) {
      const row = stmt.getAsObject() as unknown as ChatMessageRow
      messages.push(mapMessageFromRow(row))
    }
    stmt.free()

    return res.json(messages)
  } catch (e: any) {
    await logServerError({
      userId: req.user?.userId,
      category: errorCategories.internal,
      message: '获取消息失败',
      details: { error: e?.message ?? String(e) },
    })
    return res.status(500).json({ error: e?.message ?? 'Failed to fetch messages' })
  }
})

router.post('/sessions/:id/messages', async (req: AuthRequest, res) => {
  try {
    const sessionId = Number(req.params.id)
    if (!Number.isFinite(sessionId)) {
      await logServerError({
        userId: req.user?.userId,
        category: errorCategories.validation,
        message: 'Invalid session id when appending message',
        details: { id: req.params.id },
      })
      return res.status(400).json({ error: 'Invalid session id' })
    }

    const session = await getSessionById(sessionId)
    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }

    const { role, content, contentFormat, metadata, status } = req.body as {
      role?: string
      content?: string
      contentFormat?: string
      metadata?: unknown
      status?: string
    }

    const roleValue = asString(role).trim()
    if (!['user', 'assistant', 'system'].includes(roleValue)) {
      await logServerError({
        userId: req.user?.userId,
        category: errorCategories.validation,
        message: 'Invalid role',
        details: { role },
      })
      return res.status(400).json({ error: 'Invalid role' })
    }

    const contentValue = asString(content)
    if (!contentValue.trim()) {
      await logServerError({
        userId: req.user?.userId,
        category: errorCategories.validation,
        message: 'Content is required',
      })
      return res.status(400).json({ error: 'Content is required' })
    }

    const now = Date.now()
    const meta =
      metadata && typeof metadata === 'object' && !Array.isArray(metadata)
        ? (metadata as Record<string, unknown>)
        : {}

    await insertChatMessage({
      sessionId,
      role: roleValue,
      content: contentValue,
      contentFormat: asString(contentFormat || 'text/plain') || 'text/plain',
      metadata: meta,
      status: asString(status || 'done') || 'done',
      createdAt: now,
    })

    await touchSessionUpdatedAt(sessionId, now)
    saveDb()

    const database = await getDb()
    const stmt = database.prepare(
      'SELECT id, chat_session_id, role, content, content_format, metadata, status, created_at FROM chat_messages WHERE chat_session_id = ? ORDER BY id DESC LIMIT 1'
    )
    stmt.bind([sessionId])
    if (!stmt.step()) {
      stmt.free()
      return res.status(500).json({ error: 'Failed to append message' })
    }

    const inserted = stmt.getAsObject() as unknown as ChatMessageRow
    stmt.free()

    return res.status(201).json(mapMessageFromRow(inserted))
  } catch (e: any) {
    await logServerError({
      userId: req.user?.userId,
      category: errorCategories.internal,
      message: '追加消息失败',
      details: { error: e?.message ?? String(e) },
    })
    return res.status(500).json({ error: e?.message ?? 'Failed to append message' })
  }
})

router.post('/sessions/:id/messages/stream', async (req: AuthRequest, res) => {
  const sessionId = Number(req.params.id)
  console.log('[chat/stream] route entered', {
    sessionId: Number.isFinite(sessionId) ? sessionId : req.params.id,
    hasBodyContent: typeof req.body?.content === 'string' && req.body.content.trim().length > 0,
  })
  if (!Number.isFinite(sessionId)) {
    await logServerError({
      userId: req.user?.userId,
      category: errorCategories.validation,
      message: 'Invalid session id when streaming',
      details: { id: req.params.id },
    })
    return res.status(400).json({ error: 'Invalid session id' })
  }

  const { content } = req.body as { content?: string }

  if (!content || typeof content !== 'string' || !content.trim()) {
    await logServerError({
      userId: req.user?.userId,
      category: errorCategories.validation,
      message: 'Content is required',
    })
    return res.status(400).json({ error: 'Content is required' })
  }

  const session = await getSessionById(sessionId)
  if (!session) {
    return res.status(404).json({ error: 'Session not found' })
  }

  const rules = await loadRegexRules(session.regex_ruleset_id)

  const inputProcessed = applyRegexRules({
    text: content,
    rules,
    placement: 'input',
  })

  // 先校验 API（避免用户消息已落库却返回 400）；真实回复仅来自下游 LLM，无占位 assistant
  const apiProfile = await loadApiProfileForSession(session)

  if (!apiProfile || !apiProfile.endpoint) {
    await logServerError({
      userId: req.user?.userId,
      category: errorCategories.validation,
      message: 'Chat stream: missing API profile or base URL',
      details: { sessionId },
    })
    return res.status(400).json({ error: '未配置 API（请在设置中填写 Base URL 与模型）' })
  }

  if (!apiProfile.model) {
    await logServerError({
      userId: req.user?.userId,
      category: errorCategories.validation,
      message: 'Chat stream: missing model',
      details: { sessionId },
    })
    return res.status(400).json({ error: '未配置默认模型' })
  }

  const provider = parseProviderId(apiProfile.provider)
  if (!provider) {
    return res.status(400).json({
      error: `不支持的 provider「${apiProfile.provider}」，请使用 openai-compatible / gemini / claude / ollama`,
    })
  }

  const userNow = Date.now()
  await insertChatMessage({
    sessionId,
    role: 'user',
    content: inputProcessed.text,
    contentFormat: 'text/plain',
    metadata: {
      source: 'stream',
      originalContent: content,
      regexInputApplied: inputProcessed.appliedRules,
    },
    status: 'done',
    createdAt: userNow,
  })
  saveDb()

  const runtime = await buildRuntimeContext(session)

  const presetParams = runtime.presetInfo.normalizedPreset?.params
  const baseParams = defaultLLMParams()
  const llmConfig: LLMConfig = {
    provider,
    endpoint: apiProfile.endpoint.replace(/\/+$/, ''),
    apiKey: apiProfile.apiKey.trim() || undefined,
    model: apiProfile.model,
    params: presetParams
      ? {
          temperature: presetParams.temperature,
          maxTokens: presetParams.maxTokens,
          topP: presetParams.topP,
          topK: presetParams.topK,
          frequencyPenalty: presetParams.frequencyPenalty,
          presencePenalty: presetParams.presencePenalty,
        }
      : baseParams,
  }

  const systemPrompt =
    runtime.promptText.trim() ||
    'You are a helpful assistant. Follow the user messages and reply naturally.'

  const llmMessages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: inputProcessed.text },
  ]

  const sseHeadersSent = { value: false as boolean }

  try {
    let baseUrlHost = '(invalid-host)'
    try {
      baseUrlHost = new URL(llmConfig.endpoint).host || '(invalid-host)'
    } catch {
      baseUrlHost = '(invalid-host)'
    }

    console.log('[chat/stream] begin', {
      sessionId,
      provider: llmConfig.provider,
      model: llmConfig.model,
      baseUrlHost,
      apiKey: maskApiKey(llmConfig.apiKey),
      mode: 'stream',
      systemChars: systemPrompt.length,
      llmMessageCount: llmMessages.length,
    })

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders()
    sseHeadersSent.value = true

    console.log('[chat/stream] sse headers sent', {
      sessionId,
      contentType: 'text/event-stream; charset=utf-8',
    })

    res.write(`data: ${JSON.stringify({ type: 'start' })}\n\n`)

    const completion = await runChatCompletionStreamed(llmConfig, llmMessages, (delta) => {
      if (delta) {
        console.log('[chat/stream] chunk emitted', {
          sessionId,
          deltaLength: delta.length,
        })
      }
      res.write(`data: ${JSON.stringify({ type: 'chunk', text: delta })}\n\n`)
    })

    if (!completion.ok) {
      console.warn('[chat/stream] LLM failed', {
        sessionId,
        provider: llmConfig.provider,
        model: llmConfig.model,
        baseUrlHost,
        parsedTextLength: 0,
        error: truncateForLog(completion.error, 400),
      })
      await logServerError({
        userId: req.user?.userId,
        category: errorCategories.chat_runtime,
        message: 'LLM 流式/补全失败',
        details: { sessionId, error: completion.error },
      })
      const isEmptyText = completion.error.includes('模型返回成功但内容为空')
      const msg = isEmptyText ? '模型返回成功但内容为空，请检查模型/接口兼容性' : completion.error
      res.write(`data: ${JSON.stringify({ type: 'error', message: msg })}\n\n`)
      res.end()
      return
    }

    if (!completion.fullText.trim()) {
      const msg = '模型返回成功但内容为空，请检查模型/接口兼容性'
      await logServerError({
        userId: req.user?.userId,
        category: errorCategories.chat_runtime,
        message: msg,
        details: { sessionId },
      })
      res.write(`data: ${JSON.stringify({ type: 'error', message: msg })}\n\n`)
      res.end()
      return
    }

    console.log('[chat/stream] success', {
      sessionId,
      model: llmConfig.model,
      baseUrlHost,
      parsedTextLength: completion.fullText.length,
      nonStreamFallback: completion.usedNonStreamFallback,
      streamChunksWithText: completion.streamChunksWithText,
    })

    const outputProcessed = applyRegexRules({
      text: completion.fullText,
      rules,
      placement: 'output',
    })

    const assistantNow = Date.now()
    await insertChatMessage({
      sessionId,
      role: 'assistant',
      content: outputProcessed.text,
      contentFormat: 'text/plain',
      metadata: {
        source: 'llm',
        regexOutputApplied: outputProcessed.appliedRules,
        usedNonStreamFallback: completion.usedNonStreamFallback,
        runtimeSummary: {
          presetSource: runtime.presetInfo.source,
          promptBlockCount: runtime.presetInfo.promptCount,
          promptLength: runtime.promptText.length,
          worldbook: runtime.worldbookInfo,
          character: runtime.characterInfo,
        },
      },
      status: 'done',
      createdAt: assistantNow,
    })

    await touchSessionUpdatedAt(sessionId, assistantNow)
    saveDb()

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
    res.end()
  } catch (e: any) {
    console.error('[chat/stream] route exception', {
      sessionId,
      error: e?.message ?? String(e),
    })
    await logServerError({
      userId: req.user?.userId,
      category: errorCategories.chat_runtime,
      message: '流式消息失败',
      details: { error: e?.message ?? String(e) },
    })
    const msg = e?.message ?? 'Failed'
    if (sseHeadersSent.value) {
      try {
        res.write(`data: ${JSON.stringify({ type: 'error', message: msg })}\n\n`)
        res.end()
      } catch {
        /* ignore */
      }
    } else {
      return res.status(500).json({ error: msg })
    }
  }
})

router.delete('/sessions/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'Invalid id' })
    }

    const session = await getSessionById(id)
    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }

    const database = await getDb()

    const deleteMsgStmt = database.prepare('DELETE FROM chat_messages WHERE chat_session_id = ?')
    deleteMsgStmt.run([id])
    deleteMsgStmt.free()

    const deleteSessionStmt = database.prepare('DELETE FROM chat_sessions WHERE id = ?')
    deleteSessionStmt.run([id])
    deleteSessionStmt.free()

    saveDb()

    return res.status(204).send()
  } catch (e: any) {
    await logServerError({
      userId: req.user?.userId,
      category: errorCategories.internal,
      message: '删除会话失败',
      details: { error: e?.message ?? String(e) },
    })
    return res.status(500).json({ error: e?.message ?? 'Failed to delete session' })
  }
})

export default router
