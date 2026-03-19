import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Square, Plus, Trash2, ChevronLeft, User, Bot } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Message {
  id?: number
  role: 'user' | 'assistant' | 'system'
  content: string
  streaming?: boolean
}

interface Conversation {
  id: number
  title: string
  created_at: number
}

interface Character {
  id: number
  name: string
  avatar_path: string | null
  data: string
}

export default function ChatPage() {
  const { characterId } = useParams<{ characterId: string }>()
  const navigate = useNavigate()
  const [character, setCharacter] = useState<Character | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvId, setActiveConvId] = useState<number | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [showSidebar, setShowSidebar] = useState(true)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const token = localStorage.getItem('side_token')
  const headers: HeadersInit = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'Content-Type': 'application/json',
  }

  useEffect(() => {
    if (!characterId) return
    fetch(`/api/v1/characters/${characterId}`, {
      headers,
    })
      .then((r) => r.json())
      .then(setCharacter)
    fetchConversations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchConversations = async () => {
    if (!characterId) return
    const res = await fetch(
      `/api/v1/conversations?characterId=${characterId}`,
      { headers },
    )
    if (res.ok) {
      const data: Conversation[] = await res.json()
      setConversations(data)
      if (data.length > 0 && !activeConvId) {
        selectConversation(data[0].id)
      }
    }
  }

  const selectConversation = async (id: number) => {
    setActiveConvId(id)
    const res = await fetch(`/api/v1/conversations/${id}/messages`, { headers })
    if (res.ok) setMessages(await res.json())
  }

  const createConversation = async () => {
    if (!characterId) return
    const res = await fetch('/api/v1/conversations', {
      method: 'POST',
      headers,
      body: JSON.stringify({ characterId: Number(characterId), title: '新对话' }),
    })
    if (res.ok) {
      const data: Conversation = await res.json()
      await fetchConversations()
      selectConversation(data.id)
    }
  }

  const deleteConversation = async (id: number) => {
    if (!window.confirm('确认删除该对话？')) return
    await fetch(`/api/v1/conversations/${id}`, { method: 'DELETE', headers })
    setMessages([])
    setActiveConvId(null)
    fetchConversations()
  }

  const sendMessage = async () => {
    if (!input.trim() || !activeConvId || isStreaming) return
    const userContent = input.trim()
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    setMessages((prev) => [...prev, { role: 'user', content: userContent }])
    setIsStreaming(true)

    const aiMsg: Message = { role: 'assistant', content: '', streaming: true }
    setMessages((prev) => [...prev, aiMsg])

    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/v1/chat/stream', {
        method: 'POST',
        headers,
        body: JSON.stringify({ conversationId: activeConvId, message: userContent }),
        signal: abortRef.current.signal,
      })

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const json = JSON.parse(line.slice(6))
            if (json.token) {
              fullText += json.token
              setMessages((prev) => {
                const updated = [...prev]
                updated[updated.length - 1] = {
                  role: 'assistant',
                  content: fullText,
                  streaming: true,
                }
                return updated
              })
            }
            if (json.done || json.error) break
          } catch {
            continue
          }
        }
      }

      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: 'assistant',
          content: fullText,
          streaming: false,
        }
        return updated
      })
    } catch (e: unknown) {
      if ((e as Error).name !== 'AbortError') {
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: 'assistant',
            content: '连接失败，请检查 API 配置',
            streaming: false,
          }
          return updated
        })
      }
    } finally {
      setIsStreaming(false)
    }
  }

  const stopStreaming = () => {
    abortRef.current?.abort()
    setIsStreaming(false)
    setMessages((prev) => {
      const updated = [...prev]
      if (updated.length > 0 && updated[updated.length - 1].streaming) {
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          streaming: false,
        }
      }
      return updated
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 144)}px`
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* 对话历史侧边栏 */}
      <AnimatePresence>
        {showSidebar && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 240, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              flexShrink: 0,
              height: '100vh',
              overflow: 'hidden',
              background: 'var(--bg-secondary)',
              borderRight: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '16px 12px',
                borderBottom: '1px solid var(--border-color)',
              }}
            >
              <button
                onClick={() => navigate('/characters')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  marginBottom: '12px',
                }}
              >
                <ChevronLeft size={14} /> 返回角色列表
              </button>
              <button
                onClick={createConversation}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '8px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  background:
                    'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                }}
              >
                <Plus size={14} /> 新建对话
              </button>
            </div>

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '8px',
              }}
            >
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => selectConversation(conv.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 10px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    marginBottom: '4px',
                    background:
                      activeConvId === conv.id
                        ? 'rgba(124,106,247,0.12)'
                        : 'transparent',
                    border: `1px solid ${
                      activeConvId === conv.id
                        ? 'rgba(124,106,247,0.2)'
                        : 'transparent'
                    }`,
                    transition: 'all 0.15s',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.85rem',
                      color:
                        activeConvId === conv.id
                          ? 'var(--accent-primary)'
                          : 'var(--text-secondary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                    }}
                  >
                    {conv.title}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteConversation(conv.id)
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      padding: '2px',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* 主对话区 */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* 顶部 Header */}
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
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ChevronLeft
              size={18}
              style={{
                transform: showSidebar ? 'none' : 'rotate(180deg)',
                transition: 'transform 0.2s',
              }}
            />
          </button>

          {character && (
            <>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  flexShrink: 0,
                  background: 'var(--bg-tertiary)',
                  backgroundImage: character.avatar_path
                    ? `url(/api/v1/characters/${character.id}/avatar)`
                    : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-primary)',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                }}
              >
                {!character.avatar_path &&
                  character.name.charAt(0).toUpperCase()}
              </div>
              <span
                style={{
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  fontSize: '0.95rem',
                }}
              >
                {character.name}
              </span>
            </>
          )}
        </div>

        {/* 消息列表 */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px 20px',
          }}
        >
          {messages.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: '60px 20px',
                color: 'var(--text-muted)',
              }}
            >
              <p style={{ fontSize: '0.9rem' }}>
                开始和 {character?.name ?? '角色'} 对话吧
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                display: 'flex',
                flexDirection:
                  msg.role === 'user' ? 'row-reverse' : 'row',
                alignItems: 'flex-start',
                gap: '10px',
                marginBottom: '20px',
              }}
            >
              {/* 头像 */}
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  flexShrink: 0,
                  background:
                    msg.role === 'user'
                      ? 'var(--accent-primary)'
                      : 'var(--bg-tertiary)',
                  backgroundImage:
                    msg.role === 'assistant' && character?.avatar_path
                      ? `url(/api/v1/characters/${character.id}/avatar)`
                      : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: '0.8rem',
                }}
              >
                {msg.role === 'user' ? (
                  <User size={14} />
                ) : (
                  !character?.avatar_path && (
                    <Bot
                      size={14}
                      style={{ color: 'var(--accent-primary)' }}
                    />
                  )
                )}
              </div>

              {/* 气泡 */}
              <div
                style={{
                  maxWidth: '68%',
                  padding: '12px 16px',
                  borderRadius: '14px',
                  background:
                    msg.role === 'user'
                      ? 'var(--user-bubble)'
                      : 'var(--ai-bubble)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: '0.92rem',
                  lineHeight: 1.7,
                }}
              >
                {msg.role === 'assistant' ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </ReactMarkdown>
                ) : (
                  <p style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                )}
                {msg.streaming && (
                  <motion.span
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                    style={{
                      display: 'inline-block',
                      width: '2px',
                      height: '14px',
                      background: 'var(--accent-primary)',
                      marginLeft: '2px',
                      verticalAlign: 'text-bottom',
                    }}
                  />
                )}
              </div>
            </motion.div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* 输入框 */}
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
              ref={textareaRef}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="输入消息... (Enter 发送，Shift+Enter 换行)"
              rows={1}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                outline: 'none',
                resize: 'none',
                color: 'var(--text-primary)',
                fontSize: '0.92rem',
                lineHeight: 1.6,
                maxHeight: '144px',
                overflowY: 'auto',
                fontFamily: 'inherit',
              }}
            />
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={isStreaming ? stopStreaming : sendMessage}
              disabled={!isStreaming && !input.trim()}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isStreaming
                  ? 'rgba(248,113,113,0.15)'
                  : input.trim()
                      ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))'
                      : 'var(--bg-secondary)',
                border: isStreaming ? '1px solid var(--danger)' : 'none',
                color: isStreaming ? 'var(--danger)' : '#fff',
                cursor:
                  isStreaming || input.trim() ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
              }}
            >
              {isStreaming ? <Square size={14} /> : <Send size={14} />}
            </motion.button>
          </div>
          {activeConvId === null && (
            <p
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                marginTop: '8px',
                textAlign: 'center',
              }}
            >
              请先新建或选择一个对话
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
