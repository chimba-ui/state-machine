import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  // Locally served from /; in prod the deploy workflow sets BASE_PATH to
  // /state-machine/benchmark/ so assets match the dunky.dev rewrite path
  // (see deploy-benchmark.yml and website/vercel.json).
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  resolve: {
    // the engine package is workspace-linked; aliasing straight to its `src`
    // means Vite serves the real TS source (no build step, edits hot-reload)
    alias: {
      '@dunky.dev/state-machine': resolve(__dirname, '../../packages/core/src'),
    },
    dedupe: ['react', 'react-dom'],
  },
})
