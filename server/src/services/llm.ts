export type Provider = 'openai-compatible' | 'gemini' | 'claude' | 'ollama'

export function maskApiKey(key: string | undefined): string {
  if (!key) return '(none)'
  const t = key.trim()
  if (t.length <= 6) return '***'
  return `${t.slice(0, 3)}...${t.slice(-3)}`
}

function endpointHost(endpoint: string): string {
  try {
    return new URL(endpoint).host || '(invalid-host)'
  } catch {
    return '(invalid-host)'
  }
}

function normalizeEndpoint(endpoint: string): string {
  return endpoint.trim().replace(/\/+$/, '')
}

/** 拼接 /chat/completions，避免 base 末尾与 path 产生 // */
function openAIChatCompletionsUrl(base: string): string {
  const b = normalizeEndpoint(base)
  return `${b}/chat/completions`
}

export function truncateForLog(s: string, max = 280): string {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length <= max ? t : `${t.slice(0, max)}…`
}

/** OpenAI chat.completions 中 content 可能是 string 或 parts 数组（多模态/部分网关） */
function normalizeOpenAIContentPiece(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((part) => {
      if (typeof part === 'string') return part
      if (part && typeof part === 'object') {
        const p = part as Record<string, unknown>
        if (p.type === 'text' && typeof p.text === 'string') return p.text
        if (typeof p.content === 'string') return p.content
      }
      return ''
    })
    .join('')
}

function getTopLevelKeys(parsed: unknown): string[] {
  if (!parsed || typeof parsed !== 'object') return []
  return Object.keys(parsed as Record<string, unknown>)
}

function getFinishReason(choices: unknown[]): string {
  for (const choice of choices) {
    if (!choice || typeof choice !== 'object') continue
    const reason = (choice as Record<string, unknown>).finish_reason
    if (typeof reason === 'string' && reason.trim()) return reason
  }
  return 'n/a'
}

function getFirstMessageContent(choices: unknown[]): unknown {
  const firstChoice = choices[0]
  if (!firstChoice || typeof firstChoice !== 'object') return undefined
  const message = (firstChoice as Record<string, unknown>).message
  if (!message || typeof message !== 'object') return undefined
  return (message as Record<string, unknown>).content
}

export class OpenAICompatibleEmptyTextError extends Error {
  diagnostics: {
    model: string
    topLevelKeys: string[]
    choicesLength: number
    finishReason: string
    hasMessage: boolean
    hasContent: boolean
    contentType: string
    bodyPreview: string
    status?: number
  }

  constructor(diagnostics: OpenAICompatibleEmptyTextError['diagnostics']) {
    super('模型返回成功但内容为空，请检查模型/接口兼容性')
    this.name = 'OpenAICompatibleEmptyTextError'
    this.diagnostics = diagnostics
  }
}

export function extractTextFromOpenAICompatibleResponse(
  parsed: unknown,
  model: string,
  bodyPreview: string,
  status?: number
): string {
  const topLevelKeys = getTopLevelKeys(parsed)
  const root = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : undefined
  const choices = Array.isArray(root?.choices) ? (root?.choices as unknown[]) : []

  const firstChoice = choices[0]
  const firstMessage = firstChoice && typeof firstChoice === 'object' ? (firstChoice as Record<string, unknown>).message : undefined
  const firstContent = firstMessage && typeof firstMessage === 'object' ? (firstMessage as Record<string, unknown>).content : undefined
  const firstText = normalizeOpenAIContentPiece(firstContent).trim()
  if (firstText) return firstText

  const messageTexts = choices
    .map((choice) => {
      if (!choice || typeof choice !== 'object') return ''
      const message = (choice as Record<string, unknown>).message
      if (!message || typeof message !== 'object') return ''
      return normalizeOpenAIContentPiece((message as Record<string, unknown>).content).trim()
    })
    .filter((t) => t)
  if (messageTexts.length > 0) return messageTexts.join('\n').trim()

  const deltaTexts = choices
    .map((choice) => {
      if (!choice || typeof choice !== 'object') return ''
      const delta = (choice as Record<string, unknown>).delta
      if (!delta || typeof delta !== 'object') return ''
      return normalizeOpenAIContentPiece((delta as Record<string, unknown>).content).trim()
    })
    .filter((t) => t)
  if (deltaTexts.length > 0) return deltaTexts.join('').trim()

  const responseText = extractAnyOpenAIText(parsed).trim()
  if (responseText) return responseText

  throw new OpenAICompatibleEmptyTextError({
    model,
    topLevelKeys,
    choicesLength: choices.length,
    finishReason: getFinishReason(choices),
    hasMessage: Boolean(firstMessage),
    hasContent: firstContent !== undefined,
    contentType: firstContent === null ? 'null' : Array.isArray(firstContent) ? 'array' : typeof firstContent,
    bodyPreview,
    status,
  })
}

/** 流式：delta.content / reasoning_content；兼容旧 completion 流 choices[0].text */
export function extractOpenAIStreamDelta(parsed: unknown): string {
  if (!parsed || typeof parsed !== 'object') return ''
  const root = parsed as Record<string, unknown>
  const choices = root.choices
  if (!Array.isArray(choices) || choices.length === 0) return ''
  const c0 = choices[0] as Record<string, unknown>
  const delta = c0?.delta
  if (delta && typeof delta === 'object') {
    const d = delta as Record<string, unknown>
    const fromContent = normalizeOpenAIContentPiece(d.content)
    if (fromContent) return fromContent
    const r = d.reasoning_content
    if (typeof r === 'string' && r) return r
  }
  if (typeof c0?.text === 'string' && c0.text) return c0.text
  return ''
}

/** 非流式：choices[0].message.content */
export function extractOpenAICompletionMessage(parsed: unknown): string {
  if (!parsed || typeof parsed !== 'object') return ''
  const root = parsed as Record<string, unknown>
  const choices = root.choices
  if (!Array.isArray(choices) || choices.length === 0) return ''
  const message = (choices[0] as Record<string, unknown>)?.message
  if (!message || typeof message !== 'object') return ''
  return normalizeOpenAIContentPiece((message as Record<string, unknown>).content)
}

/**
 * 部分网关走 OpenAI 新版 responses 形态；尽力抽取文本，失败则空串。
 */
function extractOpenAIResponsesStyleText(parsed: unknown): string {
  if (!parsed || typeof parsed !== 'object') return ''
  const root = parsed as Record<string, unknown>
  const output = root.output
  if (!Array.isArray(output)) return ''
  const parts: string[] = []
  for (const item of output) {
    if (!item || typeof item !== 'object') continue
    const block = item as Record<string, unknown>
    if (typeof block.text === 'string' && block.text.trim()) parts.push(block.text)
    const content = block.content
    if (!Array.isArray(content)) continue
    for (const c of content) {
      if (!c || typeof c !== 'object') continue
      const rec = c as Record<string, unknown>
      if (typeof rec.text === 'string' && rec.text.trim()) {
        parts.push(rec.text)
        continue
      }
      if (rec.type === 'output_text' && typeof rec.text === 'string') parts.push(rec.text)
    }
  }
  return parts.join('')
}

export function extractAnyOpenAIText(parsed: unknown): string {
  const a = extractOpenAICompletionMessage(parsed)
  if (a) return a
  const b = extractOpenAIResponsesStyleText(parsed)
  if (b) return b
  if (parsed && typeof parsed === 'object') {
    const r = parsed as Record<string, unknown>
    if (typeof r.text === 'string' && r.text.trim()) return r.text
    if (typeof r.content === 'string' && r.content.trim()) return r.content
    const msg = r.message
    if (typeof msg === 'string' && msg.trim()) return msg
  }
  return ''
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMConfig {
  provider: Provider
  endpoint: string
  apiKey?: string
  model: string
  params: {
    temperature: number
    maxTokens: number
    topP: number
    topK?: number
    frequencyPenalty: number
    presencePenalty: number
  }
}

export interface LLMStreamOptions {
  config: LLMConfig
  messages: LLMMessage[]
  onChunk: (text: string) => void
  onDone: () => void
  onError: (err: Error) => void
}

function sanitizeOpenAICompatibleMessages(messages: LLMMessage[]): LLMMessage[] {
  return messages
    .map((message) => ({
      role: message.role,
      content: normalizeOpenAIContentPiece(message.content).trim(),
    }))
    .filter((message) => message.content.length > 0)
}

function sanitizeOpenAICompatiblePayload(
  config: LLMConfig,
  messages: LLMMessage[],
  stream: boolean
): Record<string, unknown> {
  const sanitizedMessages = sanitizeOpenAICompatibleMessages(messages)
  const payload: Record<string, unknown> = {
    model: String(config.model || '').trim(),
    messages: sanitizedMessages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    stream,
  }

  const maybeNumberFields: Array<[string, number | undefined]> = [
    ['temperature', config.params.temperature],
    ['max_tokens', config.params.maxTokens],
    ['top_p', config.params.topP],
    ['frequency_penalty', config.params.frequencyPenalty],
    ['presence_penalty', config.params.presencePenalty],
  ]

  for (const [key, value] of maybeNumberFields) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      payload[key] = value
    }
  }

  return payload
}

function summarizeOpenAICompatiblePayloadShape(payload: Record<string, unknown>): Record<string, unknown> {
  const messages = Array.isArray(payload.messages) ? (payload.messages as Array<Record<string, unknown>>) : []
  return {
    model: payload.model,
    stream: payload.stream,
    messageCount: messages.length,
    roles: messages.map((message) => message.role),
    contentLengths: messages.map((message) =>
      typeof message.content === 'string' ? message.content.length : -1
    ),
    hasSystemMessage: messages.some((message) => message.role === 'system'),
    keys: Object.keys(payload),
  }
}

function ensureOpenAICompatiblePayloadUsable(
  payload: Record<string, unknown>,
  model: string,
  mode: 'stream' | 'non-stream'
): void {
  const messages = Array.isArray(payload.messages) ? payload.messages : []
  if (messages.length > 0) return
  throw new OpenAICompatibleEmptyTextError({
    model,
    topLevelKeys: ['request_payload'],
    choicesLength: 0,
    finishReason: `request-${mode}-messages-empty`,
    hasMessage: false,
    hasContent: false,
    contentType: 'undefined',
    bodyPreview: truncateForLog(JSON.stringify(summarizeOpenAICompatiblePayloadShape(payload)), 220),
  })
}

export type OpenAIChatRunResult =
  | {
      ok: true
      fullText: string
      usedNonStreamFallback: boolean
      /** 非空文本增量次数（流式为多段；非流式降级通常为 1） */
      streamChunksWithText?: number
    }
  | { ok: false; error: string }

/**
 * openai-compatible：先流式；若无增量或流失败，再请求非流式 completion（适配不支持 SSE 的网关）。
 */
export async function runOpenAICompatibleChatWithFallback(
  config: LLMConfig,
  messages: LLMMessage[],
  onDelta: (text: string) => void
): Promise<OpenAIChatRunResult> {
  let accumulated = ''
  let streamErrorMessage: string | null = null
  let streamChunksWithText = 0

  await new Promise<void>((resolve) => {
    void callLLMStream({
      config,
      messages,
      onChunk: (t) => {
        accumulated += t
        if (t.length > 0) streamChunksWithText += 1
        onDelta(t)
      },
      onDone: () => resolve(),
      onError: (e) => {
        streamErrorMessage = e.message
        resolve()
      },
    })
  })

  if (accumulated.trim()) {
    console.log('[llm/openai] run ok (stream)', {
      streamChunksWithText,
      finalTextChars: accumulated.length,
    })
    return {
      ok: true,
      fullText: accumulated,
      usedNonStreamFallback: false,
      streamChunksWithText,
    }
  }

  if (streamErrorMessage) {
    console.warn('[llm/openai] stream failed → non-stream fallback:', streamErrorMessage)
  } else {
    console.warn('[llm/openai] stream produced no text → non-stream fallback')
  }

  const second = await completeOpenAICompatible(config, messages)
  if (second.ok === false) {
    const parts = [streamErrorMessage, second.error].filter(Boolean) as string[]
    return { ok: false, error: parts.join(' | ') || 'LLM 请求失败' }
  }
  if (!second.text.trim()) {
    return {
      ok: false,
      error: streamErrorMessage ?? '上游未返回任何 assistant 文本',
    }
  }
  onDelta(second.text)
  console.log('[llm/openai] run ok (non-stream fallback)', {
    finalTextChars: second.text.length,
  })
  return {
    ok: true,
    fullText: second.text,
    usedNonStreamFallback: true,
    streamChunksWithText: 1,
  }
}

export async function callLLMStream(options: LLMStreamOptions): Promise<void> {
  const { config } = options
  switch (config.provider) {
    case 'openai-compatible':
      return streamOpenAICompatible(options)
    case 'gemini':
      return streamGemini(options)
    case 'claude':
      return streamClaude(options)
    case 'ollama':
      return streamOllama(options)
    default: {
      const _exhaustive: never = config.provider
      options.onError(new Error(`不支持的 provider: ${_exhaustive}`))
    }
  }
}

async function readSSEStream(
  response: Response,
  onLine: (line: string) => void,
  onFinish: () => void
): Promise<void> {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed) onLine(trimmed)
      }
    }
    // 处理缓冲区残留
    if (buffer.trim()) onLine(buffer.trim())
    onFinish()
  } catch (err) {
    throw err
  }
}

export async function completeOpenAICompatible(
  config: LLMConfig,
  messages: LLMMessage[]
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const url = openAIChatCompletionsUrl(config.endpoint)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  if (config.apiKey?.trim()) {
    headers.Authorization = `Bearer ${config.apiKey.trim()}`
  }

  const payload = sanitizeOpenAICompatiblePayload(config, messages, false)

  const payloadShape = summarizeOpenAICompatiblePayloadShape(payload)
  console.log('[llm/openai] non-stream request', {
    mode: 'non-stream',
    host: endpointHost(url),
    model: config.model,
    apiKey: maskApiKey(config.apiKey),
    messageCount: Array.isArray(payload.messages) ? payload.messages.length : 0,
    payloadShape,
  })

  try {
    ensureOpenAICompatiblePayloadUsable(payload, config.model, 'non-stream')
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })

    const ct = (response.headers.get('content-type') || '').toLowerCase()
    const bodyText = await response.text()
    console.log('[llm/openai] non-stream response', {
      status: response.status,
      contentType: ct.slice(0, 80),
      hasBody: bodyText.length > 0,
    })
    if (!response.ok) {
      return {
        ok: false,
        error: `${config.provider} API 错误 (HTTP ${response.status}): ${truncateForLog(bodyText, 400)}`,
      }
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(bodyText) as unknown
    } catch {
      return {
        ok: false,
        error: `上游返回非 JSON body: ${truncateForLog(bodyText, 200)}`,
      }
    }

    try {
      const text = extractTextFromOpenAICompatibleResponse(
        parsed,
        config.model,
        truncateForLog(bodyText, 220),
        response.status
      )

      console.log('[llm/openai] non-stream parsed', {
        status: response.status,
        topLevelKeys: getTopLevelKeys(parsed),
        finalTextChars: text.length,
        finishReason: Array.isArray((parsed as Record<string, unknown> | undefined)?.choices)
          ? getFinishReason((parsed as Record<string, unknown>).choices as unknown[])
          : 'n/a',
      })

      return { ok: true, text }
    } catch (err: unknown) {
      if (err instanceof OpenAICompatibleEmptyTextError) {
        console.warn('[llm/openai] non-stream empty text', err.diagnostics)
        return { ok: false, error: `${err.message} | ${truncateForLog(JSON.stringify(err.diagnostics), 500)}` }
      }
      throw err
    }
  } catch (err: unknown) {
    const e = err instanceof Error ? err : new Error(String(err))
    console.error('[llm/openai] non-stream exception', {
      mode: 'non-stream',
      host: endpointHost(url),
      model: config.model,
      error: e.message,
    })
    return { ok: false, error: e.message }
  }
}

async function streamOpenAICompatible(options: LLMStreamOptions): Promise<void> {
  const { config, messages, onChunk, onDone, onError } = options
  const url = openAIChatCompletionsUrl(config.endpoint)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream, application/json',
  }
  if (config.apiKey?.trim()) {
    headers.Authorization = `Bearer ${config.apiKey.trim()}`
  }

  const payload = sanitizeOpenAICompatiblePayload(config, messages, true)

  const payloadShape = summarizeOpenAICompatiblePayloadShape(payload)
  console.log('[llm/openai] stream request', {
    mode: 'stream',
    host: endpointHost(url),
    model: config.model,
    apiKey: maskApiKey(config.apiKey),
    messageCount: Array.isArray(payload.messages) ? payload.messages.length : 0,
    payloadShape,
  })

  try {
    ensureOpenAICompatiblePayloadUsable(payload, config.model, 'stream')
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })

    const contentType = (response.headers.get('content-type') || '').toLowerCase()
    console.log('[llm/openai] stream response head', {
      status: response.status,
      contentType: contentType.slice(0, 100),
      hasBody: Boolean(response.body),
    })

    if (!response.ok) {
      const body = await response.text()
      onError(
        new Error(
          `${config.provider} API 错误 (HTTP ${response.status}): ${truncateForLog(body, 500)}`
        )
      )
      return
    }

    if (!response.body) {
      onError(new Error('上游 200 但无 response.body，无法读取流'))
      return
    }

    // 上游忽略 stream:true 直接返回整段 JSON（仍按 chunk 推给上层，由路由打成 SSE）
    if (contentType.includes('application/json')) {
      const raw = await response.text()
      let parsed: unknown
      try {
        parsed = JSON.parse(raw) as unknown
      } catch {
        onError(new Error(`上游 application/json 但 JSON 解析失败: ${truncateForLog(raw, 200)}`))
        return
      }
      try {
        const out = extractTextFromOpenAICompatibleResponse(
          parsed,
          config.model,
          truncateForLog(raw, 220),
          response.status
        )
        console.log('[llm/openai] stream→json single shot', {
          status: response.status,
          topLevelKeys: getTopLevelKeys(parsed),
          parsedTextLength: out.length,
        })
        onChunk(out)
        onDone()
        return
      } catch (err: unknown) {
        if (err instanceof OpenAICompatibleEmptyTextError) {
          console.warn('[llm/openai] stream→json empty text', err.diagnostics)
          onError(new Error(`${err.message} | ${truncateForLog(JSON.stringify(err.diagnostics), 500)}`))
          return
        }
        throw err
      }
    }

    let done = false
    const safeOnDone = () => {
      if (done) return
      done = true
      onDone()
    }

    const stats = { sseDataEvents: 0, jsonLines: 0, deltaChars: 0 }

    await readSSEStream(
      response,
      (line) => {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith(':')) return

        const m = trimmed.match(/^data:\s*(.*)$/i)
        if (!m) return

        const data = m[1].trim()
        stats.sseDataEvents += 1

        if (data === '' || data === '[DONE]') {
          if (data === '[DONE]') safeOnDone()
          return
        }

        try {
          const parsed = JSON.parse(data) as unknown
          stats.jsonLines += 1
          const piece = extractOpenAIStreamDelta(parsed)
          if (piece) {
            stats.deltaChars += piece.length
            onChunk(piece)
          }
        } catch {
          /* 非 JSON 的 data 行（心跳等），忽略 */
        }
      },
      safeOnDone
    )

    console.log('[llm/openai] stream sse path summary', {
      ...stats,
      parsedTextLength: stats.deltaChars,
    })
  } catch (err: any) {
    const error = err instanceof Error ? err : new Error(String(err))
    console.error('[llm/openai] stream exception', {
      mode: 'stream',
      host: endpointHost(url),
      model: config.model,
      error: error.message,
    })
    onError(error)
  }
}

async function streamGemini(options: LLMStreamOptions): Promise<void> {
  const { config, messages, onChunk, onDone, onError } = options

  const systemMessages = messages.filter((m) => m.role === 'system')
  const systemInstructionText = systemMessages.map((m) => m.content).join('\n\n')

  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

  const endpoint = config.endpoint?.trim() ? config.endpoint : 'https://generativelanguage.googleapis.com'
  const url = `${endpoint}/v1beta/models/${config.model}:streamGenerateContent?alt=sse&key=${config.apiKey}`

  const payload: any = {
    contents,
    generationConfig: {
      temperature: config.params.temperature,
      maxOutputTokens: config.params.maxTokens,
      topP: config.params.topP,
      topK: config.params.topK || 40,
    },
  }

  if (systemMessages.length > 0) {
    payload.systemInstruction = {
      parts: [{ text: systemInstructionText }],
    }
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const body = await response.text()
      onError(new Error(`${config.provider} API 错误 (HTTP ${response.status}): ${body}`))
      return
    }

    let done = false
    const safeOnDone = () => {
      if (done) return
      done = true
      onDone()
    }

    await readSSEStream(
      response,
      (line) => {
        if (!line.startsWith('data: ')) return
        const data = line.slice(6)

        try {
          const parsed = JSON.parse(data)
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text
          if (text) onChunk(text)
        } catch {
          // JSON 解析失败静默跳过
        }
      },
      safeOnDone
    )
  } catch (err: any) {
    onError(err instanceof Error ? err : new Error(String(err)))
  }
}

async function streamClaude(options: LLMStreamOptions): Promise<void> {
  const { config, messages, onChunk, onDone, onError } = options

  const systemMessages = messages.filter((m) => m.role === 'system')
  const systemText = systemMessages.map((m) => m.content).join('\n\n')

  const convertedMessages: Array<{ role: 'user' | 'assistant'; content: string }> = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }))

  if (convertedMessages.length === 0 || convertedMessages[0].role !== 'user') {
    convertedMessages.unshift({ role: 'user', content: '（对话开始）' })
  }

  const endpoint = config.endpoint?.trim() ? config.endpoint : 'https://api.anthropic.com'
  const url = `${endpoint}/v1/messages`

  const payload: any = {
    model: config.model,
    max_tokens: config.params.maxTokens,
    stream: true,
    temperature: config.params.temperature,
    top_p: config.params.topP,
    messages: convertedMessages,
  }

  if (systemText.trim()) {
    payload.system = systemText
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const body = await response.text()
      onError(new Error(`${config.provider} API 错误 (HTTP ${response.status}): ${body}`))
      return
    }

    let done = false
    const safeOnDone = () => {
      if (done) return
      done = true
      onDone()
    }

    let latestEventType = ''

    await readSSEStream(
      response,
      (line) => {
        if (line.startsWith('event: ')) {
          latestEventType = line.slice(7).trim()
          return
        }

        if (!line.startsWith('data: ')) return
        const data = line.slice(6)

        try {
          const parsed = JSON.parse(data)
          if (
            parsed.type === 'content_block_delta' &&
            parsed.delta?.type === 'text_delta' &&
            parsed.delta?.text
          ) {
            onChunk(parsed.delta.text)
            return
          }

          if (parsed.type === 'message_stop') {
            safeOnDone()
            return
          }
        } catch {
          // JSON 解析失败静默跳过
        } finally {
          // 保持 latestEventType 变量的存在（按规范维护）
          void latestEventType
        }
      },
      safeOnDone
    )
  } catch (err: any) {
    onError(err instanceof Error ? err : new Error(String(err)))
  }
}

async function streamOllama(options: LLMStreamOptions): Promise<void> {
  const { config, messages, onChunk, onDone, onError } = options
  const url = `${config.endpoint}/api/chat`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        stream: true,
        options: {
          temperature: config.params.temperature,
          top_p: config.params.topP,
          num_predict: config.params.maxTokens,
        },
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      onError(new Error(`${config.provider} API 错误 (HTTP ${response.status}): ${body}`))
      return
    }

    let done = false
    const safeOnDone = () => {
      if (done) return
      done = true
      onDone()
    }

    await readSSEStream(
      response,
      (line) => {
        try {
          const parsed = JSON.parse(line)
          const content = parsed.message?.content
          if (content) onChunk(content)
          if (parsed.done) safeOnDone()
        } catch {
          // JSON 解析失败静默跳过
        }
      },
      safeOnDone
    )
  } catch (err: any) {
    onError(err instanceof Error ? err : new Error(String(err)))
  }
}

export async function fetchModelList(
  provider: Provider,
  endpoint: string,
  apiKey?: string
): Promise<string[]> {
  if (provider === 'claude') {
    return [
      'claude-sonnet-4-20250514',
      'claude-3-7-sonnet-20250219',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
      'claude-3-haiku-20240307',
    ]
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10_000)

  const timeoutError = () => {
    throw new Error(`${provider} 模型列表获取失败: request timeout (10s)`)
  }

  try {
    switch (provider) {
      case 'openai-compatible': {
        const response = await fetch(`${endpoint}/models`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          signal: controller.signal,
        })

        if (!response.ok) {
          const body = await response.text().catch(() => '')
          throw new Error(
            `${provider} 模型列表获取失败 (HTTP ${response.status}): ${body}`
          )
        }

        const json: any = await response.json()
        const data: any[] = Array.isArray(json?.data) ? json.data : []
        return data
          .map((m) => m?.id)
          .filter((id) => typeof id === 'string')
          .sort()
      }
      case 'gemini': {
        const baseEndpoint = endpoint || 'https://generativelanguage.googleapis.com'
        const response = await fetch(`${baseEndpoint}/v1beta/models?key=${apiKey}`, {
          method: 'GET',
          signal: controller.signal,
        })

        if (!response.ok) {
          const body = await response.text().catch(() => '')
          throw new Error(
            `${provider} 模型列表获取失败 (HTTP ${response.status}): ${body}`
          )
        }

        const json: any = await response.json()
        const models: any[] = Array.isArray(json?.models) ? json.models : []
        const supported = models.filter((m) =>
          Array.isArray(m?.supportedGenerationMethods)
            ? m.supportedGenerationMethods.includes('generateContent')
            : false
        )
        return supported.map((m) => String(m.name).replace('models/', ''))
      }
      case 'ollama': {
        const response = await fetch(`${endpoint}/api/tags`, {
          method: 'GET',
          signal: controller.signal,
        })

        if (!response.ok) {
          const body = await response.text().catch(() => '')
          throw new Error(
            `${provider} 模型列表获取失败 (HTTP ${response.status}): ${body}`
          )
        }

        const json: any = await response.json()
        const models: any[] = Array.isArray(json?.models) ? json.models : []
        return models.map((m) => m?.name).filter((n) => typeof n === 'string')
      }
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') timeoutError()
    throw new Error(`${provider} 模型列表获取失败: ${err?.message ?? String(err)}`)
  } finally {
    clearTimeout(timeoutId)
  }

  // 理论上不会走到这里
  throw new Error(`${provider} 模型列表获取失败: unknown provider`)
}