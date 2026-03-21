import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, MessageCircle, Trash2, Search, Users, Sparkles } from 'lucide-react'
import type { ApiWarning } from '@/api/apiErrorTypes'
import { chatApi } from '@/api/services/chat'
import { useImportCharacter } from '@/hooks'
import { RichMessageContent } from '@/components/ui'

interface Character {
  id: number
  name: string
  avatarPath: string | null
  createdAt: number | null
  updatedAt?: number | null
  description?: string
  warnings?: ApiWarning[]
}

export default function CharactersPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [characters, setCharacters] = useState<Character[]>([])
  const [importing, setImporting] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [importSuccess, setImportSuccess] = useState<string | null>(null)
  const [importWarnings, setImportWarnings] = useState<ApiWarning[]>([])
  const [importError, setImportError] = useState<string | null>(null)

  const token = localStorage.getItem('side_token')
  const headers: HeadersInit = useMemo(() => {
    const h: Record<string, string> = {}
    if (token) h.Authorization = `Bearer ${token}`
    return h
  }, [token])

  const importMutation = useImportCharacter()
  const fetchSeq = useRef(0)

  const fetchCharacters = useCallback(
    async (q = '') => {
      const seq = ++fetchSeq.current
      const res = await fetch(`/api/v1/characters?search=${encodeURIComponent(q)}`, { headers })
      if (!res.ok) return
      const list = (await res.json()) as Array<{
        id: number
        name: string
        avatarPath: string | null
        createdAt: number | null
      }>
      if (fetchSeq.current !== seq) return

      // 先展示基本信息（列表接口可能不包含 description/updatedAt）
      setCharacters(list as Character[])

      // 补齐 updatedAt + description（最小增强满足 UI 要求）
      try {
        const details = await Promise.all(
          list.map(async (c) => {
            const r = await fetch(`/api/v1/characters/${c.id}`, { headers })
            if (!r.ok) return null
            return (await r.json()) as any
          })
        )

        if (fetchSeq.current !== seq) return

        setCharacters(
          list.map((c) => {
            const d = details.find((x) => x?.id === c.id)
            const description =
              d?.data?.description ??
              d?.data?.personality ??
              d?.data?.scenario ??
              undefined
            return {
              ...c,
              updatedAt: d?.updatedAt ?? null,
              description: typeof description === 'string' ? description : undefined,
            } as Character
          })
        )
      } catch {
        // 忽略详情补齐失败：不影响列表基础展示
      }
    },
    [headers]
  )

  useEffect(() => {
    fetchCharacters()
  }, [fetchCharacters])

  const handleImport = async (file: File) => {
    if (!file) return
    if (importMutation.isPending) return

    setImporting(true)
    setImportSuccess(null)
    setImportWarnings([])
    setImportError(null)
    try {
      const result = await importMutation.mutateAsync(file)

      if (result?.warnings?.length) {
        setImportWarnings(result.warnings)
        setImportSuccess('导入成功（有警告）')
      } else {
        setImportSuccess('导入成功')
      }

      // 导入成功后刷新列表（包含 updatedAt/description 补齐）
      await fetchCharacters(search)
    } catch (e: any) {
      const payload = e?.response?.data
      setImportError(payload?.error || payload?.message || (e?.message ? String(e.message) : '导入失败'))
    } finally {
      setImporting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('确认删除该角色？')) return
    await fetch(`/api/v1/characters/${id}`, { method: 'DELETE', headers })
    fetchCharacters(search)
  }

  const handleStartChat = async (characterId: number) => {
    try {
      const session = await chatApi.openSessionByCharacter(characterId)
      navigate(`/chat/${characterId}?sessionId=${session.id}`)
    } catch {
      alert('创建或打开会话失败')
    }
  }

  return (
    <div style={{ padding: '32px', paddingBottom: '80px' }}>
      {/* 头部 */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '28px',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '1.8rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              marginBottom: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <Users size={28} style={{ color: 'var(--accent-primary)' }} />
            我的角色
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            共 {characters.length} 个角色
          </p>
        </div>
        <motion.label
          whileHover={{ scale: 1.02, boxShadow: '0 4px 20px rgba(124,106,247,0.3)' }}
          whileTap={{ scale: 0.98 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 20px',
            borderRadius: '12px',
            cursor: 'pointer',
            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.9rem',
            boxShadow: '0 2px 10px rgba(124,106,247,0.2)',
          }}
        >
          {importing ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              style={{
                width: '16px',
                height: '16px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff',
                borderRadius: '50%',
              }}
            />
          ) : (
            <Plus size={18} />
          )}
          {importing ? '导入中...' : '导入角色卡'}
          <input
            type="file"
            accept=".png,.json"
            style={{ display: 'none' }}
            onChange={(e) =>
              e.target.files?.[0] && handleImport(e.target.files[0])
            }
          />
        </motion.label>
      </motion.div>

      {/* 导入结果提示 */}
      {(importSuccess || importWarnings.length > 0 || importError) && (
        <div
          style={{
            marginBottom: 20,
            padding: '12px 16px',
            borderRadius: 12,
            border: '1px solid var(--border-color)',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
          }}
        >
          {importError && (
            <div style={{ color: 'var(--danger)', fontSize: '0.9rem', marginBottom: 8 }}>
              {importError}
            </div>
          )}
          {importSuccess && !importError && (
            <div style={{ color: 'var(--success)', fontSize: '0.9rem', marginBottom: 8 }}>
              {importSuccess}
            </div>
          )}
          {importWarnings.length > 0 && (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--warning)' }}>
                警告（已尽量导入）
              </div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {importWarnings.map((w, idx) => (
                  <li key={`${w.code ?? 'w'}-${idx}`} style={{ marginBottom: 4 }}>
                    {w.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 搜索 */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{
          position: 'relative',
          marginBottom: '28px',
        }}
      >
        <Search
          size={18}
          style={{
            position: 'absolute',
            left: '16px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)',
          }}
        />
        <input
          value={search}
          onChange={(e) => {
            const value = e.target.value
            setSearch(value)
            fetchCharacters(value)
          }}
          placeholder="搜索角色..."
          style={{
            width: '100%',
            maxWidth: '400px',
            padding: '14px 16px 14px 48px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            color: 'var(--text-primary)',
            fontSize: '0.95rem',
            outline: 'none',
            transition: 'all 0.2s',
          }}
        />
      </motion.div>

      {/* 拖拽区域 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const f = e.dataTransfer.files[0]
          if (f) handleImport(f)
        }}
        style={{
          minHeight: characters.length === 0 ? '400px' : 'auto',
          border: dragOver ? '2px dashed var(--accent-primary)' : '2px dashed transparent',
          borderRadius: '20px',
          transition: 'all 0.2s',
          background: dragOver ? 'rgba(124,106,247,0.05)' : 'transparent',
          padding: dragOver ? '20px' : '0',
        }}
      >
        {/* 空状态 */}
        {characters.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              padding: '80px 20px',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: '100px',
                height: '100px',
                borderRadius: '24px',
                background: 'var(--bg-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px dashed var(--border-color)',
              }}
            >
              <Sparkles size={40} style={{ color: 'var(--accent-primary)', opacity: 0.6 }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: '1.1rem',
                  marginBottom: '8px',
                }}
              >
                还没有角色
              </p>
              <p
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '0.85rem',
                }}
              >
                拖拽角色卡文件到此处，或点击右上角导入
              </p>
              <p
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '0.75rem',
                  marginTop: '8px',
                  opacity: 0.7,
                }}
              >
                支持 PNG（SillyTavern 格式）和 JSON
              </p>
            </div>
          </motion.div>
        )}

        {/* 角色网格 */}
        {characters.length > 0 && (
          <motion.div
            style={{
              display: 'grid',
              gap: '20px',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            }}
          >
            <AnimatePresence>
              {characters.map((char, i) => (
                <motion.div
                  key={char.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ 
                    y: -6, 
                    boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
                  }}
                  style={{
                    background: 'var(--bg-secondary)',
                    borderRadius: '18px',
                    border: '1px solid var(--border-color)',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                  }}
                >
                  {/* 头像 */}
                  <div
                    style={{
                      height: '160px',
                      background: char.avatarPath
                        ? `url(/api/v1/characters/${char.id}/avatar)`
                        : 'linear-gradient(135deg, rgba(124,106,247,0.15), rgba(139,92,246,0.1))',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center top',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                    }}
                  >
                    {!char.avatarPath && (
                      <span
                        style={{
                          fontSize: '3rem',
                          fontWeight: 700,
                          color: 'var(--accent-primary)',
                          opacity: 0.6,
                        }}
                      >
                        {char.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    {/* 渐变遮罩 */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: '60px',
                        background: 'linear-gradient(to top, var(--bg-secondary), transparent)',
                      }}
                    />
                  </div>

                  {/* 信息 */}
                  <div style={{ padding: '16px' }}>
                    <h3
                      style={{
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        marginBottom: '12px',
                        fontSize: '1rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {char.name}
                    </h3>
                    <div style={{ marginBottom: 10, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      更新时间：{' '}
                      {char.updatedAt ? new Date(char.updatedAt).toLocaleDateString('zh-CN') : ''}
                    </div>
                    <div
                      style={{
                        marginBottom: 12,
                        color: 'var(--text-secondary)',
                        fontSize: '0.82rem',
                        lineHeight: 1.5,
                        maxHeight: 42,
                        overflow: 'hidden',
                      }}
                    >
                      {char.description ? (
                        <RichMessageContent content={char.description} />
                      ) : (
                        '暂无描述'
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => void handleStartChat(char.id)}
                        style={{
                          flex: 1,
                          padding: '10px',
                          borderRadius: '10px',
                          border: 'none',
                          background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                          color: '#fff',
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 8px rgba(124,106,247,0.3)',
                        }}
                      >
                        <MessageCircle size={14} /> 开始对话
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05, background: 'rgba(239,68,68,0.1)' }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleDelete(char.id)}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '10px',
                          background: 'transparent',
                          border: '1px solid var(--border-color)',
                          color: 'var(--danger)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s',
                        }}
                      >
                        <Trash2 size={14} />
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
