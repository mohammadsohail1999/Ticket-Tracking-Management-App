import { useState } from 'react'
import { toast } from 'sonner'
import { TriangleAlertIcon } from 'lucide-react'
import { useDeleteUser } from '@/hooks/useDeleteUser'
import type { User } from '@/types/user'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type DeleteUserDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User
}

export default function DeleteUserDialog({ open, onOpenChange, user }: DeleteUserDialogProps) {
  const [error, setError] = useState<string | null>(null)
  const deleteUser = useDeleteUser()

  function handleOpenChange(next: boolean) {
    if (!next) setError(null)
    onOpenChange(next)
  }

  async function handleDelete() {
    setError(null)
    try {
      await deleteUser.mutateAsync(user.id)
      toast.success(`Deleted ${user.name}.`)
      handleOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the user.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete user</DialogTitle>
          <DialogDescription>
            Delete {user.name} ({user.email})? They will be signed out and can no longer sign in.
            Their record is kept, and the email address stays reserved.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={deleteUser.isPending} onClick={handleDelete}>
            {deleteUser.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
