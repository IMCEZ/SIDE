import { create } from 'zustand';
import axios from 'axios';
import type { ThemeId } from '../themes/themeConfig';

const THEME_KEY = 'side_theme';
const DEFAULT_THEME: ThemeId = 'theme-midnight';

interface ThemeState {
  currentTheme: ThemeId;
  setTheme: (themeId: ThemeId) => Promise<void>;
  initTheme: () => void;
}

function applyTheme(theme: ThemeId) {
  document.documentElement.setAttribute('data-theme', theme);
}

export const useThemeStore = create<ThemeState>(() => ({
  currentTheme: DEFAULT_THEME,
  async setTheme(themeId: ThemeId) {
    applyTheme(themeId);
    localStorage.setItem(THEME_KEY, themeId);
    try {
      const token = localStorage.getItem('side_token');
      await axios.put(
        '/api/v1/settings',
        [{ key: 'theme', value: themeId }],
        token
          ? {
              headers: {
                Authorization: `Bearer ${token}`
              }
            }
          : undefined
      );
    } catch {
      // 后端失败不影响前端主题切换
    }
    useThemeStore.setState({ currentTheme: themeId });
  },
  initTheme() {
    const fromStorage = localStorage.getItem(THEME_KEY) as ThemeId | null;
    const theme = fromStorage || DEFAULT_THEME;
    applyTheme(theme);
    useThemeStore.setState({ currentTheme: theme });
  }
}));

