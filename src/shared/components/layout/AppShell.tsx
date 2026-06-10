import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, BarChart3, Users, CheckSquare,
  Settings, LogOut, User, Compass, FileUp, Target, Search, MoreHorizontal, X
} from 'lucide-react'
import { useState as useMobileMenuState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/shared/lib/utils'
import { useAuth } from '@/shared/hooks/useAuth'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import { Button } from '@/shared/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/display'
import { getInitials } from '@/shared/lib/utils'
import { NotificationBell } from '@/shared/components/ui/NotificationPanel'
import { supabase } from '@/shared/lib/supabase'
import { queryKeys } from '@/shared/lib/queryKeys'

const APP_NAME = 'Checkpoint Financeiro'

const navItems = [
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard'  },
  { to: '/analytics', icon: BarChart3,       label: 'Análises'   },
  { to: '/social',    icon: Users,           label: 'Amigos'     },
  { to: '/approvals', icon: CheckSquare,     label: 'Aprovações' },
  { to: '/search',    icon: Search,          label: 'Buscar'     },
  { to: '/goals',     icon: Target,          label: 'Metas'      },
  { to: '/import',    icon: FileUp,          label: 'Importar'   },
  { to: '/settings',  icon: Settings,        label: 'Ajustes'    },
]

// Mobile: primeiros 4 + botão "mais"
const mobileMainItems = navItems.slice(0, 4)
const mobileMoreItems = navItems.slice(4)

function NavItem({ to, icon: Icon, label }: { to: string; icon: React.ElementType; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
          isActive
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </NavLink>
  )
}

function UserAvatar({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const { user } = useAuth()

  const { data: profile } = useQuery({
    queryKey: queryKeys.profiles.me(user?.id ?? ''),
    queryFn: async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('display_name, avatar_url')
        .eq('user_id', user!.id)
        .maybeSingle()
      return data
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  })

  const sizeClass = size === 'sm' ? 'h-7 w-7' : size === 'lg' ? 'h-10 w-10' : 'h-8 w-8'
  const name = profile?.display_name ?? user?.user_metadata?.full_name ?? user?.email

  return (
    <Avatar className={sizeClass}>
      {profile?.avatar_url && (
        <AvatarImage src={profile.avatar_url} alt={name ?? ''} />
      )}
      <AvatarFallback className="text-xs bg-primary/10 text-primary">
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  )
}

function Sidebar() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const { data: profile } = useQuery({
    queryKey: queryKeys.profiles.me(user?.id ?? ''),
    queryFn: async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('display_name, avatar_url')
        .eq('user_id', user!.id)
        .maybeSingle()
      return data
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  })

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth')
  }

  const name = profile?.display_name ?? user?.user_metadata?.full_name ?? 'Minha conta'

  return (
    <aside className="hidden md:flex flex-col w-60 shrink-0 h-screen sticky top-0 bg-card border-r border-border">
      {/* Logo + sino */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-border">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground shrink-0">
          <Compass className="h-4 w-4" />
        </div>
        <span className="font-display font-semibold text-xs tracking-tight flex-1 leading-tight">
          {APP_NAME}
        </span>
        <NotificationBell />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {navItems.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>

      {/* User footer */}
      <div className="p-3 border-t border-border">
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            cn('flex items-center gap-3 p-2 rounded-lg transition-colors',
              isActive ? 'bg-secondary' : 'hover:bg-secondary')
          }
        >
          <UserAvatar size="md" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{name}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </NavLink>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start mt-1 text-muted-foreground hover:text-destructive"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </aside>
  )
}

function MobileBottomNav() {
  const [showMore, setShowMore] = useMobileMenuState(false)
  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40 px-2 pb-safe">
        <div className="flex items-center justify-around py-1">
          {mobileMainItems.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) =>
                cn('flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-[10px] font-medium transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground')}>
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </NavLink>
          ))}
          <button onClick={() => setShowMore((v) => !v)}
            className={cn('flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-[10px] font-medium transition-colors',
              showMore ? 'text-primary' : 'text-muted-foreground')}>
            {showMore ? <X className="h-5 w-5" /> : <MoreHorizontal className="h-5 w-5" />}
            <span>Mais</span>
          </button>
        </div>
      </nav>

      {/* Menu "mais" */}
      {showMore && (
        <>
          <div className="md:hidden fixed inset-0 z-30 bg-black/20" onClick={() => setShowMore(false)} />
          <div className="md:hidden fixed bottom-16 left-2 right-2 z-40 bg-card border rounded-xl shadow-lg p-2 grid grid-cols-4 gap-1">
            {mobileMoreItems.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} onClick={() => setShowMore(false)}
                className={({ isActive }) =>
                  cn('flex flex-col items-center gap-1 p-3 rounded-lg text-[10px] font-medium transition-colors',
                    isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary')}>
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        </>
      )}
    </>
  )
}

function MobileHeader() {
  const navigate = useNavigate()
  return (
    <header className="md:hidden sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary text-primary-foreground">
            <Compass className="h-3.5 w-3.5" />
          </div>
          <span className="font-display font-semibold text-sm">{APP_NAME}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => navigate('/profile')}>
            <UserAvatar size="sm" />
          </Button>
          <NotificationBell />
        </div>
      </div>
    </header>
  )
}

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const isMobile = useIsMobile()

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {isMobile && <MobileHeader />}
        <main className={cn('flex-1 px-4 py-5 md:px-6 md:py-6', isMobile && 'pb-24')}>
          {children}
        </main>
      </div>
      <MobileBottomNav />
    </div>
  )
}