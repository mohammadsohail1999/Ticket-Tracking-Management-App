import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api'
import { renderWithProviders } from '@/test/render'
import type { User } from '@/types/user'
import DeleteUserDialog from './DeleteUserDialog'

const user: User = {
  id: 'u2',
  name: 'Alan Agent',
  email: 'alan@example.com',
  role: 'agent',
  banned: false,
  deletedAt: null,
  createdAt: '2026-03-15T12:00:00.000Z',
}

function renderDialog(onOpenChange = vi.fn()) {
  renderWithProviders(<DeleteUserDialog open onOpenChange={onOpenChange} user={user} />)
  return onOpenChange
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('DeleteUserDialog', () => {
  it('names the user being deleted', () => {
    renderDialog()

    expect(screen.getByRole('dialog')).toHaveTextContent('Alan Agent')
    expect(screen.getByRole('dialog')).toHaveTextContent('alan@example.com')
  })

  it('deletes the user, toasts and closes on confirm', async () => {
    const spy = vi
      .spyOn(api, 'delete')
      .mockResolvedValue({ data: { user: { ...user, banned: true, deletedAt: '2026-03-16T12:00:00.000Z' } } })
    const success = vi.spyOn(toast, 'success').mockReturnValue(1)
    const onOpenChange = renderDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(spy).toHaveBeenCalledWith('/api/admin/users/u2')
    expect(success).toHaveBeenCalledWith('Deleted Alan Agent.')
  })

  it('closes without calling the API on cancel', () => {
    const spy = vi.spyOn(api, 'delete')
    const onOpenChange = renderDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(spy).not.toHaveBeenCalled()
  })

  it('shows the server error and stays open on failure', async () => {
    vi.spyOn(api, 'delete').mockRejectedValue(new ApiError('Admin users cannot be deleted', 403))
    const onOpenChange = renderDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Admin users cannot be deleted')
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})
