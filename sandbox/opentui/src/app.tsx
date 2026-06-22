import { useState } from 'react'
import { DEMO_COMMANDS } from '@sandbox/cmdk-core'
import { CommandPalette } from './command-palette'

export function App() {
  const [last, setLast] = useState('—')

  return (
    <box style={{ flexDirection: 'column', padding: 1 }}>
      <text fg='#ffffff' attributes={1}>
        cmdk · terminal
      </text>
      <text fg='#8990a0'>
        Same machine as the DOM and Native demos — only the renderer differs.
      </text>
      <box style={{ marginTop: 1 }}>
        <CommandPalette commands={DEMO_COMMANDS} onSelect={c => setLast(c.label)} />
      </box>
      <text fg='#8990a0'>last selected · {last}</text>
    </box>
  )
}
