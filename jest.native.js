// @ts-check

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** @type {(p: string) => string} */
const r = p => resolve(__dirname, p)

const SCOPES = 'core|native|react|shared'

/** @type {Record<string, string>} */
const moduleNameMapper = {
  '^@render-experiment/utils$': r('packages/shared/utils/src'),
  '^@render-experiment/store$': r('packages/core/store/src'),
  [`^@render-experiment/machine-(${SCOPES})$`]: r('packages/$1/machine/src'),
  [`^@render-experiment/style-engine-(${SCOPES})$`]: r('packages/$1/style-engine/src'),
  [`^@render-experiment/(.+)-(${SCOPES})$`]: r('packages/$2/components/$1/src'),
}

/** @type {import("jest").Config} */
const config = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/packages/native/**/tests/**/*.test.tsx'],
  moduleNameMapper,
}

export default config
