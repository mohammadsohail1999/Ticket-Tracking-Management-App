import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api'
import { renderWithProviders } from '@/test/render'
import type { CreateUserResponse } from '@/types/user'
import CreateUserDialog from './CreateUserDialog'

const created: CreateUserResponse = {
  user: {
    id: 'u2',
    name: 'Grace Agent',
    email: 'grace@example.com',
    role: 'agent',
    banned: false,
    createdAt: '2026-03-15T12:00:00.000Z',
  },
}

function renderDialog(onOpenChange = vi.fn()) {
  renderWithProviders(<CreateUserDialog open onOpenChange={onOpenChange} />)
  return onOpenChange
}

function fill({ name = '', email = '', password = '' }) {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: name } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } })
}

const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Create user' }))

afterEach(() => {
  vi.restoreAllMocks()
})

describe('CreateUserDialog', () => {
  it('has only name, email and password fields', () => {
    renderDialog()

    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.queryByLabelText(/role/i)).not.toBeInTheDocument()
  })

  it('toggles password visibility', () => {
    renderDialog()
    const input = screen.getByLabelText('Password')
    expect(input).toHaveAttribute('type', 'password')

    fireEvent.click(screen.getByRole('button', { name: 'Show password text' }))
    expect(input).toHaveAttribute('type', 'text')

    fireEvent.click(screen.getByRole('button', { name: 'Hide password text' }))
    expect(input).toHaveAttribute('type', 'password')
  })

  it('shows validation errors and does not post an empty or short-password form', async () => {
    const post = vi.spyOn(api, 'post')
    renderDialog()

    submit()
    expect(await screen.findByText('Name is required.')).toBeInTheDocument()
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
    expect(screen.getByText('Password must be at least 8 characters.')).toBeInTheDocument()

    fill({ name: 'Grace Agent', email: 'grace@example.com', password: 'short' })
    submit()
    await screen.findByText('Password must be at least 8 characters.')
    expect(post).not.toHaveBeenCalled()
  })

  it('posts exactly name, email and password, then toasts and closes', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: created })
    const success = vi.spyOn(toast, 'success').mockReturnValue(1)
    const onOpenChange = renderDialog()

    fill({ name: 'Grace Agent', email: 'grace@example.com', password: 'Str0ng!Pass' })
    submit()

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(post).toHaveBeenCalledWith('/api/admin/users', {
      name: 'Grace Agent',
      email: 'grace@example.com',
      password: 'Str0ng!Pass',
    })
    expect(success).toHaveBeenCalledWith('Created Grace Agent.')
  })

  it('shows the server error and stays open', async () => {
    vi.spyOn(api, 'post').mockRejectedValue(new ApiError('User already exists.', 400))
    const onOpenChange = renderDialog()

    fill({ name: 'Grace Agent', email: 'grace@example.com', password: 'Str0ng!Pass' })
    submit()

    expect(await screen.findByText('User already exists.')).toBeInTheDocument()
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})
