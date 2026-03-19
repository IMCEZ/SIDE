import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, MessageCircle, Trash2, Search, User } from 'lucide-react'

interface Character {
  id: number
  name: string
  avatar_path: string | null
  created_at: number
  description?: string
}

export default function CharactersPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [characters, setCharacters] = useState<Character[]>([])
  const [importing, setImporting] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const token = localStorage.getItem('side_token')
  const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}

  const fetchCharacters = async (q = '') => {
    const res = await fetch(
      `/api/v1/characters?search=${encodeURIComponent(q)}`,
      { headers },
    )
    if (res.ok) {
      const data = await res.json()
      setCharacters(data)
    }
  }

  useEffect(() => {
    fetchCharacters()
  }, [])

  const handleImport = async (file: File) => {
    if (!file) return
    setImporting(true)
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch('/api/v1/characters/import', {
        method: 'POST',
        headers,
        body: form,
      })
      if (res.ok) fetchCharacters(search)
    } finally {
      setImporting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('确认删除该角色？')) return
    await fetch(`/api/v1/characters/${id}`, { method: 'DELETE', headers })
    fetchCharacters(search)
  }

  return (
    <div style={{ padding: '32px', paddingBottom: '80px' }}>
      {/* 顶部 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
        }}
      >
        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
          }}
        >
          我的角色
        </h1>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '10px',
            cursor: 'pointer',
            background:
              'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.9rem',
          }}
        >
          <Plus size={16} />
          导入角色卡
          <input
            type="file"
            accept=".png,.json"
            style={{ display: 'none' }}
            onChange={(e) =>
              e.target.files?.[0] && handleImport(e.target.files[0])
            }
          />
        </label>
      </div>

      {/* 搜索 */}
      <div
        style={{
          position: 'relative',
          marginBottom: '24px',
          maxWidth: '360px',
        }}
      >
        <Search
          size={16}
          style={{
            position: 'absolute',
            left: '12px',
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
            padding: '10px 12px 10px 38px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            color: 'var(--text-primary)',
            fontSize: '0.9rem',
            outline: 'none',
          }}
        />
      </div>

      {/* 拖拽区（无角色时显示） */}
      {characters.length === 0 && (
        <label
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
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            padding: '60px 20px',
            borderRadius: '16px',
            cursor: 'pointer',
            border: `2px dashed ${
              dragOver ? 'var(--accent-primary)' : 'var(--border-color)'
            }`,
            background: dragOver
              ? 'rgba(124,106,247,0.05)'
              : 'transparent',
            transition: 'all 0.2s',
          }}
        >
          <User size={40} style={{ color: 'var(--text-muted)' }} />
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: '0.95rem',
            }}
          >
            拖拽角色卡文件到此处，或点击导入
          </p>
          <p
            style={{
              color: 'var(--text-muted)',
              fontSize: '0.8rem',
            }}
          >
            支持 PNG（SillyTavern 格式）和 JSON
          </p>
          <input
            type="file"
            accept=".png,.json"
            style={{ display: 'none' }}
            onChange={(e) =>
              e.target.files?.[0] && handleImport(e.target.files[0])
            }
          />
        </label>
      )}

      {/* 角色网格 */}
      <motion.div
        style={{
          display: 'grid',
          gap: '16px',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        }}
      >
        {characters.map((char, i) => (
          <motion.div
            key={char.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileHover={{ y: -4 }}
            style={{
              background: 'var(--bg-secondary)',
              borderRadius: '14px',
              border: '1px solid var(--border-color)',
              overflow: 'hidden',
              cursor: 'pointer',
              transition: 'border-color 0.2s',
            }}
          >
            {/* 头像 */}
            <div
              style={{
                height: '140px',
                background: 'var(--bg-tertiary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2.5rem',
                fontWeight: 700,
                color: 'var(--accent-primary)',
                backgroundImage: char.avatar_path
                  ? `url(/api/v1/characters/${char.id}/avatar)`
                  : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center top',
              }}
            >
              {!char.avatar_path && char.name.charAt(0).toUpperCase()}
            </div>

            {/* 信息 */}
            <div style={{ padding: '12px' }}>
              <p
                style={{
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '8px',
                  fontSize: '0.95rem',
                }}
              >
                {char.name}
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate(`/chat/${char.id}`)}
                  style={{
                    flex: 1,
                    padding: '7px',
                    borderRadius: '8px',
                    border: 'none',
                    background:
                      'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                  }}
                >
                  <MessageCircle size={13} /> 对话
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleDelete(char.id)}
                  style={{
                    padding: '7px 10px',
                    borderRadius: '8px',
                    background: 'transparent',
                    border: '1px solid var(--border-color)',
                    color: 'var(--danger)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <Trash2 size={13} />
                </motion.button>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {importing && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
          }}
        >
          <div
            style={{
              color: 'var(--accent-primary)',
              fontSize: '1rem',
              fontWeight: 600,
            }}
          >
            正在导入...
          </div>
        </div>
      )}
    </div>
  )
}
