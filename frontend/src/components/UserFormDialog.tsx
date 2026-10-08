import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { EyeIcon, EyeOffIcon, TriangleAlertIcon } from 'lucide-react'
import { createUserSchema as sharedCreateUserSchema, updateUserSchema } from '@core/schema/user.ts'
import { useCreateUser } from '@/hooks/useCreateUser'
import { useUpdateUser } from '@/hooks/useUpdateUser'
import type { User } from '@/types/user'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

// Password bounds mirror Better Auth's defaults (backend/src/lib/auth.ts doesn't override them).
const createUserSchema = sharedCreateUserSchema.pick({ name: true, email: true }).extend({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(128, 'Password must be at most 128 characters.'),
})

// Create and edit share name + email; only create has a password.
type UserFormValues = { name: string; email: string; password?: string }

type UserFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Present = edit that user; absent = create a new one. When editing, render
  // with `key={user.id}` so defaultValues always come from the right row.
  user?: User
}

export default function UserFormDialog({ open, onOpenChange, user }: UserFormDialogProps) {
  const isEdit = !!user
  const [formError, setFormError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const createUser = useCreateUser()
  const updateUser = useUpdateUser()

  const defaultValues: UserFormValues = isEdit
    ? { name: user.name, email: user.email }
    : { name: '', email: '', password: '' }

  const form = useForm<UserFormValues>({
    // The resolver output types differ per mode; both are subsets of UserFormValues.
    resolver: zodResolver(isEdit ? updateUserSchema : createUserSchema) as never,
    defaultValues,
  })

  function handleOpenChange(next: boolean) {
    if (!next) {
      form.reset(defaultValues)
      setFormError(null)
      setShowPassword(false)
    }
    onOpenChange(next)
  }

  async function onSubmit(values: UserFormValues) {
    setFormError(null)
    try {
      if (isEdit) {
        const { user: updated } = await updateUser.mutateAsync({
          id: user.id,
          name: values.name,
          email: values.email,
        })
        toast.success(`Updated ${updated.name}.`)
      } else {
        const { user: created } = await createUser.mutateAsync({
          name: values.name,
          email: values.email,
          password: values.password ?? '',
        })
        toast.success(`Created ${created.name}.`)
      }
      handleOpenChange(false)
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : `Could not ${isEdit ? 'update' : 'create'} the user.`,
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit user' : 'Create user'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this user's name or email address."
              : 'Creates an agent account. They can sign in right away with these credentials.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
            className="flex flex-col gap-4"
          >
            {formError && (
              <Alert variant="destructive">
                <TriangleAlertIcon />
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {!isEdit && (
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          className="pr-10"
                          {...field}
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-0 right-0"
                        aria-label={showPassword ? 'Hide password text' : 'Show password text'}
                        aria-pressed={showPassword}
                        onClick={() => setShowPassword((v) => !v)}
                      >
                        {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <Button type="submit" disabled={form.formState.isSubmitting} className="mt-2">
              {isEdit
                ? form.formState.isSubmitting ? 'Saving…' : 'Save changes'
                : form.formState.isSubmitting ? 'Creating…' : 'Create user'}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
