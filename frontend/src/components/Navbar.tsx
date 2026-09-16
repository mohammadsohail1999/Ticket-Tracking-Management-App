import { useNavigate } from 'react-router-dom'
import { useSession, signOut } from '../lib/auth-client'
import './Navbar.css'

export default function Navbar() {
  const { data: session } = useSession()
  const navigate = useNavigate()
  const user = session?.user

  async function handleLogout() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <nav className="navbar">
      <span className="navbar-brand">Ticket Tracking App</span>
      <div className="navbar-user">
        <span className="navbar-username">{user?.name ?? user?.email}</span>
        <button type="button" className="navbar-logout" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </nav>
  )
}
