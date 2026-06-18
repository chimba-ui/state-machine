import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import { resolve } from 'node:path'

// The site is served under the /state-machine/ path on dunky.dev
// (dunky.dev/ redirects there; see vercel.json). BASE_PATH can override
// it (e.g. '/' for an isolated local preview).
const base = process.env.BASE_PATH ?? '/state-machine/'

// https://astro.build/config
export default defineConfig({
  site: 'https://dunky-dev.github.io',
  base,
  integrations: [mdx()],
  vite: {
    resolve: {
      // The engine package is workspace-linked; alias straight to its `src`
      // so docs demos run the real TS source with no build step.
      alias: {
        '@dunky-dev/state-machine': resolve(import.meta.dirname, '../packages/core/src'),
      },
    },
  },
})
