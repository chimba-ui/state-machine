import { createCliRenderer } from '@opentui/core'
import { createRoot } from '@opentui/react'
import { App } from './app'

// Mount the React tree to the terminal: create the CLI renderer, then a root.
const renderer = await createCliRenderer()
createRoot(renderer).render(<App />)
