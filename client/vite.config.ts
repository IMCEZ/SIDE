import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const host = process.env.VITE_HOST || '0.0.0.0'
const port = Number(process.env.VITE_PORT || 5173)
const apiTarget = process.env.VITE_API_TARGET || 'http://127.0.0.1:3000'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host,
    port,
    strictPort: true,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
  preview: {
    host,
    port,
    strictPort: true,
  },
})
