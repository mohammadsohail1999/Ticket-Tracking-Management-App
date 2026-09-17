import { Outlet } from 'react-router-dom'
import Navbar from '@/components/Navbar'

export default function AppLayout() {
  return (
    <div className="flex min-h-svh flex-col bg-muted/40">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 p-8">
        <Outlet />
      </main>
    </div>
  )
}
