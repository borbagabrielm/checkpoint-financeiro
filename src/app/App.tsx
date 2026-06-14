/// <reference types="vite/client" />
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useEffect, useRef, useState } from 'react'
import { AuthProvider, useAuth } from '@/shared/hooks/useAuth'
import { AppShell } from '@/shared/components/layout/AppShell'
import { Toaster } from '@/shared/components/ui/feedback'
import { ErrorBoundary } from '@/shared/components/ui/ErrorBoundary'
import { SplashScreen } from '@/shared/components/ui/SplashScreen'
import { OfflineBanner } from '@/shared/hooks/useOnlineStatus'
import { usePWA } from '@/shared/hooks/usePWA'
import { Onboarding } from '@/shared/components/ui/Onboarding'
import { useRecurringRunner } from '@/features/recurring/hooks/useRecurringRunner'
import { sendFriendRequest } from '@/features/social/services/socialService'

// Pages
import AuthPage from '@/pages/Auth'
import DashboardPage from '@/pages/Dashboard'
import AnalyticsPage from '@/pages/Analytics'
import SocialPage from '@/pages/Social'
import ApprovalsPage from '@/pages/Approvals'
import SettingsPage from '@/pages/Settings'
import ProfilePage from '@/pages/Profile'
import ImportPage from '@/features/import/components/ImportPage'
import FriendProfilePage from '@/pages/FriendProfile'
import InvitePage from '@/pages/InvitePage'
import GoalsPage from '@/pages/Goals'
import SearchPage from '@/pages/SearchPage'

// ─── Query Client — staleTime 0 para sempre buscar dados frescos ──
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,      // 30s de cache padrão
      refetchOnWindowFocus: false,
      gcTime: 5 * 60 * 1000, // mantém cache 5min mesmo com staleTime 0
    },
    mutations: { retry: 0 },
  },
})

// ─── Limpa cache ao trocar de usuário ─────────────────────────
function CacheCleaner() {
  const { user } = useAuth()
  const prevUserId = useRef<string | null>(null)

  useEffect(() => {
    const currentId = user?.id ?? null
    if (prevUserId.current !== null && prevUserId.current !== currentId) {
      // Usuário mudou (logout/login) — limpa todo o cache
      queryClient.clear()
    }
    prevUserId.current = currentId
  }, [user?.id])

  return null
}

// ─── Protected route wrapper ──────────────────────────────────
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/auth" replace />
  return <OnboardingGuard>{children}</OnboardingGuard>
}

// ─── Onboarding guard ────────────────────────────────────────
function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [done, setDone] = useState(() => !!localStorage.getItem(`onboarding_done_${user?.id}`))
  useRecurringRunner() // Executa recorrentes ao fazer login

  // Processa convite pendente após login/cadastro
  useEffect(() => {
    if (!user?.id) return
    const pendingInvite = localStorage.getItem('pending_invite')
    if (!pendingInvite || pendingInvite === user.id) {
      localStorage.removeItem('pending_invite')
      return
    }
    localStorage.removeItem('pending_invite')
    sendFriendRequest(user.id, pendingInvite)
      .then(() => {
        import('sonner').then(({ toast }) =>
          toast.success('Solicitação de amizade enviada!')
        )
      })
      .catch(() => {})
  }, [user?.id])

  if (!done) {
    return <Onboarding onComplete={() => setDone(true)} userId={user?.id} />
  }
  return <>{children}</>
}

// ─── App Shell wrapper ────────────────────────────────────────
function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/invite/:userId" element={<InvitePage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppShell>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/social" element={<SocialPage />} />
                <Route path="/approvals" element={<ApprovalsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/import" element={<ImportPage />} />
                <Route path="/friend/:friendId" element={<FriendProfilePage />} />
                <Route path="/goals" element={<GoalsPage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AppShell>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

// ─── Root App ─────────────────────────────────────────────────
function PWAInit() {
  usePWA() // registra SW e captura evento de instalação
  return null
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PWAInit />
      <OfflineBanner />
      <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <CacheCleaner />
          <AppRoutes />
          <Toaster />
        </AuthProvider>
      </BrowserRouter>
      </ErrorBoundary>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}