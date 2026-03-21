import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { ToastProvider } from './components/ui'
import './index.css'

const initTheme = () => {
  const stored = localStorage.getItem('theme-storage')
  let theme = 'theme-midnight'
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      theme = parsed.state?.currentTheme || 'theme-midnight'
    } catch {
      // 使用默认主题
    }
  }
  document.documentElement.setAttribute('data-theme', theme)
}

initTheme()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  </React.StrictMode>
)
