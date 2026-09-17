import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Loader2Icon } from 'lucide-react'
import { useSession } from '@/lib/auth-client'
import type { AuthRedirectState } from '@/types/auth'

export default function AdminOnlyRoute() {
  const { data: session, isPending } = useSession()
  const location = useLocation()

  if (isPending) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!session) {
    const state: AuthRedirectState = { from: location }
    return <Navigate to="/login" replace state={state} />
  }

  if (session.user.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
