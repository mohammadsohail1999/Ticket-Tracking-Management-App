import { Outlet } from 'react-router-dom'
import Navbar from '../components/Navbar'
import './AppLayout.css'

export default function AppLayout() {
  return (
    <div className="app-layout">
      <Navbar />
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  )
}
