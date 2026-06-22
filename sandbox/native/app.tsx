import { useState } from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { DEMO_COMMANDS } from '@sandbox/cmdk-core'
import { CommandPalette } from './command-palette'

export default function App() {
  const [last, setLast] = useState('—')

  return (
    <View style={styles.root}>
      <StatusBar style='dark' />
      <Text style={styles.title}>cmdk · native</Text>
      <Text style={styles.lead}>
        The same state machine as the DOM and terminal demos. Only the renderer differs.
      </Text>
      <CommandPalette
        commands={DEMO_COMMANDS}
        onSelect={c => {
          setLast(c.label)
          Alert.alert('Selected', c.label)
        }}
      />
      <Text style={styles.hint}>last selected · {last}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
    backgroundColor: '#eef1f6',
  },
  title: { fontSize: 26, fontWeight: '700', color: '#0d0f16' },
  lead: { fontSize: 15, lineHeight: 22, color: '#5b6172', textAlign: 'center', maxWidth: 340 },
  hint: { fontSize: 13, color: '#8990a0' },
})
