import { useEffect, useState } from 'react'
import { CheckCircle2Icon, XCircleIcon } from 'lucide-react'
import type { HealthResponse } from '@/types/health'
import { useSession } from '@/lib/auth-client'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

export default function HomePage() {
  const { data: session } = useSession()
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

  const firstName = session?.user?.name?.split(' ')[0]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-foreground lg:text-4xl">
          {firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Ticket management is coming soon — for now, here's the system
          status.
        </p>
      </div>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Backend status</CardTitle>
          <CardDescription>
            Live connectivity check against the API and database.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {error && (
            <div className="flex items-center gap-2 text-destructive">
              <XCircleIcon className="size-4 shrink-0" />
              <span className="text-sm">Backend unreachable: {error}</span>
            </div>
          )}
          {health && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">API</span>
                <Badge
                  variant="outline"
                  className="gap-1 border-primary/30 bg-accent text-accent-foreground"
                >
                  <CheckCircle2Icon className="size-3.5" />
                  {health.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Database</span>
                <Badge
                  variant="outline"
                  className="gap-1 border-primary/30 bg-accent text-accent-foreground"
                >
                  <CheckCircle2Icon className="size-3.5" />
                  {health.database}
                </Badge>
              </div>
            </>
          )}
          {!health && !error && (
            <>
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-3/4" />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
