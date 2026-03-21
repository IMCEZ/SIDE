import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuthStore } from '@/stores/authStore'

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, login, logout, initAuth } = useAuthStore()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const verify = async () => {
      initAuth()
      const storedToken = localStorage.getItem('side_token')

      if (!storedToken) {
        setChecking(false)
        return
      }

      try {
        const res = await fetch('/api/v1/auth/verify', {
          headers: { Authorization: `Bearer ${storedToken}` },
        })

        if (res.ok) {
          login(storedToken)
        } else if (res.status === 404) {
          // verify 接口不存在，直接信任本地 token
          login(storedToken)
        } else {
          logout()
        }
      } catch (e) {
        // 网络错误，信任本地 token
        if (storedToken) login(storedToken)
      } finally {
        setChecking(false)
      }
    }
    verify()
  }, [initAuth, login, logout])

  if (checking) {
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
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <motion.div
            style={{
              fontSize: '1.8rem',
              fontWeight: 900,
              letterSpacing: '0.3em',
              background:
                'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            SIDE
          </motion.div>
          <motion.div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              border: '2px solid var(--border-color)',
              borderTopColor: 'var(--accent-primary)',
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
        </motion.div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
