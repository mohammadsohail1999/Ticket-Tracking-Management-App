import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useLocation, useNavigate } from 'react-router-dom'
import { signIn } from '../lib/auth-client'
import type { AuthRedirectState } from '../types/auth'
import './LoginPage.css'

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
    <div className="login-page">
      <form className="login-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <h1>Sign in</h1>
        {formError && <p className="field-error">{formError}</p>}
        <label>
          Email
          <input type="email" autoComplete="email" {...register('email')} />
          {errors.email && <span className="field-hint">{errors.email.message}</span>}
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            {...register('password')}
          />
          {errors.password && (
            <span className="field-hint">{errors.password.message}</span>
          )}
        </label>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
