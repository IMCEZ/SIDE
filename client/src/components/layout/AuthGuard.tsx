import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuthStore } from '@/stores/authStore'

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, token, login, logout, initAuth } = useAuthStore()
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
        } else {
          logout()
        }
      } catch {
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
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{
            fontSize: '2rem',
            fontWeight: 900,
            letterSpacing: '0.3em',
            background:
              'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          SIDE
        </motion.div>
      </div>
    )
  }

  if (!isAuthenticated || !token) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
