import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle, Users } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/display'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/display'
import { Badge, Skeleton } from '@/shared/components/ui/display'
import { cn, formatCurrency, formatDate, getInitials, getMonthLabel, getCurrentMonthKey } from '@/shared/lib/utils'
import { useAuth } from '@/shared/hooks/useAuth'
import { supabase } from '@/shared/lib/supabase'
import type { UserProfile } from '@/shared/types'

interface SharedTx {
  id: string
  description: string
  date: string
  total_amount: number
  split_amount: number
  status: 'pending_approval' | 'approved' | 'rejected'
  direction: 'sent' | 'received'
  category: string
  transaction_id: string
}

const MONTHS = [
  { value: 'all', label: 'Tudo' },
  ...Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return { value: key, label: getMonthLabel(key) }
  }),
]

export default function FriendProfilePage() {
  const { friendId } = useParams<{ friendId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [monthFilter, setMonthFilter] = useState(getCurrentMonthKey())
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending_approval'>('all')

  // ── Perfil do amigo ──────────────────────────────────────
  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ['profile', 'friend', friendId],
    queryFn: async (): Promise<UserProfile | null> => {
      const { data } = await supabase
        .from('user_profiles').select('*').eq('user_id', friendId!).maybeSingle()
      return data
    },
    enabled: !!friendId,
  })

  // ── Histórico compartilhado — query única sem N+1 ─────────
  const { data: allTxs = [], isLoading: loadingTxs } = useQuery({
    queryKey: ['shared-history', user?.id, friendId],
    queryFn: async (): Promise<SharedTx[]> => {
      if (!user?.id || !friendId) return []

      // Busca todos os shared_transactions onde um dos dois é remetente e o outro destinatário
      // Query 1: eu enviei para o amigo
      const { data: sent } = await supabase
        .from('shared_transactions')
        .select('id, split_amount, status, transaction_id, transaction:transactions!inner(description, date, amount, category, user_id)')
        .eq('shared_with_user_id', friendId)
        .filter('transaction.user_id', 'eq', user.id)
        .order('created_at', { ascending: false })

      // Query 2: amigo enviou para mim
      const { data: received } = await supabase
        .from('shared_transactions')
        .select('id, split_amount, status, transaction_id, transaction:transactions!inner(description, date, amount, category, user_id)')
        .eq('shared_with_user_id', user.id)
        .filter('transaction.user_id', 'eq', friendId)
        .order('created_at', { ascending: false })

      const normalize = (rows: typeof sent, dir: 'sent' | 'received'): SharedTx[] =>
        (rows ?? []).map((row) => {
          const tx = (row.transaction as unknown) as { description: string; date: string; amount: number; category: string }
          return {
            id: row.id,
            transaction_id: row.transaction_id,
            description: tx.description,
            date: tx.date,
            total_amount: Math.abs(tx.amount),
            split_amount: row.split_amount,
            status: row.status as SharedTx['status'],
            direction: dir,
            category: tx.category,
          }
        })

      return [...normalize(sent, 'sent'), ...normalize(received, 'received')]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    },
    enabled: !!user?.id && !!friendId,
  })

  const isLoading = loadingProfile || loadingTxs

  const filtered = useMemo(() => {
    return allTxs.filter((t) => {
      const matchMonth = monthFilter === 'all' || t.date.startsWith(monthFilter)
      const matchStatus = statusFilter === 'all' || t.status === statusFilter
      return matchMonth && matchStatus
    })
  }, [allTxs, monthFilter, statusFilter])

  const sentTotal = filtered.filter((t) => t.direction === 'sent' && t.status === 'approved')
    .reduce((s, t) => s + t.split_amount, 0)
  const receivedTotal = filtered.filter((t) => t.direction === 'received' && t.status === 'approved')
    .reduce((s, t) => s + t.split_amount, 0)
  const pendingTotal = filtered.filter((t) => t.status === 'pending_approval')
    .reduce((s, t) => s + t.split_amount, 0)
  const balance = sentTotal - receivedTotal

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/social')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {loadingProfile ? <Skeleton className="h-12 w-12 rounded-full" /> : (
            <Avatar className="h-12 w-12 shrink-0">
              {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
              <AvatarFallback className="text-base bg-primary/10 text-primary">
                {getInitials(profile?.display_name)}
              </AvatarFallback>
            </Avatar>
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-display font-semibold truncate">
              {profile?.display_name ?? profile?.username ?? 'Carregando...'}
            </h1>
            {profile?.username && <p className="text-sm text-muted-foreground">@{profile.username}</p>}
          </div>
        </div>
      </div>

      {/* Saldo */}
      <Card className={cn('border-2', balance === 0 ? 'border-border' : balance > 0 ? 'border-[hsl(var(--income)/0.4)] bg-[hsl(var(--income)/0.05)]' : 'border-[hsl(var(--expense)/0.4)] bg-[hsl(var(--expense)/0.05)]')}>
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center gap-4">
            <div className={cn('flex items-center justify-center w-12 h-12 rounded-full shrink-0', balance === 0 ? 'bg-secondary' : balance > 0 ? 'bg-[hsl(var(--income)/0.15)]' : 'bg-[hsl(var(--expense)/0.15)]')}>
              {balance === 0 ? <span className="text-xl">🤝</span>
                : balance > 0 ? <ArrowDownCircle className="h-6 w-6 text-[hsl(var(--income))]" />
                : <ArrowUpCircle className="h-6 w-6 text-[hsl(var(--expense))]" />}
            </div>
            <div>
              <p className={cn('text-2xl font-display font-bold', balance === 0 ? 'text-foreground' : balance > 0 ? 'text-[hsl(var(--income))]' : 'text-[hsl(var(--expense))]')}>
                {balance === 0 ? 'Quites!' : formatCurrency(Math.abs(balance))}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {balance === 0 ? 'Nenhum valor pendente entre vocês'
                  : balance > 0 ? `${profile?.display_name ?? 'Seu amigo'} te deve este valor`
                  : `Você deve este valor para ${profile?.display_name ?? 'seu amigo'}`}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Big numbers */}
      <div className="grid grid-cols-3 gap-3">
        <div className="stat-card">
          <div className="flex items-center gap-2 text-muted-foreground"><TrendingUp className="h-4 w-4" /><span className="text-xs">Você cobrou</span></div>
          <p className="text-lg font-display font-semibold text-[hsl(var(--income))]">{formatCurrency(sentTotal)}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-muted-foreground"><TrendingDown className="h-4 w-4" /><span className="text-xs">Você pagou</span></div>
          <p className="text-lg font-display font-semibold text-[hsl(var(--expense))]">{formatCurrency(receivedTotal)}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-muted-foreground"><span className="text-xs">⏳ Pendente</span></div>
          <p className="text-lg font-display font-semibold text-amber-500">{formatCurrency(pendingTotal)}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-thin">
          {MONTHS.map((m) => (
            <button key={m.value} onClick={() => setMonthFilter(m.value)}
              className={cn('shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize',
                monthFilter === m.value ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground')}>
              {m.label}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg border border-border overflow-hidden text-xs">
          {([['all', 'Todos'], ['approved', 'Aprovados'], ['pending_approval', 'Pendentes']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setStatusFilter(v)}
              className={cn('px-3 py-1.5 font-medium transition-colors',
                statusFilter === v ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-secondary')}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Histórico */}
      <Card>
        <CardHeader><CardTitle>Histórico compartilhado</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="flex gap-3"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 flex-1" /><Skeleton className="h-4 w-20" /></div>)}</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <Users className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma transação compartilhada neste período.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((tx) => (
                <li key={tx.id} className="flex items-center gap-3 py-3">
                  <div className={cn('flex items-center justify-center w-8 h-8 rounded-full shrink-0 text-sm',
                    tx.direction === 'sent' ? 'bg-[hsl(var(--income)/0.12)] text-[hsl(var(--income))]' : 'bg-[hsl(var(--expense)/0.12)] text-[hsl(var(--expense))]')}>
                    {tx.direction === 'sent' ? '↗' : '↙'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{tx.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(tx.date)} · {tx.category.replace(/^\p{Emoji}\s*/u, '')} · <span className="text-foreground/60">{tx.direction === 'sent' ? 'Você cobrou' : 'Você pagou'}</span>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn('font-mono text-sm font-semibold', tx.direction === 'sent' ? 'text-[hsl(var(--income))]' : 'text-[hsl(var(--expense))]')}>
                      {tx.direction === 'sent' ? '+' : '-'} {formatCurrency(tx.split_amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">de {formatCurrency(tx.total_amount)}</p>
                  </div>
                  <Badge variant={tx.status === 'approved' ? 'approved' : tx.status === 'rejected' ? 'rejected' : 'pending'}>
                    {tx.status === 'approved' ? 'Aprovado' : tx.status === 'rejected' ? 'Recusado' : 'Pendente'}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}