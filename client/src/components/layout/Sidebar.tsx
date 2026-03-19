import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { Users, BookOpen, Sliders, Settings } from 'lucide-react';
import { THEMES } from '../../themes/themeConfig';
import { useThemeStore } from '../../stores/themeStore';
import { useState } from 'react';

const navItems = [
  { icon: Users, label: '角色', path: '/characters' },
  { icon: BookOpen, label: '世界书', path: '/worlds' },
  { icon: Sliders, label: '预设', path: '/presets' },
  { icon: Settings, label: '设置', path: '/settings' }
] as const;

export const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [themeOpen, setThemeOpen] = useState(false);
  const currentTheme = useThemeStore((s) => s.currentTheme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <motion.aside
      initial={{ x: -40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="hidden md:flex flex-col justify-between h-full w-64 border-r"
      style={{
        background: 'var(--bg-secondary)',
        borderColor: 'var(--border-color)'
      }}
    >
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 mb-6">
          <div className="text-2xl font-extrabold tracking-[0.22em] select-none">
            <span style={{ color: 'var(--accent-primary)' }}>S</span>
            <span style={{ color: 'var(--accent-secondary)' }}>I</span>
            <span style={{ color: 'var(--accent-primary)' }}>D</span>
            <span style={{ color: 'var(--accent-secondary)' }}>E</span>
          </div>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname.startsWith(item.path);
            return (
              <motion.button
                key={item.path}
                whileHover={{ x: 2 }}
                onClick={() => navigate(item.path)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm relative group"
                style={{
                  color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  background: active ? 'rgba(124,106,247,0.12)' : 'transparent'
                }}
              >
                {active && (
                  <motion.div
                    layoutId="sidebar-active-bar"
                    className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full"
                    style={{ background: 'var(--accent-primary)' }}
                  />
                )}
                <div className="relative z-10 flex items-center gap-3">
                  <Icon size={18} />
                  <span>{item.label}</span>
                </div>
              </motion.button>
            );
          })}
        </nav>
      </div>

      <div className="px-4 pb-4">
        <div className="relative">
          <button
            type="button"
            onClick={() => setThemeOpen((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs"
            style={{
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)'
            }}
          >
            <span>主题</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {
                  THEMES.find((t) => t.id === currentTheme)?.name ??
                  THEMES.find((t) => t.id === 'theme-midnight')?.name
                }
              </span>
              <span
                className="w-3 h-3 rounded-full"
                style={{
                  background:
                    THEMES.find((t) => t.id === currentTheme)?.preview ??
                    THEMES[0]?.preview ??
                    'var(--accent-primary)'
                }}
              />
            </div>
          </button>

          {themeOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute bottom-11 left-0 right-0 rounded-2xl mt-2 p-3 z-20"
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                boxShadow: '0 18px 40px rgba(0,0,0,0.45)'
              }}
            >
              <div className="grid grid-cols-5 gap-3">
                {THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={async () => {
                      await setTheme(theme.id);
                      setThemeOpen(false);
                    }}
                    className="flex flex-col items-center gap-1"
                  >
                    <div className="relative">
                      <div
                        className="w-7 h-7 rounded-full border"
                        style={{
                          background: theme.preview,
                          borderColor:
                            theme.id === currentTheme ? 'var(--accent-secondary)' : 'transparent',
                          boxShadow:
                            theme.id === currentTheme
                              ? '0 0 0 2px rgba(148,163,184,0.5)'
                              : 'none'
                        }}
                      />
                    </div>
                    <span
                      className="text-[10px]"
                      style={{
                        color:
                          theme.id === currentTheme
                            ? 'var(--accent-primary)'
                            : 'var(--text-muted)'
                      }}
                    >
                      {theme.name}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.aside>
  );
};

