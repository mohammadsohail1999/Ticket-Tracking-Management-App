import { useNavigate } from 'react-router-dom'
import { LogOutIcon, TicketIcon } from 'lucide-react'
import { useSession, signOut } from '@/lib/auth-client'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

function initials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email || '?'
  return source
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default function Navbar() {
  const { data: session } = useSession()
  const navigate = useNavigate()
  const user = session?.user

  async function handleLogout() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <nav className="flex items-center justify-between border-b border-border bg-background px-8 py-4">
      <div className="flex items-center gap-2 font-sans font-medium text-foreground">
        <TicketIcon className="size-5 text-primary" />
        Ticket Tracking App
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Avatar className="size-8">
            <AvatarFallback className="bg-accent text-accent-foreground">
              {initials(user?.name, user?.email)}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex flex-col gap-1 font-normal">
            <span className="text-sm font-medium text-foreground">
              {user?.name || user?.email}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {user?.email}
              {user?.role && (
                <Badge variant="secondary" className="capitalize">
                  {user.role}
                </Badge>
              )}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={handleLogout}
          >
            <LogOutIcon />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  )
}
