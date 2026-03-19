import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { Eye, EyeOff, Lock } from 'lucide-react'
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

const particles: Particle[] = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 60 + 20,
  duration: Math.random() * 10 + 15,
  delay: Math.random() * 5,
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
      .catch(() => setHasUser(false))
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
          body: JSON.stringify({ password: data.password }),
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
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{
            fontSize: '1.5rem',
            fontWeight: 900,
            letterSpacing: '0.3em',
            color: 'var(--accent-primary)',
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
            background: 'var(--accent-glow)',
            filter: 'blur(20px)',
            pointerEvents: 'none',
          }}
          animate={{
            x: [0, 30, -20, 0],
            y: [0, -40, 20, 0],
            opacity: [0.3, 0.6, 0.2, 0.3],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* 登录卡片 */}
      <motion.div
        animate={shake ? { x: [-10, 10, -8, 8, -5, 5, 0] } : { x: 0 }}
        transition={{ duration: 0.5 }}
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: '400px',
          margin: '0 16px',
          background: 'var(--bg-glass)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid var(--border-color)',
          borderRadius: '20px',
          padding: '40px 32px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            style={{
              fontSize: '3rem',
              fontWeight: 900,
              letterSpacing: '0.4em',
              background:
                'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              display: 'inline-block',
            }}
          >
            SIDE
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
            letterSpacing: '0.1em',
          }}
        >
          沉浸式 AI 对话体验
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          style={{
            textAlign: 'center',
            color: 'var(--text-secondary)',
            fontSize: '0.9rem',
            marginBottom: '24px',
          }}
        >
          {hasUser ? '请输入密码' : '首次使用，请设置登录密码'}
        </motion.p>

        <form onSubmit={handleSubmit(onSubmit)}>
          {/* 密码输入框 */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ position: 'relative' }}>
              <Lock
                size={16}
                style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="密码"
                {...register('password', {
                  required: '请输入密码',
                  minLength: { value: 6, message: '密码至少 6 位' },
                })}
                style={{
                  width: '100%',
                  padding: '12px 44px',
                  background: 'var(--bg-secondary)',
                  border: `1px solid ${
                    errors.password ? 'var(--danger)' : 'var(--border-color)'
                  }`,
                  borderRadius: '10px',
                  color: 'var(--text-primary)',
                  fontSize: '0.95rem',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: '4px',
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && (
              <p
                style={{
                  color: 'var(--danger)',
                  fontSize: '0.8rem',
                  marginTop: '4px',
                }}
              >
                {errors.password.message}
              </p>
            )}
          </div>

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
                    size={16}
                    style={{
                      position: 'absolute',
                      left: '14px',
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
                      padding: '12px 44px',
                      background: 'var(--bg-secondary)',
                      border: `1px solid ${
                        errors.confirmPassword
                          ? 'var(--danger)'
                          : 'var(--border-color)'
                      }`,
                      borderRadius: '10px',
                      color: 'var(--text-primary)',
                      fontSize: '0.95rem',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      padding: '4px',
                    }}
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p
                    style={{
                      color: 'var(--danger)',
                      fontSize: '0.8rem',
                      marginTop: '4px',
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
              <motion.p
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                style={{
                  color: 'var(--danger)',
                  fontSize: '0.85rem',
                  marginBottom: '16px',
                  textAlign: 'center',
                }}
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          {/* 提交按钮 */}
          <motion.button
            type="submit"
            disabled={loading}
            whileTap={{ scale: 0.97 }}
            style={{
              width: '100%',
              padding: '13px',
              background: loading
                ? 'var(--bg-tertiary)'
                : 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              border: 'none',
              borderRadius: '10px',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.95rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'opacity 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
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
                    width: '16px',
                    height: '16px',
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
      </motion.div>
    </div>
  )
}
