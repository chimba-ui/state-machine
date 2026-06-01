import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    dedupe: ['react', 'react-dom'],
  },
  test: {
    globals: false,
    environment: 'node',
    // Native component tests (.tsx — render RN components via RNTL) run
    // under Jest via `pnpm test:native`. Pure-logic .ts tests in
    // packages/native/ stay here.
    exclude: ['**/node_modules/**', 'packages/native/**/tests/**/*.test.tsx'],
  },
})
