import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Users, BookOpen, Sliders, Settings, LogOut, Sparkles, FileText } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { BottomNav } from './BottomNav'

const navItems = [
  { icon: Users, label: '角色', path: '/characters' },
  { icon: BookOpen, label: '世界书', path: '/worlds' },
  { icon: Sliders, label: '预设', path: '/presets' },
  { icon: FileText, label: 'Regex', path: '/regex' },
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
    <div className="flex w-screen h-screen" style={{ background: 'var(--bg-primary)' }}>
      <motion.aside
        initial={{ x: -280 }}
        animate={{ x: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="hidden md:flex flex-col w-[260px] h-screen flex-shrink-0 p-6"
        style={{
          background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-color)',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="pb-6 mb-6 border-b"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity, repeatDelay: 5 }}
            >
              <Sparkles size={28} style={{ color: 'var(--accent-primary)' }} />
            </motion.div>
            <div>
              <div
                className="text-2xl font-black tracking-[0.2em]"
                style={{
                  background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                SIDE
              </div>
              <div className="text-xs mt-0.5 tracking-wide" style={{ color: 'var(--text-muted)' }}>
                沉浸式 AI 对话
              </div>
            </div>
          </div>
        </motion.div>

        <nav className="flex-1 space-y-1">
          {navItems.map((item, index) => {
            const Icon = item.icon
            const isActive = location.pathname.startsWith(item.path)
            return (
              <motion.button
                key={item.path}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + index * 0.05 }}
                whileHover={{ x: 4 }}
                onClick={() => navigate(item.path)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 relative"
                style={{
                  color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  background: isActive ? 'var(--accent-primary)/10' : 'transparent',
                }}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full"
                    style={{ background: 'var(--accent-primary)' }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
                <Icon size={18} />
                <span>{item.label}</span>
              </motion.button>
            )
          })}
        </nav>

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          <LogOut size={18} />
          <span>退出登录</span>
        </motion.button>
      </motion.aside>

      <main className="flex-1 h-screen overflow-hidden relative">
        <div className="h-full overflow-y-auto pb-20 md:pb-0">
          <Outlet />
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
