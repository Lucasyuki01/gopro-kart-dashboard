import { useState } from 'react'
import ImportScreen from './components/ImportScreen'
import Dashboard from './components/Dashboard'

function App() {
  const [screen, setScreen] = useState('import')

  if (screen === 'import') {
    return <ImportScreen onSessionReady={() => setScreen('dashboard')} />
  }

  return <Dashboard onBack={() => setScreen('import')} />
}

export default App
