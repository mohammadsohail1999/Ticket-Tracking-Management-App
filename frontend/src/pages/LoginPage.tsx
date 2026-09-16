import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useLocation, useNavigate } from 'react-router-dom'
import { signIn } from '../lib/auth-client'
import type { AuthRedirectState } from '../types/auth'

const loginSchema = z.object({
  email: z.email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
})

type LoginFormValues = z.infer<typeof loginSchema>

export default function LoginPage() {
  const [formError, setFormError] = useState<string | null>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as AuthRedirectState | null
  const redirectTo = state?.from?.pathname ?? '/'

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit({ email, password }: LoginFormValues) {
    setFormError(null)
    try {
      const { error } = await signIn.email({ email, password })
      if (error) {
        setFormError(
          error.status === 403
            ? 'Please verify your email address before signing in.'
            : error.message || 'Invalid email or password.',
        )
        return
      }
      navigate(redirectTo, { replace: true })
    } catch {
      setFormError('Could not reach the server. Please try again.')
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <form
        className="flex w-full max-w-[360px] flex-col gap-4 text-left"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
      >
        <h1 className="mb-2 text-center text-[36px] font-medium -tracking-[1.68px] text-text-h font-sans lg:text-[56px]">
          Sign in
        </h1>
        {formError && (
          <p className="rounded-md border border-accent-border bg-accent-bg px-3 py-2.5 text-sm text-accent">
            {formError}
          </p>
        )}
        <label className="flex flex-col gap-1.5 text-[15px] text-text-h">
          Email
          <input
            type="email"
            autoComplete="email"
            className="rounded-md border border-border bg-bg px-3 py-2.5 text-text-h focus:outline-2 focus:outline-accent-border focus:outline-offset-1"
            {...register('email')}
          />
          {errors.email && (
            <span className="text-[13px] text-accent">{errors.email.message}</span>
          )}
        </label>
        <label className="flex flex-col gap-1.5 text-[15px] text-text-h">
          Password
          <input
            type="password"
            autoComplete="current-password"
            className="rounded-md border border-border bg-bg px-3 py-2.5 text-text-h focus:outline-2 focus:outline-accent-border focus:outline-offset-1"
            {...register('password')}
          />
          {errors.password && (
            <span className="text-[13px] text-accent">{errors.password.message}</span>
          )}
        </label>
        <button
          type="submit"
          disabled={isSubmitting}
          className="cursor-pointer rounded-md border border-accent-border bg-accent px-3 py-2.5 text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
