import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { settingsApi } from '@/api/services/settings'
import type { ThemeId } from '@/themes/themeConfig'

const DEFAULT_THEME: ThemeId = 'theme-midnight'

interface ThemeState {
  currentTheme: ThemeId
  setTheme: (themeId: ThemeId) => Promise<void>
  initTheme: () => void
}

function applyTheme(theme: ThemeId) {
  document.documentElement.setAttribute('data-theme', theme)
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, _get) => ({
      currentTheme: DEFAULT_THEME,

      setTheme: async (themeId: ThemeId) => {
        applyTheme(themeId)
        set({ currentTheme: themeId })

        try {
          await settingsApi.updateSettings([{ key: 'theme', value: themeId }])
        } catch {
          // 后端失败不影响前端主题切换
        }
      },

      initTheme: () => {
        const stored = localStorage.getItem('theme-storage')
        let theme = DEFAULT_THEME

        if (stored) {
          try {
            const parsed = JSON.parse(stored)
            theme = parsed.state?.currentTheme || DEFAULT_THEME
          } catch {
            // 解析失败使用默认主题
          }
        }

        applyTheme(theme)
        set({ currentTheme: theme })
      },
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
