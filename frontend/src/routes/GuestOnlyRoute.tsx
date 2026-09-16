import type { PropsWithChildren } from 'react'
import { Navigate } from 'react-router-dom'
import { useSession } from '../lib/auth-client'

export default function GuestOnlyRoute({ children }: PropsWithChildren) {
  const { data: session, isPending } = useSession()

  if (isPending) {
    return <p className="flex min-h-svh items-center justify-center">Loading…</p>
  }

  if (session) {
    return <Navigate to="/" replace />
  }

  return children
}
