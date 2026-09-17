import type { PropsWithChildren } from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2Icon } from 'lucide-react'
import { useSession } from '@/lib/auth-client'

export default function GuestOnlyRoute({ children }: PropsWithChildren) {
  const { data: session, isPending } = useSession()

  if (isPending) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (session) {
    return <Navigate to="/" replace />
  }

  return children
}
