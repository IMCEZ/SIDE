import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { Eye, EyeOff, Lock, Sparkles, Shield } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

interface FormData {
  password: string
  confirmPassword?: string
}

interface Particle {
  id: number
  x: number
  y: number
  size: number
  duration: number
  delay: number
}

const particles: Particle[] = Array.from({ length: 15 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 80 + 30,
  duration: Math.random() * 15 + 20,
  delay: Math.random() * 8,
}))

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const [hasUser, setHasUser] = useState<boolean | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>()

  useEffect(() => {
    fetch('/api/v1/auth/status')
      .then((res) => res.json())
      .then((data) => setHasUser(data.hasUser))
      .catch(() => setHasUser(true))
  }, [])

  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 500)
  }

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    setError('')

    try {
      if (!hasUser) {
        if (data.password !== data.confirmPassword) {
          setError('两次输入的密码不一致')
          triggerShake()
          setLoading(false)
          return
        }
        const res = await fetch('/api/v1/auth/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'admin', password: data.password }),
        })
        const json = await res.json()
        if (!res.ok) {
          setError(json.message || '设置失败')
          triggerShake()
          return
        }
        login(json.token)
        navigate('/characters')
      } else {
        const res = await fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'admin', password: data.password }),
        })
        const json = await res.json()
        if (!res.ok) {
          setError(json.message || '密码错误')
          triggerShake()
          return
        }
        login(json.token)
        navigate('/characters')
      }
    } catch {
      setError('无法连接到服务器，请确认 SIDE 后端已启动')
      triggerShake()
    } finally {
      setLoading(false)
    }
  }

  if (hasUser === null) {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-primary)',
        }}
      >
        <motion.div
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.95, 1, 0.95] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{
            fontSize: '1.5rem',
            fontWeight: 900,
            letterSpacing: '0.3em',
            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          SIDE
        </motion.div>
      </div>
    )
  }

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--bg-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      {/* 背景网格 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(124,106,247,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(124,106,247,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          pointerEvents: 'none',
        }}
      />

      {/* 背景粒子 */}
      {particles.map((p) => (
        <motion.div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: 'radial-gradient(circle, var(--accent-glow) 0%, transparent 70%)',
            filter: 'blur(30px)',
            pointerEvents: 'none',
          }}
          animate={{
            x: [0, 50, -30, 0],
            y: [0, -60, 30, 0],
            opacity: [0.2, 0.5, 0.15, 0.2],
            scale: [1, 1.2, 0.9, 1],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* 装饰光环 */}
      <motion.div
        style={{
          position: 'absolute',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          border: '1px solid rgba(124,106,247,0.1)',
          pointerEvents: 'none',
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        style={{
          position: 'absolute',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          border: '1px solid rgba(124,106,247,0.08)',
          pointerEvents: 'none',
        }}
        animate={{ rotate: -360 }}
        transition={{ duration: 45, repeat: Infinity, ease: 'linear' }}
      />

      {/* 登录卡片 */}
      <motion.div
        animate={shake ? { x: [-10, 10, -8, 8, -5, 5, 0] } : { x: 0 }}
        transition={{ duration: 0.5 }}
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: '420px',
          margin: '0 20px',
          background: 'var(--bg-glass)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid var(--border-color)',
          borderRadius: '24px',
          padding: '44px 36px',
          boxShadow: `
            0 8px 32px rgba(0,0,0,0.4),
            0 0 0 1px rgba(124,106,247,0.1),
            inset 0 1px 0 rgba(255,255,255,0.05)
          `,
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '8px',
            }}
          >
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity, repeatDelay: 3 }}
            >
              <Sparkles 
                size={32} 
                style={{ 
                  color: 'var(--accent-primary)',
                  filter: 'drop-shadow(0 0 12px var(--accent-glow))',
                }} 
              />
            </motion.div>
            <span
              style={{
                fontSize: '2.8rem',
                fontWeight: 900,
                letterSpacing: '0.25em',
                background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              SIDE
            </span>
          </motion.div>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          style={{
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '0.85rem',
            marginBottom: '32px',
            letterSpacing: '0.15em',
          }}
        >
          沉浸式 AI 对话体验
        </motion.p>

        {/* 提示信息 */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '14px 16px',
            background: 'rgba(124,106,247,0.08)',
            borderRadius: '12px',
            marginBottom: '24px',
            border: '1px solid rgba(124,106,247,0.15)',
          }}
        >
          <Shield size={18} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
          <div>
            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: '0.85rem',
                lineHeight: 1.5,
              }}
            >
              {hasUser ? (
                <>
                  默认密码为 <strong style={{ color: 'var(--accent-primary)' }}>123456</strong>，
                  您可以在设置中修改
                </>
              ) : (
                '首次使用，请设置登录密码'
              )}
            </p>
          </div>
        </motion.div>

        <form onSubmit={handleSubmit(onSubmit)}>
          {/* 密码输入框 */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            style={{ marginBottom: '16px' }}
          >
            <div style={{ position: 'relative' }}>
              <Lock
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
                type={showPassword ? 'text' : 'password'}
                placeholder={hasUser ? '请输入密码 (默认: 123456)' : '设置密码'}
                {...register('password', {
                  required: '请输入密码',
                  minLength: { value: 6, message: '密码至少 6 位' },
                })}
                style={{
                  width: '100%',
                  padding: '14px 48px',
                  background: 'var(--bg-secondary)',
                  border: `2px solid ${
                    errors.password ? 'var(--danger)' : 'var(--border-color)'
                  }`,
                  borderRadius: '12px',
                  color: 'var(--text-primary)',
                  fontSize: '0.95rem',
                  outline: 'none',
                  transition: 'all 0.2s',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: '4px',
                  transition: 'color 0.2s',
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && (
              <p
                style={{
                  color: 'var(--danger)',
                  fontSize: '0.8rem',
                  marginTop: '6px',
                  marginLeft: '4px',
                }}
              >
                {errors.password.message}
              </p>
            )}
          </motion.div>

          {/* 确认密码（仅首次设置时显示）*/}
          <AnimatePresence>
            {!hasUser && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{ marginBottom: '16px', overflow: 'hidden' }}
              >
                <div style={{ position: 'relative' }}>
                  <Lock
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
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="确认密码"
                    {...register('confirmPassword', {
                      validate: (value) =>
                        value === watch('password') || '两次输入的密码不一致',
                    })}
                    style={{
                      width: '100%',
                      padding: '14px 48px',
                      background: 'var(--bg-secondary)',
                      border: `2px solid ${
                        errors.confirmPassword
                          ? 'var(--danger)'
                          : 'var(--border-color)'
                      }`,
                      borderRadius: '12px',
                      color: 'var(--text-primary)',
                      fontSize: '0.95rem',
                      outline: 'none',
                      transition: 'all 0.2s',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    style={{
                      position: 'absolute',
                      right: '14px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      padding: '4px',
                      transition: 'color 0.2s',
                    }}
                  >
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p
                    style={{
                      color: 'var(--danger)',
                      fontSize: '0.8rem',
                      marginTop: '6px',
                      marginLeft: '4px',
                    }}
                  >
                    {errors.confirmPassword.message}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* 错误提示 */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                style={{
                  padding: '12px 16px',
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: '10px',
                  marginBottom: '20px',
                }}
              >
                <p
                  style={{
                    color: 'var(--danger)',
                    fontSize: '0.85rem',
                    textAlign: 'center',
                  }}
                >
                  {error}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 提交按钮 */}
          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: 1.02, boxShadow: '0 8px 25px rgba(124,106,247,0.4)' }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            style={{
              width: '100%',
              padding: '15px',
              background: loading
                ? 'var(--bg-tertiary)'
                : 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              border: 'none',
              borderRadius: '12px',
              color: '#fff',
              fontWeight: 700,
              fontSize: '1rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              boxShadow: loading ? 'none' : '0 4px 15px rgba(124,106,247,0.3)',
            }}
          >
            {loading ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                  style={{
                    width: '18px',
                    height: '18px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                  }}
                />
                处理中...
              </>
            ) : hasUser ? (
              '进入 SIDE'
            ) : (
              '设置密码并进入'
            )}
          </motion.button>
        </form>

        {/* 底部装饰 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          style={{
            marginTop: '28px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              height: '1px',
              background: 'linear-gradient(90deg, transparent, var(--border-color), transparent)',
              marginBottom: '16px',
            }}
          />
          <p
            style={{
              color: 'var(--text-muted)',
              fontSize: '0.75rem',
              letterSpacing: '0.05em',
            }}
          >
            安全 · 私密 · 本地优先
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}
