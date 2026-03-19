import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Users, BookOpen, Sliders, Settings, LogOut } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

const navItems = [
  { icon: Users, label: '角色', path: '/characters' },
  { icon: BookOpen, label: '世界书', path: '/worlds' },
  { icon: Sliders, label: '预设', path: '/settings' },
  { icon: Settings, label: '设置', path: '/settings' },
]

export function MainLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout } = useAuthStore()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div
      style={{
        display: 'flex',
        width: '100vw',
        height: '100vh',
        background: 'var(--bg-primary)',
      }}
    >
      {/* 左侧导航栏（桌面端） */}
      <motion.aside
        initial={{ x: -260 }}
        animate={{ x: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{
          width: '260px',
          flexShrink: 0,
          height: '100vh',
          background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px 0',
        }}
        className="hidden md:flex"
      >
        {/* Logo */}
        <div
          style={{
            padding: '0 24px 24px',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <div
            style={{
              fontSize: '1.6rem',
              fontWeight: 900,
              letterSpacing: '0.3em',
              background:
                'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            SIDE
          </div>
          <div
            style={{
              color: 'var(--text-muted)',
              fontSize: '0.75rem',
              marginTop: '4px',
            }}
          >
            沉浸式 AI 对话
          </div>
        </div>

        {/* 导航项 */}
        <nav style={{ flex: 1, padding: '16px 12px' }}>
          {navItems.map((item) => {
            const active = location.pathname.startsWith(item.path)
            return (
              <motion.button
                key={item.path + item.label}
                onClick={() => navigate(item.path)}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.97 }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '11px 14px',
                  borderRadius: '10px',
                  marginBottom: '4px',
                  background: active
                    ? 'rgba(124,106,247,0.12)'
                    : 'transparent',
                  border: active
                    ? '1px solid rgba(124,106,247,0.2)'
                    : '1px solid transparent',
                  color: active
                    ? 'var(--accent-primary)'
                    : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: active ? 600 : 400,
                  fontSize: '0.9rem',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                }}
              >
                <item.icon size={18} />
                {item.label}
              </motion.button>
            )
          })}
        </nav>

        {/* 底部退出 */}
        <div style={{ padding: '0 12px' }}>
          <motion.button
            onClick={handleLogout}
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.97 }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '11px 14px',
              borderRadius: '10px',
              background: 'transparent',
              border: '1px solid transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '0.9rem',
              textAlign: 'left',
              transition: 'all 0.2s',
            }}
          >
            <LogOut size={18} />
            退出登录
          </motion.button>
        </div>
      </motion.aside>

      {/* 主内容区 */}
      <main
        style={{
          flex: 1,
          height: '100vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Outlet />
      </main>

      {/* 底部导航（移动端） */}
      <nav
        className="flex md:hidden"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'var(--bg-secondary)',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-around',
          padding: '8px 0 calc(8px + env(safe-area-inset-bottom))',
          zIndex: 100,
        }}
      >
        {navItems.map((item) => {
          const active = location.pathname.startsWith(item.path)
          return (
            <button
              key={item.path + item.label}
              onClick={() => navigate(item.path)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 16px',
                background: 'none',
                border: 'none',
                color: active
                  ? 'var(--accent-primary)'
                  : 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.7rem',
                fontWeight: active ? 600 : 400,
              }}
            >
              <item.icon size={active ? 22 : 20} />
              {item.label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
