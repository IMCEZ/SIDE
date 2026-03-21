import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface AuthState {
  isAuthenticated: boolean
  token: string | null
  user: { id: string; username: string } | null
  login: (token: string) => void
  logout: () => void
  initAuth: () => void
  setUser: (user: { id: string; username: string } | null) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, _get) => ({
      isAuthenticated: false,
      token: null,
      user: null,

      login: (token: string) => {
        localStorage.setItem('side_token', token)
        set({ isAuthenticated: true, token })
      },

      logout: () => {
        localStorage.removeItem('side_token')
        set({ isAuthenticated: false, token: null, user: null })
      },

      initAuth: () => {
        const token = localStorage.getItem('side_token')
        if (token) {
          set({ isAuthenticated: true, token })
        }
      },

      setUser: (user) => {
        set({ user })
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user }),
    }
  )
)
