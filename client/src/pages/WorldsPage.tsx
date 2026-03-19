import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, BookOpen } from 'lucide-react'

interface WorldBook {
  id: number
  name: string
  created_at: number
  entry_count?: number
}

export default function WorldsPage() {
  const [worlds, setWorlds] = useState<WorldBook[]>([])
  const token = localStorage.getItem('side_token')
  const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}

  const fetchWorlds = async () => {
    const res = await fetch('/api/v1/worlds', { headers })
    if (res.ok) setWorlds(await res.json())
  }

  useEffect(() => {
    fetchWorlds()
  }, [])

  const handleImport = async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch('/api/v1/worlds/import', {
      method: 'POST',
      headers,
      body: form,
    })
    if (res.ok) fetchWorlds()
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('确认删除该世界书？')) return
    await fetch(`/api/v1/worlds/${id}`, { method: 'DELETE', headers })
    fetchWorlds()
  }

  return (
    <div style={{ padding: '32px', paddingBottom: '80px' }}>
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
          世界书
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
          <Plus size={16} /> 导入世界书
          <input
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={(e) =>
              e.target.files?.[0] && handleImport(e.target.files[0])
            }
          />
        </label>
      </div>

      {worlds.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: 'var(--text-muted)',
          }}
        >
          <BookOpen
            size={40}
            style={{ margin: '0 auto 12px', opacity: 0.4 }}
          />
          <p>暂无世界书，点击右上角导入</p>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {worlds.map((w, i) => (
            <motion.div
              key={w.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                background: 'var(--bg-secondary)',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                }}
              >
                <BookOpen
                  size={20}
                  style={{ color: 'var(--accent-primary)' }}
                />
                <div>
                  <p
                    style={{
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {w.name}
                  </p>
                  <p
                    style={{
                      fontSize: '0.78rem',
                      color: 'var(--text-muted)',
                      marginTop: '2px',
                    }}
                  >
                    {new Date(w.created_at).toLocaleDateString('zh-CN')}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleDelete(w.id)}
                  style={{
                    padding: '7px',
                    borderRadius: '8px',
                    background: 'transparent',
                    border: '1px solid var(--border-color)',
                    color: 'var(--danger)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <Trash2 size={14} />
                </motion.button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
