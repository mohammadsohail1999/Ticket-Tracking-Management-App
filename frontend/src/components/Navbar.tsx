import { useNavigate } from 'react-router-dom'
import { useSession, signOut } from '../lib/auth-client'

export default function Navbar() {
  const { data: session } = useSession()
  const navigate = useNavigate()
  const user = session?.user

  async function handleLogout() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <nav className="flex items-center justify-between border-b border-border px-8 py-4">
      <span className="font-sans font-medium text-text-h">Ticket Tracking App</span>
      <div className="flex items-center gap-4">
        <span className="text-text-h">{user?.name ?? user?.email}</span>
        <button
          type="button"
          className="cursor-pointer rounded-md border border-accent-border bg-accent-bg px-3.5 py-1.5 text-accent hover:bg-accent-border"
          onClick={handleLogout}
        >
          Logout
        </button>
      </div>
    </nav>
  )
}
