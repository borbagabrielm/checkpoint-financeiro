import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle, Receipt, CircleCheck, Clock, Tag, MessageCircle } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/display'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/display'
import { Badge, Skeleton } from '@/shared/components/ui/display'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { cn, formatCurrency, formatDate, getInitials, getMonthLabel, getCurrentMonthKey } from '@/shared/lib/utils'
import { useAuth } from '@/shared/hooks/useAuth'
import { supabase } from '@/shared/lib/supabase'
import { toast } from 'sonner'
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

// Logo % usado como textura de fundo no header
function PercentWatermark() {
  return (
    <svg viewBox="492 221 90 88" width="120" height="120"
      className="absolute -top-2 -right-5 opacity-[0.08] pointer-events-none"
      xmlns="http://www.w3.org/2000/svg">
      <polygon points="582.48,230.12 530.02,308.99 501.15,308.99 553.61,230.12 582.48,230.12" fill="#fff"/>
      <circle cx="515.62" cy="244.36" r="14.47" fill="#fff"/>
      <circle cx="568.01" cy="293.67" r="14.47" fill="#fff"/>
    </svg>
  )
}

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

  // ── Data de início da amizade ────────────────────────────
  const { data: friendshipSince } = useQuery({
    queryKey: ['friendship-since', user?.id, friendId],
    queryFn: async (): Promise<string | null> => {
      if (!user?.id || !friendId) return null
      const { data } = await supabase
        .from('friendships')
        .select('created_at')
        .eq('status', 'accepted')
        .or(`and(requester_id.eq.${user.id},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${user.id})`)
        .maybeSingle()
      return data?.created_at ?? null
    },
    enabled: !!user?.id && !!friendId,
  })

  // ── Histórico compartilhado — query única sem N+1 ─────────
  const { data: allTxs = [], isLoading: loadingTxs } = useQuery({
    queryKey: ['shared-history', user?.id, friendId],
    queryFn: async (): Promise<SharedTx[]> => {
      if (!user?.id || !friendId) return []

      const { data: sent } = await supabase
        .from('shared_transactions')
        .select('id, split_amount, status, transaction_id, transaction:transactions!inner(description, date, amount, category, user_id)')
        .eq('shared_with_user_id', friendId)
        .filter('transaction.user_id', 'eq', user.id)
        .order('created_at', { ascending: false })

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

  // ── Estatísticas relacionais (sobre todo o histórico, não filtrado) ──
  const approvedCount = allTxs.filter((t) => t.status === 'approved').length
  const pendingCount = allTxs.filter((t) => t.status === 'pending_approval').length
  const totalSharedAllTime = allTxs
    .filter((t) => t.status === 'approved')
    .reduce((s, t) => s + t.split_amount, 0)

  // Categoria mais comum entre os dois (por contagem de transações)
  const topCategory = useMemo(() => {
    if (!allTxs.length) return null
    const counts = new Map<string, number>()
    for (const t of allTxs) {
      const emoji = t.category.match(/^\p{Emoji}/u)?.[0] ?? '🏷️'
      counts.set(emoji, (counts.get(emoji) ?? 0) + 1)
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
    return sorted[0]?.[0] ?? null
  }, [allTxs])

  const friendsSinceLabel = friendshipSince
    ? new Date(friendshipSince).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
    : null

  const handleCharge = () => {
    const msg = `Oi! Pelo Raxo, você tem um saldo de ${formatCurrency(balance)} comigo. Poderia acertar? 😊`
    if (navigator.share) {
      navigator.share({ text: msg }).catch(() => {})
    } else {
      navigator.clipboard.writeText(msg)
      toast.success('Mensagem copiada!')
    }
  }

  return (
    <div className="space-y-4 animate-fade-in max-w-2xl">

      {/* ── Header azul com tudo integrado ──────────────────── */}
      <div className="-mx-4 md:-mx-6 -mt-5 md:-mt-6 bg-primary px-4 md:px-6 pt-4 pb-5 rounded-b-2xl relative overflow-hidden">
        <PercentWatermark />

        <div className="flex items-center gap-3 mb-4 relative z-10">
          <Button variant="ghost" size="icon" className="text-white/70 hover:text-white hover:bg-white/10 shrink-0" onClick={() => navigate('/social')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          {loadingProfile ? <Skeleton className="h-11 w-11 rounded-full bg-white/20" /> : (
            <Avatar className="h-11 w-11 shrink-0 ring-2 ring-white/20">
              {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
              <AvatarFallback className="text-sm bg-[#AAFF47] text-[#0A0A0A] font-bold">
                {getInitials(profile?.display_name)}
              </AvatarFallback>
            </Avatar>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-[17px] font-semibold text-white leading-tight truncate">
              {profile?.display_name ?? profile?.username ?? 'Carregando...'}
            </h1>
            {friendsSinceLabel && (
              <p className="text-xs text-white/50 mt-0.5">Amigos desde {friendsSinceLabel}</p>
            )}
          </div>
        </div>

        {/* Saldo com ação integrada */}
        {!loadingTxs && (
          <div className="bg-white/[0.08] rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3 relative z-10">
            <div className="min-w-0">
              <p className="text-[11px] text-white/55 leading-none mb-1">
                {balance === 0 ? 'Tudo certo' : balance > 0 ? `${profile?.display_name?.split(' ')[0] ?? 'Ele'} te deve` : 'Você deve'}
              </p>
              <p className="text-[26px] font-black text-[#AAFF47] leading-none tracking-tight">
                {balance === 0 ? '🤝' : formatCurrency(Math.abs(balance))}
              </p>
            </div>
            {balance > 0 && (
              <button
                onClick={handleCharge}
                className="shrink-0 flex items-center gap-1.5 bg-[#AAFF47] text-[#0A0A0A] text-xs font-bold px-3.5 py-2 rounded-full hover:bg-[#AAFF47]/85 transition-colors"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Cobrar
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Estatísticas relacionais ─────────────────────────── */}
      {!loadingTxs && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'transações', value: allTxs.length, icon: Receipt },
            { label: 'aprovadas', value: approvedCount, icon: CircleCheck },
            { label: 'pendentes', value: pendingCount, icon: Clock },
            { label: 'categoria top', value: topCategory ?? '—', icon: Tag, isEmoji: true },
          ].map(({ label, value, icon: Icon, isEmoji }) => (
            <div key={label} className="flex flex-col items-center gap-1 bg-card border border-border rounded-lg p-2.5 text-center">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className={cn('font-bold leading-none mt-0.5', isEmoji ? 'text-base' : 'text-base text-primary')}>
                {value}
              </span>
              <span className="text-[9px] text-muted-foreground leading-tight">{label}</span>
            </div>
          ))}
        </div>
      )}

      {totalSharedAllTime > 0 && (
        <p className="text-center text-xs text-muted-foreground -mt-1">
          Já dividiram <span className="font-semibold text-foreground">{formatCurrency(totalSharedAllTime)}</span> juntos no total
        </p>
      )}

      {/* Big numbers do período filtrado */}
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
          <div className="flex items-center gap-2 text-muted-foreground"><Clock className="h-4 w-4" /><span className="text-xs">Pendente</span></div>
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
            <EmptyState title="Nenhuma transação compartilhada neste período." className="py-10" />
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