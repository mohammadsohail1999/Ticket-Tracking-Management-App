import { useEffect, useState } from 'react'
import type { HealthResponse } from '../types/health'

export default function HomePage() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json() as Promise<HealthResponse>)
      .then(setHealth)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : String(err)),
      )
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
