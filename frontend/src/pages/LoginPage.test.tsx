import { fireEvent, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { signIn } from '@/lib/auth-client'
import { renderWithProviders } from '@/test/render'
import LoginPage from './LoginPage'

vi.mock('@/lib/auth-client', () => ({ signIn: { email: vi.fn() } }))

const signInEmail = vi.mocked(signIn.email)

function renderPage(from?: string) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[{ pathname: '/login', state: from ? { from } : null }]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<div>landed on elsewhere</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

function fillAndSubmit(email: string, password: string) {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
}

afterEach(() => {
  vi.resetAllMocks()
})

describe('LoginPage', () => {
  it('offers no sign-up or account-creation entry point', () => {
    renderPage()

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByText(/sign up|create account|register/i)).not.toBeInTheDocument()
  })

  it('shows field errors for an empty submit and sends no request', async () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument()
    expect(screen.getByText('Password is required.')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
    expect(signInEmail).not.toHaveBeenCalled()
  })

  it('rejects a malformed email without complaining about the password', async () => {
    renderPage()

    fillAndSubmit('not-an-email', 'Test@123')

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument()
    expect(screen.queryByText('Password is required.')).not.toBeInTheDocument()
    expect(signInEmail).not.toHaveBeenCalled()
  })

  it('rejects a missing password without complaining about the email', async () => {
    renderPage()

    fillAndSubmit('ada@example.com', '')

    expect(await screen.findByText('Password is required.')).toBeInTheDocument()
    expect(screen.queryByText('Enter a valid email address.')).not.toBeInTheDocument()
    expect(signInEmail).not.toHaveBeenCalled()
  })

  it('signs in and returns to the page the visitor originally asked for', async () => {
    signInEmail.mockResolvedValue({ data: {}, error: null } as never)
    renderPage('/users')

    fillAndSubmit('ada@example.com', 'Test@123')

    await screen.findByText('landed on elsewhere')
    expect(signInEmail).toHaveBeenCalledWith({ email: 'ada@example.com', password: 'Test@123' })
  })

  it('shows the server message and stays on the page when credentials are rejected', async () => {
    signInEmail.mockResolvedValue({
      data: null,
      error: { status: 401, message: 'Invalid email or password' },
    } as never)
    renderPage()

    fillAndSubmit('ada@example.com', 'wrong')

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password')
    expect(screen.queryByText('landed on elsewhere')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled()
  })

  it('asks an unverified user to verify their email on a 403', async () => {
    signInEmail.mockResolvedValue({
      data: null,
      error: { status: 403, message: 'Email not verified' },
    } as never)
    renderPage()

    fillAndSubmit('ada@example.com', 'Test@123')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Please verify your email address before signing in.',
    )
  })

  it('does not ask a banned or deleted user to verify their email', async () => {
    signInEmail.mockResolvedValue({
      data: null,
      error: { status: 403, code: 'BANNED_USER', message: 'You have been banned' },
    } as never)
    renderPage()

    fillAndSubmit('ada@example.com', 'Test@123')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('You have been banned')
    expect(alert).not.toHaveTextContent(/verify/i)
  })

  it('shows a friendly message when the server cannot be reached', async () => {
    signInEmail.mockRejectedValue(new TypeError('Failed to fetch'))
    renderPage()

    fillAndSubmit('ada@example.com', 'Test@123')

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Could not reach the server. Please try again.',
      ),
    )
  })
})
