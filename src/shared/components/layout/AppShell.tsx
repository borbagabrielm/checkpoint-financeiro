import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, BarChart3, Users, CheckSquare,
  Settings, LogOut, FileUp, Target, Search, MoreHorizontal, X, Sun, Moon
} from 'lucide-react'
import { useState as useMobileMenuState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/shared/lib/utils'
import { useAuth } from '@/shared/hooks/useAuth'
import { useTheme } from '@/shared/hooks/useTheme'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import { Button } from '@/shared/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/display'
import { getInitials } from '@/shared/lib/utils'
import { NotificationBell } from '@/shared/components/ui/NotificationPanel'
import { supabase } from '@/shared/lib/supabase'
import { queryKeys } from '@/shared/lib/queryKeys'

const APP_NAME = 'Raxo'

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

const mobileMainItems = navItems.slice(0, 4)
const mobileMoreItems = navItems.slice(4)

// ─── Logo SVG adaptivo ao tema ────────────────────────────────
// O % usa --logo-accent: azul em light, lime em dark (definido no CSS)
function RaxoLogo({ height = 28 }: { height?: number }) {
  return (
    <svg viewBox="322 194 380 120" height={height} xmlns="http://www.w3.org/2000/svg" aria-label="Raxo">
      {/* Ra */}
      <path d="M381.1,306.23h32.17l-22.16-40.68c5.65-2.72,10.11-6.56,13.34-11.57,3.46-5.36,5.19-11.95,5.19-19.76s-1.69-14.38-5.06-19.92c-3.37-5.54-8.1-9.78-14.17-12.73-6.07-2.95-13.16-4.42-21.25-4.42h-47.09v109.09h29.62v-36.01h10.25l19.15,36.01ZM351.7,220.78h10.44c3.48,0,6.45.47,8.92,1.41,2.47.94,4.37,2.4,5.7,4.37,1.33,1.97,2,4.52,2,7.64s-.67,5.59-2,7.51-3.23,3.31-5.7,4.18c-2.47.87-5.44,1.3-8.92,1.3h-10.44v-26.42Z" className="fill-foreground"/>
      <path d="M416.19,284.59c0-15.2,10.74-24.62,30.57-26.11l23.14-1.82v-1.32c0-8.1-4.96-12.39-14.05-12.39-10.74,0-16.53,4.13-16.53,11.57h-21.15c0-18.67,15.37-30.9,39-30.9s37.51,13.39,37.51,37.02v48.26h-22.48l-1.65-10.91c-2.64,7.6-13.55,13.05-25.95,13.05-17.52,0-28.42-10.25-28.42-26.44ZM470.07,277.98v-4.46l-12.89,1.16c-11.07.99-15.04,3.47-15.04,8.76,0,5.95,3.64,8.76,11.4,8.76,9.75,0,16.53-4.79,16.53-14.21Z" className="fill-foreground"/>
      {/* % — cor via CSS var --logo-accent */}
      <polygon points="582.48,230.12 530.02,308.99 501.15,308.99 553.61,230.12 582.48,230.12" fill="hsl(var(--logo-accent))"/>
      <circle cx="515.62" cy="244.36" r="14.47" fill="hsl(var(--logo-accent))"/>
      <circle cx="568.01" cy="293.67" r="14.47" fill="hsl(var(--logo-accent))"/>
      {/* o */}
      <path d="M629.26,223.62c25.68,0,44.42,17.12,44.42,42.64s-18.74,42.48-44.42,42.48-44.58-16.96-44.58-42.48,18.74-42.64,44.58-42.64ZM629.26,286.45c11.47,0,19.38-8.08,19.38-20.35s-7.91-20.19-19.38-20.19-19.54,8.08-19.54,20.19,7.91,20.35,19.54,20.35Z" className="fill-foreground"/>
    </svg>
  )
}

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
      {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={name ?? ''} />}
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
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-border">
        <div className="flex-1 min-w-0">
          <RaxoLogo height={28} />
        </div>
        <NotificationBell />
      </div>

      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {navItems.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>

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
        <div className="flex items-center gap-2 mt-1">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 justify-start text-muted-foreground hover:text-destructive"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
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
        <RaxoLogo height={22} />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={() => navigate('/profile')}>
            <UserAvatar size="sm" />
          </Button>
          <NotificationBell />
        </div>
      </div>
    </header>
  )
}

interface AppShellProps { children: React.ReactNode }

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


// ─── Theme Toggle ─────────────────────────────────────────────
function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors shrink-0"
      title={theme === 'dark' ? 'Mudar para claro' : 'Mudar para escuro'}
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}