import { useLocation, useNavigate } from 'react-router-dom'
import { Users, BookOpen, Sliders, Settings, FileText } from 'lucide-react'
import { motion } from 'framer-motion'

const navItems = [
  { icon: Users, label: '角色', path: '/characters' },
  { icon: BookOpen, label: '世界书', path: '/worlds' },
  { icon: Sliders, label: '预设', path: '/presets' },
  { icon: FileText, label: 'Regex', path: '/regex' },
  { icon: Settings, label: '设置', path: '/settings' },
] as const

export function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t backdrop-blur-md"
      style={{
        background: 'rgba(15, 23, 42, 0.9)',
        borderColor: 'var(--border-color)',
      }}
    >
      <div className="flex justify-around py-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname.startsWith(item.path)
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center gap-1 py-1 px-3 min-w-[64px]"
              style={{ color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
            >
              <div className="relative h-6 flex items-center justify-center">
                {isActive && (
                  <motion.div
                    layoutId="bottom-nav-active"
                    className="absolute -inset-2 rounded-full"
                    style={{ background: 'rgba(124, 106, 247, 0.18)' }}
                    transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                  />
                )}
                <motion.div
                  animate={{ scale: isActive ? 1.1 : 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  className="relative z-10"
                >
                  <Icon size={20} />
                </motion.div>
              </div>
              <span className="text-[11px] font-medium">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
