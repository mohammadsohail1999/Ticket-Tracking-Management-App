import path from 'path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    proxy: {
      // API_PROXY_TARGET lets the E2E stack (e2e/) point at its own backend.
      '/api': process.env.API_PROXY_TARGET ?? 'http://localhost:4000',
    },
  },
})
