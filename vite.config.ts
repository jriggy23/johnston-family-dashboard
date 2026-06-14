/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Proxy API calls to the Azure Functions host during local dev
    // (run `func start` in ./api, or use the Static Web Apps CLI).
    proxy: {
      '/api': 'http://localhost:7071',
    },
  },
  test: {
    // Scope vitest to the frontend; the api/ package runs its own node:test suite.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['api/**', 'node_modules/**', 'dist/**'],
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    css: false,
  },
})
