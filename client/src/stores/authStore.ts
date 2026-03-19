import { create } from 'zustand'

interface AuthState {
  isAuthenticated: boolean
  token: string | null
  login: (token: string) => void
  logout: () => void
  initAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  token: null,

  login: (token: string) => {
    localStorage.setItem('side_token', token)
    set({ isAuthenticated: true, token })
  },

  logout: () => {
    localStorage.removeItem('side_token')
    set({ isAuthenticated: false, token: null })
  },

  initAuth: () => {
    const token = localStorage.getItem('side_token')
    if (token) {
      set({ isAuthenticated: true, token })
    }
  },
}))
