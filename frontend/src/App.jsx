import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [health, setHealth] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then(setHealth)
      .catch((err) => setError(err.message))
  }, [])

  return (
    <div>
      <h1>Ticket Tracking App</h1>
      {error && <p>Backend unreachable: {error}</p>}
      {health && (
        <p>
          Backend status: {health.status} — database: {health.database}
        </p>
      )}
      {!health && !error && <p>Checking backend...</p>}
    </div>
  )
}

export default App
