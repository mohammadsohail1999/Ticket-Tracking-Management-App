import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useSession } from '../lib/auth-client'
import type { AuthRedirectState } from '../types/auth'

export default function ProtectedRoute() {
  const { data: session, isPending } = useSession()
  const location = useLocation()

  if (isPending) {
    return <p className="full-page-status">Loading…</p>
  }

  if (!session) {
    const state: AuthRedirectState = { from: location }
    return <Navigate to="/login" replace state={state} />
  }

  return <Outlet />
}
