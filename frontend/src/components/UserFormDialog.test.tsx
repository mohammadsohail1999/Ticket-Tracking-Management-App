import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api'
import { renderWithProviders } from '@/test/render'
import type { CreateUserResponse, UpdateUserResponse, User } from '@/types/user'
import UserFormDialog from './UserFormDialog'

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

function renderCreate(onOpenChange = vi.fn()) {
  renderWithProviders(<UserFormDialog open onOpenChange={onOpenChange} />)
  return onOpenChange
}

function fillCreate({ name = '', email = '', password = '' }) {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: name } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } })
}

const submitCreate = () => fireEvent.click(screen.getByRole('button', { name: 'Create user' }))

afterEach(() => {
  vi.restoreAllMocks()
})

describe('UserFormDialog (create)', () => {
  it('has only name, email and password fields', () => {
    renderCreate()

    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.queryByLabelText(/role/i)).not.toBeInTheDocument()
  })

  it('toggles password visibility', () => {
    renderCreate()
    const input = screen.getByLabelText('Password')
    expect(input).toHaveAttribute('type', 'password')

    fireEvent.click(screen.getByRole('button', { name: 'Show password text' }))
    expect(input).toHaveAttribute('type', 'text')

    fireEvent.click(screen.getByRole('button', { name: 'Hide password text' }))
    expect(input).toHaveAttribute('type', 'password')
  })

  it('shows validation errors and does not post an empty or short-password form', async () => {
    const post = vi.spyOn(api, 'post')
    renderCreate()

    submitCreate()
    expect(await screen.findByText('Name is required.')).toBeInTheDocument()
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
    expect(screen.getByText('Password must be at least 8 characters.')).toBeInTheDocument()

    fillCreate({ name: 'Grace Agent', email: 'grace@example.com', password: 'short' })
    submitCreate()
    await screen.findByText('Password must be at least 8 characters.')
    expect(post).not.toHaveBeenCalled()
  })

  it('posts exactly name, email and password, then toasts and closes', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: created })
    const success = vi.spyOn(toast, 'success').mockReturnValue(1)
    const onOpenChange = renderCreate()

    fillCreate({ name: 'Grace Agent', email: 'grace@example.com', password: 'Str0ng!Pass' })
    submitCreate()

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
    const onOpenChange = renderCreate()

    fillCreate({ name: 'Grace Agent', email: 'grace@example.com', password: 'Str0ng!Pass' })
    submitCreate()

    expect(await screen.findByText('User already exists.')).toBeInTheDocument()
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})

const existing: User = {
  id: 'u2',
  name: 'Grace Agent',
  email: 'grace@example.com',
  role: 'agent',
  banned: false,
  createdAt: '2026-03-15T12:00:00.000Z',
}

const updatedResponse: UpdateUserResponse = {
  user: { ...existing, name: 'Grace Hopper', email: 'hopper@example.com' },
}

function renderEdit(onOpenChange = vi.fn()) {
  renderWithProviders(<UserFormDialog open user={existing} onOpenChange={onOpenChange} />)
  return onOpenChange
}

function fillEdit({ name, email }: { name: string; email: string }) {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: name } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } })
}

const submitEdit = () => fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

describe('UserFormDialog (edit)', () => {
  it('is prefilled and has only name and email fields', () => {
    renderEdit()

    expect(screen.getByLabelText('Name')).toHaveValue('Grace Agent')
    expect(screen.getByLabelText('Email')).toHaveValue('grace@example.com')
    expect(screen.queryByLabelText(/role/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument()
  })

  it('shows validation errors and does not patch an invalid form', async () => {
    const patch = vi.spyOn(api, 'patch')
    renderEdit()

    fillEdit({ name: '  ', email: 'not-an-email' })
    submitEdit()

    expect(await screen.findByText('Name is required.')).toBeInTheDocument()
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
    expect(patch).not.toHaveBeenCalled()
  })

  it('patches name and email only, then toasts and closes', async () => {
    const patch = vi.spyOn(api, 'patch').mockResolvedValue({ data: updatedResponse })
    const success = vi.spyOn(toast, 'success').mockReturnValue(1)
    const onOpenChange = renderEdit()

    fillEdit({ name: 'Grace Hopper', email: 'hopper@example.com' })
    submitEdit()

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(patch).toHaveBeenCalledWith('/api/admin/users/u2', {
      name: 'Grace Hopper',
      email: 'hopper@example.com',
    })
    expect(success).toHaveBeenCalledWith('Updated Grace Hopper.')
  })

  it('shows the server error and stays open', async () => {
    vi.spyOn(api, 'patch').mockRejectedValue(
      new ApiError('A user with this email already exists', 409),
    )
    const onOpenChange = renderEdit()

    fillEdit({ name: 'Grace Agent', email: 'taken@example.com' })
    submitEdit()

    expect(
      await screen.findByText('A user with this email already exists'),
    ).toBeInTheDocument()
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})
