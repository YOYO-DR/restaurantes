import fs from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// El .env vive en la raíz del repo. Dentro de la imagen de producción esa raíz no
// existe (su Dockerfile escribe .env en esta carpeta), así que se cae a esta carpeta.
const rootDir = path.resolve(__dirname, '..')
const envDir = fs.existsSync(path.join(rootDir, '.env')) ? rootDir : __dirname

export default defineConfig({
  envDir,
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0'
  },
  test: {
    globals: true,
    // e2e/ son specs de Playwright (pnpm test:e2e), no de Vitest.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: true,
  }
})
