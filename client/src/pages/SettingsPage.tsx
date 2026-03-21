import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Check,
  Loader,
  Lock,
  Search,
  Server,
  Zap,
} from 'lucide-react'

type ActionMessage = {
  type: 'success' | 'error'
  text: string
}

type ProviderInfo = {
  id: string
  name: string
  provider: string
  defaultEndpoint: string
  requiresApiKey: boolean
  description: string
}

type ApiProfileResponse = {
  id: number
  provider: string
  baseUrl: string
  apiKeyMasked: string
  hasApiKey: boolean
  defaultModel: string
  enabled: boolean
  createdAt: number
}

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('side_token')
  return { Authorization: `Bearer ${token}` }
}

function parseErrorMessage(data: any, fallback: string): string {
  if (typeof data?.error === 'string' && data.error.trim()) return data.error
  if (typeof data?.message === 'string' && data.message.trim()) return data.message
  return fallback
}

export default function SettingsPage() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMsg, setPasswordMsg] = useState<ActionMessage | null>(null)

  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [loadingProfile, setLoadingProfile] = useState(false)

  const [selectedProviderId, setSelectedProviderId] = useState('')
  const [formProvider, setFormProvider] = useState('openai-compatible')
  const [formBaseUrl, setFormBaseUrl] = useState('')
  const [formApiKey, setFormApiKey] = useState('')
  const [formDefaultModel, setFormDefaultModel] = useState('')
  const [formEnabled, setFormEnabled] = useState(true)
  const [hasStoredApiKey, setHasStoredApiKey] = useState(false)

  const [saveLoading, setSaveLoading] = useState(false)
  const [saveMsg, setSaveMsg] = useState<ActionMessage | null>(null)

  const [testLoading, setTestLoading] = useState(false)
  const [testMsg, setTestMsg] = useState<ActionMessage | null>(null)

  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsMsg, setModelsMsg] = useState<ActionMessage | null>(null)
  const [modelList, setModelList] = useState<string[]>([])
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const [modelSearchText, setModelSearchText] = useState('')

  const filteredModelList = useMemo(() => {
    const q = modelSearchText.trim().toLowerCase()
    if (!q) return modelList
    return modelList.filter((m) => m.toLowerCase().includes(q))
  }, [modelList, modelSearchText])

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/api-configs/providers', { headers: getAuthHeaders() })
      if (!res.ok) return
      const data = (await res.json()) as ProviderInfo[]
      const openAICompatibleProviders = Array.isArray(data)
        ? data.filter((p) => p.provider === 'openai-compatible')
        : []
      setProviders(openAICompatibleProviders)
      setSelectedProviderId((prev) => prev || openAICompatibleProviders[0]?.id || '')
    } catch {
      return
    }
  }, [])

  const fetchCurrentProfile = async () => {
    setLoadingProfile(true)
    try {
      const res = await fetch('/api/v1/settings/api-profile/current', { headers: getAuthHeaders() })
      if (!res.ok) {
        setSaveMsg({ type: 'error', text: '加载 API 配置失败' })
        return
      }

      const data = (await res.json()) as ApiProfileResponse | null
      if (!data) {
        return
      }

      setFormProvider(data.provider || 'openai-compatible')
      setFormBaseUrl(data.baseUrl || '')
      setFormDefaultModel(data.defaultModel || '')
      setFormEnabled(Boolean(data.enabled))
      setHasStoredApiKey(Boolean(data.hasApiKey))
      setFormApiKey('')
    } catch {
      setSaveMsg({ type: 'error', text: '加载 API 配置失败' })
    } finally {
      setLoadingProfile(false)
    }
  }

  useEffect(() => {
    fetchProviders()
    fetchCurrentProfile()
  }, [fetchProviders])

  const handleSelectProvider = (p: ProviderInfo) => {
    setSelectedProviderId(p.id)
    setFormProvider('openai-compatible')
    setFormBaseUrl(p.defaultEndpoint || '')
    setSaveMsg(null)
    setTestMsg(null)
    setModelsMsg(null)
  }

  const handleSave = async () => {
    if (!formBaseUrl.trim()) {
      setSaveMsg({ type: 'error', text: '请填写 Base URL' })
      return
    }
    if (!formDefaultModel.trim()) {
      setSaveMsg({ type: 'error', text: '请填写默认模型' })
      return
    }

    setSaveLoading(true)
    setSaveMsg(null)
    try {
      const res = await fetch('/api/v1/settings/api-profile/current', {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: 'openai-compatible',
          baseUrl: formBaseUrl.trim(),
          apiKey: formApiKey.trim(),
          defaultModel: formDefaultModel.trim(),
          enabled: formEnabled,
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setSaveMsg({ type: 'error', text: parseErrorMessage(data, '保存失败') })
        return
      }

      setSaveMsg({ type: 'success', text: '保存成功' })
      setHasStoredApiKey(Boolean(data?.hasApiKey) || Boolean(formApiKey.trim()))
      setFormApiKey('')
    } catch {
      setSaveMsg({ type: 'error', text: '保存失败，请检查网络连接' })
    } finally {
      setSaveLoading(false)
    }
  }

  const handleTestConnection = async () => {
    if (!formBaseUrl.trim()) {
      setTestMsg({ type: 'error', text: '请填写 Base URL' })
      return
    }

    setTestLoading(true)
    setTestMsg(null)
    try {
      const res = await fetch('/api/v1/settings/api-profile/current/test', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: 'openai-compatible',
          baseUrl: formBaseUrl.trim(),
          apiKey: formApiKey.trim(),
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setTestMsg({ type: 'error', text: parseErrorMessage(data, '连接测试失败') })
        return
      }

      setTestMsg({ type: 'success', text: parseErrorMessage(data, '连接成功') })
    } catch {
      setTestMsg({ type: 'error', text: '连接测试失败，请检查网络连接' })
    } finally {
      setTestLoading(false)
    }
  }

  const handleFetchModelList = async () => {
    if (!formBaseUrl.trim()) {
      setModelsMsg({ type: 'error', text: '请填写 Base URL' })
      return
    }

    setModelsLoading(true)
    setModelsMsg(null)

    try {
      const res = await fetch('/api/v1/settings/api-profile/current/models', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: 'openai-compatible',
          baseUrl: formBaseUrl.trim(),
          apiKey: formApiKey.trim(),
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setModelsMsg({ type: 'error', text: parseErrorMessage(data, '获取模型列表失败') })
        return
      }

      const models = Array.isArray(data?.models)
        ? data.models.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
        : []

      setModelList(models)
      setShowModelDropdown(models.length > 0)
      setModelSearchText(formDefaultModel)
      setModelsMsg({ type: 'success', text: `获取成功，共 ${models.length} 个模型` })
    } catch {
      setModelsMsg({ type: 'error', text: '获取模型列表失败，请检查网络连接' })
    } finally {
      setModelsLoading(false)
    }
  }

  const handleChangePwd = async () => {
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: '两次密码不一致' })
      return
    }

    setPasswordMsg(null)
    try {
      const res = await fetch('/api/v1/auth/password', {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          oldPassword: currentPassword,
          newPassword,
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setPasswordMsg({ type: 'error', text: parseErrorMessage(data, '密码修改失败') })
        return
      }

      setPasswordMsg({ type: 'success', text: '密码修改成功' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch {
      setPasswordMsg({ type: 'error', text: '密码修改失败，请检查网络' })
    }
  }

  const showApiKeyOptionalTag = hasStoredApiKey

  return (
    <div style={{ padding: '32px', paddingBottom: '80px', maxWidth: '820px' }}>
      <div
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '18px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Lock size={18} style={{ color: 'var(--accent-primary)' }} />
          <h2 style={{ fontSize: '1.05rem', margin: 0, color: 'var(--text-primary)' }}>
            安全设置
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>当前密码</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              style={{
                width: '100%',
                marginTop: '6px',
                padding: '10px 12px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>新密码</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{
                width: '100%',
                marginTop: '6px',
                padding: '10px 12px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              确认新密码
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{
                width: '100%',
                marginTop: '6px',
                padding: '10px 12px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            />
          </div>

          {passwordMsg && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                fontSize: '0.85rem',
                color: passwordMsg.type === 'success' ? 'var(--success)' : 'var(--danger)',
              }}
            >
              {passwordMsg.text}
            </motion.div>
          )}

          <motion.button
            type="button"
            onClick={handleChangePwd}
            whileTap={{ scale: 0.98 }}
            style={{
              padding: '10px 20px',
              borderRadius: '10px',
              cursor: 'pointer',
              background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              border: 'none',
              color: '#fff',
              fontSize: '0.9rem',
              fontWeight: 700,
              marginTop: '4px',
            }}
          >
            修改密码
          </motion.button>
        </div>
      </div>

      <div
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
          <Zap size={18} style={{ color: 'var(--accent-primary)' }} />
          <h2 style={{ fontSize: '1.05rem', margin: 0, color: 'var(--text-primary)' }}>
            API 配置
          </h2>
        </div>

        {loadingProfile ? (
          <div
            style={{
              padding: '26px 0',
              color: 'var(--text-muted)',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
              style={{ marginRight: 8, display: 'inline-flex' }}
            >
              <Loader size={18} />
            </motion.span>
            加载中...
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '14px' }}>
              <div
                style={{
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary)',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Server size={14} />
                OpenAI-compatible 服务
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                  gap: '10px',
                }}
              >
                {providers.map((p) => {
                  const isSelected = selectedProviderId === p.id
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectProvider(p)}
                      style={{
                        padding: '12px 12px',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(16,163,127,0.12)' : 'var(--bg-tertiary)',
                        border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                        color: 'var(--text-primary)',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 900,
                          fontSize: '0.9rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                        }}
                      >
                        <span>{p.name}</span>
                        {isSelected && <Check size={16} style={{ color: 'var(--accent-primary)' }} />}
                      </div>
                      <div
                        style={{
                          marginTop: 6,
                          fontSize: '0.78rem',
                          color: 'var(--text-muted)',
                          lineHeight: 1.35,
                        }}
                      >
                        {p.description}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
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
              <input
                value={formProvider}
                readOnly
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  color: 'var(--text-muted)',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label
                style={{
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary)',
                  display: 'block',
                  marginBottom: '6px',
                }}
              >
                Base URL
              </label>
              <input
                value={formBaseUrl}
                onChange={(e) => setFormBaseUrl(e.target.value)}
                placeholder="https://api.openai.com/v1"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>API Key</label>
                {showApiKeyOptionalTag && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    （已保存，留空则不更新）
                  </span>
                )}
              </div>
              <div style={{ position: 'relative', marginTop: '6px' }}>
                <input
                  type={showApiKeyOptionalTag ? 'password' : 'text'}
                  value={formApiKey}
                  onChange={(e) => setFormApiKey(e.target.value)}
                  placeholder={showApiKeyOptionalTag ? '********' : 'sk-...'}
                  style={{
                    width: '100%',
                    padding: '10px 44px 10px 12px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '14px', position: 'relative' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'start' }}>
                <div>
                  <label
                    style={{
                      fontSize: '0.82rem',
                      color: 'var(--text-secondary)',
                      display: 'block',
                      marginBottom: '6px',
                    }}
                  >
                    默认模型
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      value={formDefaultModel}
                      onFocus={() => {
                        if (modelList.length > 0) setShowModelDropdown(true)
                      }}
                      onChange={(e) => {
                        const v = e.target.value
                        setFormDefaultModel(v)
                        setModelSearchText(v)
                        if (modelList.length > 0 && v.trim()) setShowModelDropdown(true)
                        if (!v.trim()) setShowModelDropdown(false)
                      }}
                      placeholder="输入默认模型"
                      style={{
                        width: '100%',
                        padding: '10px 44px 10px 12px',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '10px',
                        color: 'var(--text-primary)',
                        fontSize: '0.9rem',
                        outline: 'none',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: '50%',
                        right: 12,
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <Search size={16} />
                    </div>
                  </div>

                  {showModelDropdown && modelList.length > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: '100%',
                        marginTop: 8,
                        zIndex: 100,
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '10px',
                        maxHeight: 240,
                        overflowY: 'auto',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
                      }}
                    >
                      {filteredModelList.length === 0 ? (
                        <div style={{ padding: '12px', color: 'var(--text-muted)' }}>没有匹配项</div>
                      ) : (
                        filteredModelList.map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => {
                              setFormDefaultModel(m)
                              setModelSearchText(m)
                              setShowModelDropdown(false)
                            }}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '10px 12px',
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              color: 'var(--text-primary)',
                              fontWeight: 700,
                              fontSize: '0.88rem',
                              borderBottom: '1px solid rgba(255,255,255,0.06)',
                            }}
                          >
                            {m}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div style={{ paddingTop: 22 }}>
                  <motion.button
                    type="button"
                    onClick={handleFetchModelList}
                    whileTap={{ scale: 0.98 }}
                    disabled={modelsLoading}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '10px',
                      cursor: modelsLoading ? 'not-allowed' : 'pointer',
                      background: 'linear-gradient(135deg, rgba(66,133,244,0.95), rgba(16,163,127,0.95))',
                      border: 'none',
                      color: '#fff',
                      fontSize: '0.9rem',
                      fontWeight: 800,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {modelsLoading ? (
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                      >
                        <Loader size={18} />
                      </motion.span>
                    ) : (
                      '获取模型列表'
                    )}
                  </motion.button>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                <input
                  type="checkbox"
                  checked={formEnabled}
                  onChange={(e) => setFormEnabled(e.target.checked)}
                />
                启用该 API 配置
              </label>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <motion.button
                type="button"
                onClick={handleTestConnection}
                whileTap={{ scale: 0.98 }}
                disabled={testLoading}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  cursor: testLoading ? 'not-allowed' : 'pointer',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  fontWeight: 800,
                }}
              >
                {testLoading ? '测试中...' : '测试连接'}
              </motion.button>

              <motion.button
                type="button"
                onClick={handleSave}
                whileTap={{ scale: 0.98 }}
                disabled={saveLoading}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  cursor: saveLoading ? 'not-allowed' : 'pointer',
                  background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                  border: 'none',
                  color: '#fff',
                  fontSize: '0.9rem',
                  fontWeight: 800,
                }}
              >
                {saveLoading ? '保存中...' : '保存'}
              </motion.button>
            </div>

            <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
              {saveMsg && (
                <div style={{ color: saveMsg.type === 'success' ? 'var(--success)' : 'var(--danger)', fontSize: '0.85rem' }}>
                  {saveMsg.text}
                </div>
              )}
              {testMsg && (
                <div style={{ color: testMsg.type === 'success' ? 'var(--success)' : 'var(--danger)', fontSize: '0.85rem' }}>
                  {testMsg.text}
                </div>
              )}
              {modelsMsg && (
                <div style={{ color: modelsMsg.type === 'success' ? 'var(--success)' : 'var(--danger)', fontSize: '0.85rem' }}>
                  {modelsMsg.text}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
