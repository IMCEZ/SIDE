import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Palette, Key, Info, Plus, Check, Trash2, Zap } from 'lucide-react'

const THEMES = [
  { id: 'theme-midnight', name: '午夜', preview: '#7c6af7' },
  { id: 'theme-abyss', name: '深渊', preview: '#06b6d4' },
  { id: 'theme-rose', name: '蔷薇', preview: '#f43f5e' },
  { id: 'theme-forest', name: '幽林', preview: '#10b981' },
  { id: 'theme-light', name: '晴空', preview: '#6366f1' },
]

const PROVIDERS = [
  'openai',
  'claude',
  'gemini',
  'ollama',
  'openrouter',
  'custom',
]

interface ApiConfig {
  id: number
  name: string
  provider: string
  endpoint: string
  model: string
  is_active: number
}

type Tab = 'theme' | 'api' | 'security' | 'about'

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('theme')
  const [currentTheme, setCurrentTheme] = useState(
    localStorage.getItem('side_theme') || 'theme-midnight',
  )
  const [configs, setConfigs] = useState<ApiConfig[]>([])
  const [showAddApi, setShowAddApi] = useState(false)
  const [apiForm, setApiForm] = useState({
    name: '',
    provider: 'openai',
    endpoint: '',
    apiKey: '',
    model: '',
  })
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdMsg, setPwdMsg] = useState('')

  const token = localStorage.getItem('side_token')
  const headers: HeadersInit = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'Content-Type': 'application/json',
  }

  const fetchConfigs = async () => {
    const res = await fetch('/api/v1/api-configs', { headers })
    if (res.ok) setConfigs(await res.json())
  }

  useEffect(() => {
    fetchConfigs()
  }, [])

  const applyTheme = (id: string) => {
    setCurrentTheme(id)
    document.documentElement.setAttribute('data-theme', id)
    localStorage.setItem('side_theme', id)
  }

  const handleAddApi = async () => {
    const res = await fetch('/api/v1/api-configs', {
      method: 'POST',
      headers,
      body: JSON.stringify(apiForm),
    })
    if (res.ok) {
      setShowAddApi(false)
      setApiForm({
        name: '',
        provider: 'openai',
        endpoint: '',
        apiKey: '',
        model: '',
      })
      fetchConfigs()
    }
  }

  const handleActivate = async (id: number) => {
    await fetch(`/api/v1/api-configs/${id}/activate`, {
      method: 'PUT',
      headers,
    })
    fetchConfigs()
  }

  const handleDeleteApi = async (id: number) => {
    if (!window.confirm('确认删除该配置？')) return
    await fetch(`/api/v1/api-configs/${id}`, { method: 'DELETE', headers })
    fetchConfigs()
  }

  const handleChangePwd = async () => {
    if (newPwd !== confirmPwd) {
      setPwdMsg('两次密码不一致')
      return
    }
    const res = await fetch('/api/v1/auth/password', {
      method: 'PUT',
      headers,
      body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd }),
    })
    setPwdMsg(res.ok ? '密码修改成功' : '旧密码错误')
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'theme', label: '主题', icon: <Palette size={16} /> },
    { key: 'api', label: 'API 配置', icon: <Zap size={16} /> },
    { key: 'security', label: '安全', icon: <Key size={16} /> },
    { key: 'about', label: '关于', icon: <Info size={16} /> },
  ]

  return (
    <div style={{ padding: '32px', paddingBottom: '80px', maxWidth: '760px' }}>
      <h1
        style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '24px',
        }}
      >
        设置
      </h1>

      {/* Tab 导航 */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '28px',
          flexWrap: 'wrap',
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '10px',
              cursor: 'pointer',
              background:
                tab === t.key
                  ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))'
                  : 'var(--bg-secondary)',
              border: `1px solid ${
                tab === t.key ? 'transparent' : 'var(--border-color)'
              }`,
              color:
                tab === t.key ? '#fff' : 'var(--text-secondary)',
              fontWeight: tab === t.key ? 600 : 400,
              fontSize: '0.88rem',
            }}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* 主题 */}
      {tab === 'theme' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <p
            style={{
              color: 'var(--text-secondary)',
              marginBottom: '16px',
            }}
          >
            选择界面主题
          </p>
          <div
            style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => applyTheme(t.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '16px 20px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  background:
                    currentTheme === t.id
                      ? 'rgba(124,106,247,0.12)'
                      : 'var(--bg-secondary)',
                  border: `2px solid ${
                    currentTheme === t.id
                      ? 'var(--accent-primary)'
                      : 'var(--border-color)'
                  }`,
                  transition: 'all 0.2s',
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: t.preview,
                  }}
                />
                <span
                  style={{
                    fontSize: '0.82rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {t.name}
                </span>
                {currentTheme === t.id && (
                  <Check
                    size={14}
                    style={{ color: 'var(--accent-primary)' }}
                  />
                )}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* API 配置 */}
      {tab === 'api' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}
          >
            <p style={{ color: 'var(--text-secondary)' }}>
              管理 AI 接口配置
            </p>
            <button
              onClick={() => setShowAddApi(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '10px',
                cursor: 'pointer',
                background:
                  'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                border: 'none',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.85rem',
              }}
            >
              <Plus size={14} /> 新增配置
            </button>
          </div>

          {configs.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px',
                color: 'var(--text-muted)',
              }}
            >
              <Zap
                size={32}
                style={{ margin: '0 auto 12px', opacity: 0.4 }}
              />
              <p>暂无 API 配置，请点击新增</p>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              {configs.map((cfg) => (
                <div
                  key={cfg.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 18px',
                    borderRadius: '12px',
                    background: 'var(--bg-secondary)',
                    border: `1px solid ${
                      cfg.is_active
                        ? 'var(--accent-primary)'
                        : 'var(--border-color)'
                    }`,
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                        }}
                      >
                        {cfg.name}
                      </span>
                      {cfg.is_active === 1 && (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            padding: '2px 8px',
                            borderRadius: '20px',
                            background: 'rgba(74,222,128,0.15)',
                            color: 'var(--success)',
                            fontWeight: 600,
                          }}
                        >
                          使用中
                        </span>
                      )}
                    </div>
                    <p
                      style={{
                        fontSize: '0.8rem',
                        color: 'var(--text-muted)',
                        marginTop: '2px',
                      }}
                    >
                      {cfg.provider} · {cfg.model || '未设置模型'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {cfg.is_active !== 1 && (
                      <button
                        onClick={() => handleActivate(cfg.id)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          background: 'transparent',
                          border: '1px solid var(--accent-primary)',
                          color: 'var(--accent-primary)',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                        }}
                      >
                        激活
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteApi(cfg.id)}
                      style={{
                        padding: '6px 8px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        background: 'transparent',
                        border: '1px solid var(--border-color)',
                        color: 'var(--danger)',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 新增 API 弹窗 */}
          {showAddApi && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 200,
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                  background: 'var(--bg-secondary)',
                  borderRadius: '16px',
                  border: '1px solid var(--border-color)',
                  padding: '28px',
                  width: '100%',
                  maxWidth: '440px',
                  margin: '0 16px',
                }}
              >
                <h3
                  style={{
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    marginBottom: '20px',
                  }}
                >
                  新增 API 配置
                </h3>

                {[
                  { label: '配置名称', key: 'name', placeholder: '例：我的 GPT-4' },
                  { label: 'API Key', key: 'apiKey', placeholder: 'sk-...' },
                  { label: '模型名称', key: 'model', placeholder: '例：gpt-4o' },
                  {
                    label: 'Endpoint（可选）',
                    key: 'endpoint',
                    placeholder: 'https://api.openai.com/v1',
                  },
                ].map((field) => (
                  <div key={field.key} style={{ marginBottom: '14px' }}>
                    <label
                      style={{
                        fontSize: '0.82rem',
                        color: 'var(--text-secondary)',
                        display: 'block',
                        marginBottom: '6px',
                      }}
                    >
                      {field.label}
                    </label>
                    <input
                      value={apiForm[field.key as keyof typeof apiForm]}
                      onChange={(e) =>
                        setApiForm((prev) => ({
                          ...prev,
                          [field.key]: e.target.value,
                        }))
                      }
                      placeholder={field.placeholder}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                        fontSize: '0.9rem',
                        outline: 'none',
                      }}
                    />
                  </div>
                ))}

                <div style={{ marginBottom: '20px' }}>
                  <label
                    style={{
                      fontSize: '0.82rem',
                      color: 'var(--text-secondary)',
                      display: 'block',
                      marginBottom: '6px',
                    }}
                  >
                    Provider
                  </label>
                  <select
                    value={apiForm.provider}
                    onChange={(e) =>
                      setApiForm((prev) => ({
                        ...prev,
                        provider: e.target.value,
                      }))
                    }
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem',
                      outline: 'none',
                    }}
                  >
                    {PROVIDERS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '10px',
                    justifyContent: 'flex-end',
                  }}
                >
                  <button
                    onClick={() => setShowAddApi(false)}
                    style={{
                      padding: '9px 18px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: 'transparent',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.88rem',
                    }}
                  >
                    取消
                  </button>
                  <button
                    onClick={handleAddApi}
                    style={{
                      padding: '9px 18px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background:
                        'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                      border: 'none',
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: '0.88rem',
                    }}
                  >
                    保存
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </motion.div>
      )}

      {/* 安全 */}
      {tab === 'security' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ maxWidth: '380px' }}
        >
          <p
            style={{
              color: 'var(--text-secondary)',
              marginBottom: '20px',
            }}
          >
            修改登录密码
          </p>
          {[
            { label: '当前密码', value: oldPwd, setter: setOldPwd },
            { label: '新密码', value: newPwd, setter: setNewPwd },
            { label: '确认新密码', value: confirmPwd, setter: setConfirmPwd },
          ].map((field) => (
            <div key={field.label} style={{ marginBottom: '14px' }}>
              <label
                style={{
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary)',
                  display: 'block',
                  marginBottom: '6px',
                }}
              >
                {field.label}
              </label>
              <input
                type="password"
                value={field.value}
                onChange={(e) => field.setter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
            </div>
          ))}
          {pwdMsg && (
            <p
              style={{
                fontSize: '0.85rem',
                marginBottom: '12px',
                color: pwdMsg.includes('成功')
                  ? 'var(--success)'
                  : 'var(--danger)',
              }}
            >
              {pwdMsg}
            </p>
          )}
          <button
            onClick={handleChangePwd}
            style={{
              padding: '10px 24px',
              borderRadius: '10px',
              cursor: 'pointer',
              background:
                'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              border: 'none',
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.9rem',
            }}
          >
            确认修改
          </button>
        </motion.div>
      )}

      {/* 关于 */}
      {tab === 'about' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div
            style={{
              padding: '28px',
              borderRadius: '16px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div
              style={{
                fontSize: '2rem',
                fontWeight: 900,
                letterSpacing: '0.3em',
                marginBottom: '8px',
                background:
                  'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                display: 'inline-block',
              }}
            >
              SIDE
            </div>
            <p
              style={{
                color: 'var(--text-muted)',
                fontSize: '0.82rem',
                marginBottom: '16px',
              }}
            >
              v1.0.0
            </p>
            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: '0.9rem',
                lineHeight: 1.7,
                marginBottom: '16px',
              }}
            >
              SIDE 是一个现代化、独立运行的 AI 对话前端，兼容 SillyTavern 数据格式，
              致力于提供更干净的代码架构和更沉浸的对话体验。
            </p>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              style={{
                color: 'var(--accent-primary)',
                fontSize: '0.88rem',
                textDecoration: 'none',
              }}
            >
              GitHub 仓库 →
            </a>
          </div>
        </motion.div>
      )}
    </div>
  )
}
