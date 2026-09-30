import type { PropsWithChildren } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Loader2Icon } from 'lucide-react'
import { useSession } from '@/lib/auth-client'
import type { AuthRedirectState } from '@/types/auth'

export default function GuestOnlyRoute({ children }: PropsWithChildren) {
  const { data: session, isPending } = useSession()
  const location = useLocation()

  if (isPending) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (session) {
    // The session lands here before LoginPage's own navigate() runs, so honor
    // the location ProtectedRoute/AdminOnlyRoute saved or the deep link is lost.
    const from = (location.state as AuthRedirectState | null)?.from
    return <Navigate to={from ?? '/'} replace />
  }

  return children
}
