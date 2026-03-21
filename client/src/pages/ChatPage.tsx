import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Send, Plus, Trash2, User, Bot, Loader2 } from 'lucide-react'
import { RichMessageContent } from '@/components/ui'
import { chatApi, type ChatSession, type ChatMessage } from '@/api/services/chat'

function normalizeMessage(m: Record<string, unknown>): ChatMessage {
  return {
    id: Number(m.id),
    chatSessionId: Number(m.chatSessionId ?? 0),
    role: (m.role as ChatMessage['role']) ?? 'user',
    content: String(m.content ?? ''),
    contentFormat: String(m.contentFormat ?? 'text/plain'),
    metadata: m.metadata && typeof m.metadata === 'object' && !Array.isArray(m.metadata) ? (m.metadata as Record<string, unknown>) : {},
    status: String(m.status ?? 'done'),
    createdAt: Number(m.createdAt ?? 0),
  }
}

interface Character {
  id: number
  name: string
  avatarPath: string | null
}

function getAuthHeaders() {
  const token = localStorage.getItem('side_token')
  return { Authorization: `Bearer ${token}` }
}

/** 兼容上游/代理错误地把流式接口改成一次性 JSON 的情况 */
function extractAssistantFromJsonBody(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const o = data as Record<string, unknown>
  if (typeof o.reply === 'string' && o.reply.trim()) return o.reply
  if (typeof o.content === 'string' && o.content.trim()) return o.content
  if (typeof o.text === 'string' && o.text.trim()) return o.text
  const choices = o.choices
  if (Array.isArray(choices) && choices[0] && typeof choices[0] === 'object') {
    const msg = (choices[0] as Record<string, unknown>).message
    if (msg && typeof msg === 'object') {
      const c = (msg as Record<string, unknown>).content
      if (typeof c === 'string' && c.trim()) return c
    }
  }
  return null
}

type StreamSseEvent =
  | { type: 'start' }
  | { type: 'chunk'; text: string }
  | { type: 'done' }
  | { type: 'error'; message?: string }

type ChatUiStatus = 'idle' | 'sending' | 'streaming' | 'success' | 'error'

function parseSseLine(line: string): StreamSseEvent | null {
  const trimmed = line.trim()
  const m = trimmed.match(/^data:\s*(.*)$/i)
  if (!m) return null
  const jsonStr = m[1].trim()
  if (!jsonStr) return null
  try {
    return JSON.parse(jsonStr) as StreamSseEvent
  } catch {
    return null
  }
}

export default function ChatPage() {
  const navigate = useNavigate()
  const { characterId: routeCharacterId } = useParams<{ characterId?: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const sessionIdParam = searchParams.get('sessionId')

  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [characters, setCharacters] = useState<Character[]>([])
  const [boundCharacterId, setBoundCharacterId] = useState<number | null>(null)
  const [input, setInput] = useState('')
  const [chatStatus, setChatStatus] = useState<ChatUiStatus>('idle')
  const [streamingText, setStreamingText] = useState('')
  const [sendError, setSendError] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const isBusy = chatStatus === 'sending' || chatStatus === 'streaming'
  const debug = (...args: unknown[]) => {
    if (import.meta.env.DEV) console.debug('[ChatPage]', ...args)
  }

  const fetchSessions = async () => {
    const res = await fetch('/api/v1/chat/sessions', { headers: getAuthHeaders() })
    if (!res.ok) return [] as ChatSession[]
    const data = (await res.json()) as ChatSession[]
    setSessions(Array.isArray(data) ? data : [])
    return Array.isArray(data) ? data : []
  }

  const fetchSessionDetail = async (sessionId: number) => {
    const res = await fetch(`/api/v1/chat/sessions/${sessionId}`, { headers: getAuthHeaders() })
    if (!res.ok) return null
    return (await res.json()) as ChatSession
  }

  const fetchMessages = async (sessionId: number): Promise<boolean> => {
    setMessagesLoading(true)
    setFetchError(null)
    try {
      const res = await fetch(`/api/v1/chat/sessions/${sessionId}/messages`, { headers: getAuthHeaders() })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        const msg = typeof errBody?.error === 'string' ? errBody.error : `加载消息失败 (${res.status})`
        setFetchError(msg)
        setMessages([])
        return false
      }
      const data = (await res.json()) as Record<string, unknown>[]
      const list = Array.isArray(data) ? data.map((row) => normalizeMessage(row)) : []
      setMessages(list)
      return true
    } catch {
      setFetchError('网络异常，无法加载消息')
      setMessages([])
      return false
    } finally {
      setMessagesLoading(false)
    }
  }

  useEffect(() => {
    fetch('/api/v1/characters', { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((data) => setCharacters(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const initialize = async () => {
      setInitializing(true)
      setSendError(null)
      setFetchError(null)

      const urlSessionId = Number(sessionIdParam)
      const parsedRouteCharacterId = Number(routeCharacterId)
      const hasSessionInQuery = Number.isFinite(urlSessionId) && urlSessionId > 0
      const hasCharacterInPath = Number.isFinite(parsedRouteCharacterId) && parsedRouteCharacterId > 0

      if (hasSessionInQuery) {
        const detail = await fetchSessionDetail(urlSessionId)
        if (detail) {
          setActiveSessionId(detail.id)
          setBoundCharacterId(detail.characterId)
          await fetchSessions()
          await fetchMessages(detail.id)
          setInitializing(false)
          return
        }
      }

      if (hasCharacterInPath) {
        try {
          const session = await chatApi.openSessionByCharacter(parsedRouteCharacterId)
          await fetchSessions()
          setActiveSessionId(session.id)
          setBoundCharacterId(session.characterId)
          setSearchParams({ sessionId: String(session.id) }, { replace: true })
          await fetchMessages(session.id)
          setInitializing(false)
          return
        } catch {
          setFetchError('打开角色会话失败')
        }
      }

      const list = await fetchSessions()
      if (list.length > 0) {
        const first = list[0]
        setActiveSessionId(first.id)
        setBoundCharacterId(first.characterId)
        setSearchParams({ sessionId: String(first.id) }, { replace: true })
        await fetchMessages(first.id)
      }

      setInitializing(false)
    }

    void initialize()
  }, [routeCharacterId, sessionIdParam, setSearchParams])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  const handleSelectSession = async (sessionId: number) => {
    if (isBusy) return
    setActiveSessionId(sessionId)
    setSearchParams({ sessionId: String(sessionId) }, { replace: true })

    const detail = await fetchSessionDetail(sessionId)
    setBoundCharacterId(detail?.characterId ?? null)
    await fetchMessages(sessionId)
  }

  const handleNewSession = async () => {
    if (isBusy) return
    const fallbackCharacterId = Number(routeCharacterId)
    const payloadCharacterId =
      boundCharacterId ?? (Number.isFinite(fallbackCharacterId) && fallbackCharacterId > 0 ? fallbackCharacterId : null)

    try {
      const newSession = await chatApi.createSession({
        characterId: payloadCharacterId,
        title: '新会话',
      })
      await fetchSessions()
      setActiveSessionId(newSession.id)
      setBoundCharacterId(newSession.characterId)
      setSearchParams({ sessionId: String(newSession.id) }, { replace: true })
      setMessages([])
    } catch {
      setFetchError('创建会话失败')
    }
  }

  const handleDeleteSession = async (id: number, e: React.MouseEvent) => {
    if (isBusy) return
    e.stopPropagation()
    if (!window.confirm('确认删除该会话？')) return

    await fetch(`/api/v1/chat/sessions/${id}`, { method: 'DELETE', headers: getAuthHeaders() })

    const list = await fetchSessions()
    if (activeSessionId === id) {
      if (list.length > 0) {
        const first = list[0]
        setActiveSessionId(first.id)
        setBoundCharacterId(first.characterId)
        setSearchParams({ sessionId: String(first.id) }, { replace: true })
        await fetchMessages(first.id)
      } else {
        setActiveSessionId(null)
        setBoundCharacterId(null)
        setMessages([])
        navigate('/chat', { replace: true })
      }
    }
  }

  const handleSend = async () => {
    if (!input.trim() || isBusy || !activeSessionId) return

    const sessionIdAtStart = activeSessionId
    const userContent = input.trim()
    setInput('')
    setChatStatus('sending')
    setStreamingText('')
    setSendError(null)

    const tempUserMsg: ChatMessage = {
      id: Date.now(),
      chatSessionId: sessionIdAtStart,
      role: 'user',
      content: userContent,
      contentFormat: 'text/plain',
      metadata: { pending: true },
      status: 'pending',
      createdAt: Date.now(),
    }
    setMessages((prev) => [...prev, tempUserMsg])

    try {
      const requestUrl = `/api/v1/chat/sessions/${sessionIdAtStart}/messages/stream`
      debug('send start', {
        sessionId: sessionIdAtStart,
        requestUrl,
        chars: userContent.length,
      })
      const token = localStorage.getItem('side_token')
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: userContent }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: '请求失败' }))
        throw new Error((err as { error?: string }).error || `HTTP ${response.status}`)
      }

      const contentType = response.headers.get('content-type') || ''
      debug('response head', {
        status: response.status,
        contentType,
        hasBody: Boolean(response.body),
      })

      if (contentType.includes('application/json')) {
        const data = await response.json().catch(() => null)
        const extracted = extractAssistantFromJsonBody(data)
        debug('json fallback body', {
          payloadType: Array.isArray(data) ? 'array' : data === null ? 'null' : typeof data,
          ok: Boolean(extracted && extracted.trim()),
          len: extracted?.length ?? 0,
        })
        if (!extracted || !extracted.trim()) {
          setChatStatus('error')
          throw new Error('模型未返回有效内容')
        }

        setStreamingText(extracted)
        const reloaded = await fetchMessages(sessionIdAtStart)
        if (!reloaded) throw new Error('消息刷新失败，未确认 assistant 回复')
        await fetchSessions()
        setChatStatus('success')
        setStreamingText('')
        setChatStatus('idle')
        return
      }

      if (!response.body) {
        throw new Error('响应无 body，无法读取流')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      let buffer = ''
      let fullText = ''
      let rawText = ''
      let sawDone = false
      let chunkCount = 0

      let streamDone = false
      while (!streamDone) {
        const readRes = await reader.read()
        streamDone = readRes.done
        const value = readRes.value

        if (value) {
          const decoded = decoder.decode(value, { stream: true })
          buffer += decoded
          rawText += decoded
        }

        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const event = parseSseLine(line)
          if (!event) continue

          if (event.type === 'start') {
            setChatStatus('streaming')
          } else if (event.type === 'chunk' && typeof event.text === 'string') {
            if (event.text) {
              setChatStatus('streaming')
              fullText += event.text
              chunkCount += 1
              setStreamingText(fullText)
            }
          } else if (event.type === 'done') {
            sawDone = true
            debug('sse done', {
              chunkCount,
              parsedPayloadType: 'sse',
              assistantFinalTextLength: fullText.length,
            })

            if (!fullText.trim()) {
              throw new Error('模型未返回有效内容')
            }

            const reloaded = await fetchMessages(sessionIdAtStart)
            if (!reloaded) throw new Error('消息刷新失败，未确认 assistant 回复')
            await fetchSessions()
            setChatStatus('success')
            setStreamingText('')
            setChatStatus('idle')
            return
          } else if (event.type === 'error') {
            throw new Error(typeof event.message === 'string' ? event.message : '模型返回错误')
          }
        }
      }

      const tail = decoder.decode()
      buffer += tail
      rawText += tail

      // 兜底：尾部残留的 SSE 行/伪 JSON
      if (buffer.trim()) {
        for (const line of buffer.split('\n')) {
          const event = parseSseLine(line)
          if (!event) continue
          if (event.type === 'done') {
            sawDone = true
            if (!fullText.trim()) throw new Error('模型未返回有效内容')
            const reloaded = await fetchMessages(sessionIdAtStart)
            if (!reloaded) throw new Error('消息刷新失败，未确认 assistant 回复')
            await fetchSessions()
            setChatStatus('success')
            setStreamingText('')
            setChatStatus('idle')
            return
          } else if (event.type === 'error') {
            throw new Error(typeof event.message === 'string' ? event.message : '模型返回错误')
          }
        }
      }

      if (!sawDone) {
        // 有些代理会把 SSE 直接返回 JSON，但 content-type 不一致
        if (!fullText.trim()) {
          const maybe = rawText.trim()
          if (maybe.startsWith('{') || maybe.startsWith('[')) {
            try {
              const parsed = JSON.parse(maybe) as unknown
              const extracted = extractAssistantFromJsonBody(parsed)
              debug('raw text fallback parsed', {
                payloadType: Array.isArray(parsed) ? 'array' : typeof parsed,
                assistantFinalTextLength: extracted?.length ?? 0,
              })
              if (extracted && extracted.trim()) {
                setStreamingText(extracted)
                const reloaded = await fetchMessages(sessionIdAtStart)
                if (!reloaded) throw new Error('消息刷新失败，未确认 assistant 回复')
                await fetchSessions()
                setChatStatus('success')
                setStreamingText('')
                setChatStatus('idle')
                return
              }
            } catch {
              // ignore
            }
          }
        }
        throw new Error(fullText.trim() ? '流已结束但未收到完成信号' : '模型未返回有效内容')
      }

      // 理论上不会走到这里（done 会 return）
      throw new Error('请求已结束但未触发完成信号')
    } catch (err) {
      setChatStatus('error')
      const rawMsg = err instanceof Error ? err.message : '发送失败'
      const msg = rawMsg.includes('模型返回成功但内容为空')
        ? '模型返回成功但内容为空，请检查模型/接口兼容性'
        : rawMsg.includes('模型未返回有效内容')
          ? '模型未返回有效内容'
          : '请求失败，请检查接口配置或查看控制台日志'
      debug('send failed', {
        error: rawMsg,
        sessionId: sessionIdAtStart,
      })
      setSendError(msg)
      void fetchMessages(sessionIdAtStart)
    } finally {
      setStreamingText('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const selectedCharacter = characters.find((c) => c.id === boundCharacterId)

  return (
    <>
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        <aside
          style={{
            width: 240,
            flexShrink: 0,
            height: '100vh',
            overflow: 'hidden',
            background: 'var(--bg-secondary)',
            borderRight: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ padding: '16px 12px', borderBottom: '1px solid var(--border-color)' }}>
            <button
              onClick={() => void handleNewSession()}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '8px',
                borderRadius: '8px',
                cursor: 'pointer',
                background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                border: 'none',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.85rem',
              }}
            >
              <Plus size={14} /> 新建会话
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => void handleSelectSession(session.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  marginBottom: '4px',
                  background: activeSessionId === session.id ? 'rgba(124,106,247,0.12)' : 'transparent',
                  border: `1px solid ${activeSessionId === session.id ? 'rgba(124,106,247,0.2)' : 'transparent'}`,
                }}
              >
                <span
                  style={{
                    fontSize: '0.85rem',
                    color: activeSessionId === session.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                >
                  {session.title || '新会话'}
                </span>
                <button
                  onClick={(e) => void handleDeleteSession(session.id, e)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </aside>

        <main
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '14px 20px',
              borderBottom: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {selectedCharacter ? `已绑定角色：${selectedCharacter.name}` : '当前会话未绑定角色'}
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
            {initializing && (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                正在初始化会话...
              </div>
            )}

            {!initializing && messagesLoading && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                正在加载消息...
              </div>
            )}

            {!initializing && !messagesLoading && fetchError && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  background: 'rgba(251,191,36,0.12)',
                  border: '1px solid rgba(251,191,36,0.4)',
                  color: 'var(--warning, #d97706)',
                  fontSize: '0.85rem',
                  marginBottom: '16px',
                }}
              >
                {fetchError}
              </div>
            )}

            {!initializing &&
              !messagesLoading &&
              !fetchError &&
              activeSessionId !== null &&
              messages.length === 0 &&
              !isBusy && (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                  <Bot size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                  <p style={{ fontSize: '0.9rem' }}>
                    {selectedCharacter ? `开始和 ${selectedCharacter.name} 对话吧` : '该会话暂未绑定角色'}
                  </p>
                  <p style={{ fontSize: '0.8rem', marginTop: '8px', opacity: 0.75 }}>在下方输入框发送消息即可开始</p>
                </div>
              )}

            {!initializing && !messagesLoading && activeSessionId === null && (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                <Bot size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                <p style={{ fontSize: '0.9rem' }}>暂无会话</p>
                <p style={{ fontSize: '0.8rem', marginTop: '8px', opacity: 0.75 }}>点击左侧「新建会话」开始</p>
              </div>
            )}

            {!initializing && !messagesLoading && messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  display: 'flex',
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                  alignItems: 'flex-start',
                  gap: '10px',
                  marginBottom: '20px',
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: msg.role === 'user' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: '0.8rem',
                  }}
                >
                  {msg.role === 'user' ? <User size={14} /> : <Bot size={14} style={{ color: 'var(--accent-primary)' }} />}
                </div>
                <div
                  style={{
                    maxWidth: '68%',
                    padding: '12px 16px',
                    borderRadius: '14px',
                    background: msg.role === 'user' ? 'var(--user-bubble)' : 'var(--ai-bubble)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontSize: '0.92rem',
                    lineHeight: 1.7,
                  }}
                >
                  <RichMessageContent content={msg.content} />
                </div>
              </motion.div>
            ))}

            {isBusy && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: '10px',
                  marginBottom: '20px',
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: 'var(--bg-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent-primary)',
                    fontSize: '0.8rem',
                  }}
                >
                  <Bot size={14} />
                </div>
                <div
                  style={{
                    maxWidth: '68%',
                    padding: '12px 16px',
                    borderRadius: '14px',
                    background: 'var(--ai-bubble)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontSize: '0.92rem',
                    lineHeight: 1.7,
                  }}
                >
                  {!streamingText ? (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <Loader2 size={14} style={{ animation: 'spin 0.9s linear infinite' }} />
                        生成中...
                      </span>
                    </span>
                  ) : (
                    <>
                      <RichMessageContent content={streamingText} />
                      <span
                        style={{
                          display: 'inline-block',
                          width: '2px',
                          height: '14px',
                          background: 'var(--accent-primary)',
                          marginLeft: '2px',
                          verticalAlign: 'text-bottom',
                          animation: 'blink 0.8s infinite',
                        }}
                      />
                    </>
                  )}
                </div>
              </motion.div>
            )}

            {sendError && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  background: 'rgba(248,113,113,0.15)',
                  border: '1px solid var(--danger)',
                  color: 'var(--danger)',
                  fontSize: '0.85rem',
                  marginBottom: '16px',
                }}
              >
                发送失败：{sendError}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div
            style={{
              padding: '16px 20px',
              borderTop: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: '10px',
                background: 'var(--bg-tertiary)',
                borderRadius: '14px',
                border: '1px solid var(--border-color)',
                padding: '10px 14px',
              }}
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入消息... (Enter 发送，Shift+Enter 换行)"
                rows={1}
                disabled={isBusy || activeSessionId === null}
                style={{
                  flex: 1,
                  background: 'none',
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '0.92rem',
                  lineHeight: 1.6,
                  fontFamily: 'inherit',
                }}
              />
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => void handleSend()}
                disabled={!input.trim() || isBusy || !activeSessionId}
                aria-busy={isBusy}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background:
                    input.trim() && !isBusy && activeSessionId
                      ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))'
                      : 'var(--bg-secondary)',
                  border: 'none',
                  color: '#fff',
                  cursor: input.trim() && !isBusy && activeSessionId ? 'pointer' : 'not-allowed',
                  opacity: input.trim() && !isBusy && activeSessionId ? 1 : 0.5,
                  transition: 'all 0.2s',
                }}
              >
                {isBusy ? (
                  <Loader2 size={14} style={{ animation: 'spin 0.9s linear infinite' }} />
                ) : (
                  <Send size={14} />
                )}
              </motion.button>
            </div>
            {activeSessionId === null && (
              <p
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  marginTop: '8px',
                  textAlign: 'center',
                }}
              >
                请先创建或选择一个会话
              </p>
            )}
          </div>
        </main>

        <aside
          style={{
            width: 200,
            flexShrink: 0,
            height: '100vh',
            overflow: 'hidden',
            background: 'var(--bg-secondary)',
            borderLeft: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              textAlign: 'center',
              color: 'var(--text-muted)',
              padding: '20px',
            }}
          >
            <p style={{ fontSize: '0.85rem', marginBottom: '8px' }}>扩展面板</p>
            <p style={{ fontSize: '0.75rem', opacity: 0.6 }}>（即将推出）</p>
          </div>
        </aside>
      </div>
    </>
  )
}
