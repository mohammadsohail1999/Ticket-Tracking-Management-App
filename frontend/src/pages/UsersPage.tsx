import { useState } from 'react'
import { PlusIcon, XCircleIcon } from 'lucide-react'
import { useUsers } from '@/hooks/useUsers'
import CreateUserDialog from '@/components/CreateUserDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default function UsersPage() {
  const { data, error } = useUsers()
  const [createOpen, setCreateOpen] = useState(false)
  const users = data?.users

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-medium tracking-tight text-foreground lg:text-4xl">
            Users
          </h1>
          <p className="mt-1 text-muted-foreground">
            All admin and agent accounts in the system.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <PlusIcon />
          Create user
        </Button>
      </div>
      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />

      <Card>
        <CardHeader>
          <CardTitle>All users</CardTitle>
          <CardDescription>{users ? `${users.length} total` : 'Loading...'}</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive">
              <XCircleIcon />
              <AlertDescription>Could not load users: {error.message}</AlertDescription>
            </Alert>
          )}

          {!error && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium text-foreground">{user.name}</TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      {user.role && (
                        <Badge variant="secondary" className="capitalize">
                          {user.role}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.banned ? 'destructive' : 'outline'}>
                        {user.banned ? 'Banned' : 'Active'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
                {!users &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
