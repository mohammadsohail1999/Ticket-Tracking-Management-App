import path from 'path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@core': path.resolve(import.meta.dirname, '../core'),
    },
    // core/ has its own zod install; resolve from here so there's one copy.
    dedupe: ['zod'],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
  server: {
    // Lets Vite serve ../core (shared schemas), which sits outside this project.
    fs: { allow: ['..'] },
    proxy: {
      // API_PROXY_TARGET lets the E2E stack (e2e/) point at its own backend.
      '/api': process.env.API_PROXY_TARGET ?? 'http://localhost:4000',
    },
  },
})
