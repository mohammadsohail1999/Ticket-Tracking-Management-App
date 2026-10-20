import { fireEvent, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from '@/lib/api'
import { renderWithProviders } from '@/test/render'
import type { User } from '@/types/user'
import UsersPage from './UsersPage'

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: 'u1',
  name: 'Ada Admin',
  email: 'ada@example.com',
  role: 'admin',
  banned: false,
  deletedAt: null,
  createdAt: '2026-03-15T12:00:00.000Z',
  ...overrides,
})

function mockUsers(users: User[]) {
  return vi.spyOn(api, 'get').mockResolvedValue({ data: { users } })
}

const renderPage = () => renderWithProviders(<UsersPage />)

afterEach(() => {
  vi.restoreAllMocks()
})

describe('UsersPage', () => {
  it('requests the admin users endpoint', async () => {
    const spy = mockUsers([makeUser()])
    renderPage()

    await screen.findByText('Ada Admin')
    expect(spy).toHaveBeenCalledWith('/api/admin/users')
  })

  describe('loading', () => {
    it('shows the loading description and 5 skeleton rows', () => {
      vi.spyOn(api, 'get').mockReturnValue(new Promise(() => {}))
      const { container } = renderPage()

      expect(screen.getByText('Loading...')).toBeInTheDocument()
      // 1 header row + 5 skeleton rows
      expect(screen.getAllByRole('row')).toHaveLength(6)
      expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(30)
      expect(screen.queryByText('Ada Admin')).not.toBeInTheDocument()
    })
  })

  describe('success', () => {
    it('renders the page heading and table headers', async () => {
      mockUsers([makeUser()])
      
      renderPage()

      expect(screen.getByRole('heading', { name: 'Users' })).toBeInTheDocument()

      await screen.findByText('Ada Admin')

      for (const name of ['Name', 'Email', 'Role', 'Status', 'Created']) {
        expect(screen.getByRole('columnheader', { name })).toBeInTheDocument()
      }

    })

    it('renders one row per user with the total count', async () => {
      mockUsers([
        makeUser(),
        makeUser({ id: 'u2', name: 'Alan Agent', email: 'alan@example.com', role: 'agent' }),
      ])

      renderPage()

      await screen.findByText('Ada Admin')
      expect(screen.getByText('2 total')).toBeInTheDocument()
      expect(screen.getByText('ada@example.com')).toBeInTheDocument()
      expect(screen.getByText('Alan Agent')).toBeInTheDocument()
      expect(screen.getByText('alan@example.com')).toBeInTheDocument()
      // header row + 2 users
      expect(screen.getAllByRole('row')).toHaveLength(3)
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    })

    it('shows the role badge, and none when role is null', async () => {
      mockUsers([
        makeUser({ id: 'u1', name: 'Ada Admin', role: 'admin' }),
        makeUser({ id: 'u2', name: 'Alan Agent', role: 'agent' }),
        makeUser({ id: 'u3', name: 'No Role', role: null }),
      ])
      renderPage()

      const adminRow = (await screen.findByText('Ada Admin')).closest('tr')!
      const agentRow = screen.getByText('Alan Agent').closest('tr')!
      const noRoleRow = screen.getByText('No Role').closest('tr')!

      expect(within(adminRow).getByText('admin')).toBeInTheDocument()
      expect(within(agentRow).getByText('agent')).toBeInTheDocument()
      expect(within(noRoleRow).queryByText(/^(admin|agent)$/)).not.toBeInTheDocument()
    })

    it('shows Banned for banned users and Active for false or null', async () => {
      mockUsers([
        makeUser({ id: 'u1', name: 'Banned One', banned: true }),
        makeUser({ id: 'u2', name: 'Active One', banned: false }),
        makeUser({ id: 'u3', name: 'Null One', banned: null }),
      ])
      renderPage()

      const bannedRow = (await screen.findByText('Banned One')).closest('tr')!
      const activeRow = screen.getByText('Active One').closest('tr')!
      const nullRow = screen.getByText('Null One').closest('tr')!

      expect(within(bannedRow).getByText('Banned')).toBeInTheDocument()
      expect(within(bannedRow).queryByText('Active')).not.toBeInTheDocument()
      expect(within(activeRow).getByText('Active')).toBeInTheDocument()
      expect(within(nullRow).getByText('Active')).toBeInTheDocument()
    })

    it('formats the created date for the current locale', async () => {
      const user = makeUser()
      mockUsers([user])
      renderPage()

      const row = (await screen.findByText('Ada Admin')).closest('tr')!
      expect(
        within(row).getByText(new Date(user.createdAt).toLocaleDateString()),
      ).toBeInTheDocument()
    })
  })

  describe('create user', () => {
    it('opens the create-user dialog from the button', async () => {
      mockUsers([makeUser()])
      renderPage()
      await screen.findByText('Ada Admin')

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: /create user/i }))

      expect(await screen.findByRole('dialog')).toHaveTextContent('Create user')
    })
  })

  describe('edit user', () => {
    it('opens the edit dialog prefilled with the clicked user', async () => {
      mockUsers([
        makeUser(),
        makeUser({ id: 'u2', name: 'Alan Agent', email: 'alan@example.com', role: 'agent' }),
      ])
      renderPage()
      await screen.findByText('Alan Agent')

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Edit Alan Agent' }))

      const dialog = await screen.findByRole('dialog')
      expect(dialog).toHaveTextContent('Edit user')
      expect(within(dialog).getByLabelText('Name')).toHaveValue('Alan Agent')
      expect(within(dialog).getByLabelText('Email')).toHaveValue('alan@example.com')
    })
  })

  describe('delete user', () => {
    const agent = makeUser({ id: 'u2', name: 'Alan Agent', email: 'alan@example.com', role: 'agent' })

    it('offers Delete on agent rows but not on admin rows', async () => {
      mockUsers([makeUser(), agent])
      renderPage()
      await screen.findByText('Alan Agent')

      expect(screen.getByRole('button', { name: 'Delete Alan Agent' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Delete Ada Admin' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Edit Ada Admin' })).toBeInTheDocument()
    })

    it('opens the confirmation dialog for the clicked user', async () => {
      mockUsers([makeUser(), agent])
      renderPage()
      await screen.findByText('Alan Agent')

      fireEvent.click(screen.getByRole('button', { name: 'Delete Alan Agent' }))

      const dialog = await screen.findByRole('dialog')
      expect(dialog).toHaveTextContent('Delete user')
      expect(dialog).toHaveTextContent('Alan Agent')
    })

    it('shows a Deleted badge and no actions for deleted users', async () => {
      mockUsers([makeUser({ ...agent, banned: true, deletedAt: '2026-03-16T12:00:00.000Z' })])
      renderPage()

      const row = (await screen.findByText('Alan Agent')).closest('tr')!
      expect(within(row).getByText('Deleted')).toBeInTheDocument()
      expect(within(row).queryByText('Banned')).not.toBeInTheDocument()
      expect(within(row).queryByRole('button')).not.toBeInTheDocument()
      // Still listed and counted.
      expect(screen.getByText('1 total')).toBeInTheDocument()
    })
  })

  describe('empty list', () => {
    it('shows 0 total and no user rows', async () => {
      mockUsers([])
      renderPage()

      expect(await screen.findByText('0 total')).toBeInTheDocument()
      // header row only
      expect(screen.getAllByRole('row')).toHaveLength(1)
    })
  })

  describe('error', () => {
    it('shows the error alert and hides the table', async () => {
      vi.spyOn(api, 'get').mockRejectedValue(new ApiError('Forbidden', 403))
      renderPage()

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Could not load users: Forbidden',
      )
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
    })
  })
})
