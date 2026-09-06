import { useState, useRef, useEffect } from 'react'
import { Plus, TrendingUp, TrendingDown, Wallet, Clock, RefreshCw, CheckSquare, AlertTriangle } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/display'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/feedback'
import { Skeleton } from '@/shared/components/ui/display'
import { formatCurrency, getMonthLabel, getCurrentMonthKey, getMonthOptions, cn } from '@/shared/lib/utils'
import { useTransactions } from '@/features/transactions/hooks/useTransactions'
import { TransactionForm } from '@/features/transactions/components/TransactionForm'
import { TransactionList } from '@/features/transactions/components/TransactionList'
import { MonthlyAreaChart } from '@/features/analytics/components/Charts'
import { useAnalytics } from '@/features/analytics/hooks/useAnalytics'
import { useBudgets } from '@/features/budgets/hooks/useBudgets'
import { useRecurring } from '@/features/recurring/hooks/useRecurring'
import { useApprovals } from '@/features/shared-expenses/hooks/useApprovals'
import { useNavigate } from 'react-router-dom'
import type { Transaction } from '@/shared/types'

// ─── Stat card com barra de acento no topo ────────────────────
function StatCard({ label, value, icon: Icon, accentColor, valueColor, iconBg, loading, isCount = false }: {
  label: string
  value: number
  icon: React.ElementType
  accentColor: string   // cor da barra topo
  valueColor: string    // cor do valor
  iconBg: string        // bg do ícone
  loading?: boolean
  isCount?: boolean
}) {
  return (
    <div className="stat-card animate-fade-in">
      {/* Barra de acento no topo — usa margem negativa para não quebrar o padding do card */}
      <div className={cn('stat-card-accent-top', accentColor)} />
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <div className={cn('p-2 rounded-lg', iconBg)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      {loading ? <Skeleton className="h-8 w-32" /> : (
        <p className={cn('text-2xl font-display font-bold tracking-tight', valueColor)}>
          {isCount ? value : formatCurrency(value)}
        </p>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [monthFilter, setMonthFilter] = useState(getCurrentMonthKey())
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)

  const { isLoading } = useTransactions()
  const { summary, monthlyStats, transactions: filteredTxs } = useAnalytics(monthFilter)
  const { budgets } = useBudgets()
  const { recurring } = useRecurring()
  const { pending: pendingApprovals } = useApprovals()
  const monthOptions = getMonthOptions()
  const monthScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = monthScrollRef.current?.querySelector<HTMLElement>(`[data-month="${monthFilter}"]`)
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [monthFilter])

  const openAdd = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (tx: Transaction) => { setEditing(tx); setFormOpen(true) }
  const closeForm = () => { setFormOpen(false); setEditing(null) }

  const today = new Date().getDate()
  const upcomingRecurring = recurring
    .filter((r) => r.active && r.day_of_month >= today)
    .sort((a, b) => a.day_of_month - b.day_of_month)
    .slice(0, 3)

  const upcomingTotal = upcomingRecurring
    .filter((r) => r.type === 'expense')
    .reduce((s, r) => s + Math.abs(r.amount), 0)

  const alertBudgets = budgets.filter((b) => (b.percentage ?? 0) >= 70)

  // Cor semântica da barra de orçamento
  const budgetBarColor = (pct: number) => {
    if (pct >= 100) return 'bg-[hsl(var(--expense))]'
    if (pct >= 90)  return 'bg-[hsl(var(--expense))]'
    if (pct >= 70)  return 'bg-[hsl(var(--income-fill))]' // lime fill
    return 'bg-primary'
  }
  const budgetTextColor = (pct: number) => {
    if (pct >= 90) return 'text-[hsl(var(--expense))]'
    if (pct >= 70) return 'text-[hsl(var(--income))]'
    return 'text-muted-foreground'
  }

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="page-header">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Resumo — <span className="text-foreground font-medium capitalize">{getMonthLabel(monthFilter)}</span>
          </p>
        </div>
        {/* Botão CTA principal em lime */}
        <Button
          onClick={openAdd}
          className="shrink-0 bg-[hsl(var(--income-fill))] text-[#0A0A0A] hover:bg-[hsl(var(--income-fill)/0.85)] font-bold shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Nova transação
        </Button>
      </div>

      {/* Filtros de mês */}
      <div ref={monthScrollRef} className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        <button
          data-month="all"
          onClick={() => setMonthFilter('all')}
          className={cn('shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
            monthFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground')}>
          Todos
        </button>
        {monthOptions.map((opt) => (
          <button key={opt.value} data-month={opt.value} onClick={() => setMonthFilter(opt.value)}
            className={cn('shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize',
              monthFilter === opt.value ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground')}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* Stat cards com acento de cor */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Saldo"
          value={summary.balance}
          icon={Wallet}
          accentColor="bg-primary"
          valueColor={summary.balance >= 0 ? 'text-[#3B3BFF] dark:text-[#3B3BFF]' : 'text-[hsl(var(--expense))]'}
          iconBg="bg-primary/10"
          loading={isLoading}
        />
        <StatCard
          label="Receitas"
          value={summary.income}
          icon={TrendingUp}
          accentColor="bg-[hsl(var(--income-fill))]"
          valueColor="text-[hsl(var(--income))]"
          iconBg="bg-[hsl(var(--income-fill)/0.15)]"
          loading={isLoading}
        />
        <StatCard
          label="Despesas"
          value={summary.expense}
          icon={TrendingDown}
          accentColor="bg-[hsl(var(--expense))]"
          valueColor="text-[hsl(var(--expense))]"
          iconBg="bg-[hsl(var(--expense)/0.12)]"
          loading={isLoading}
        />
        <StatCard
          label="Movimentações"
          value={filteredTxs.length}
          icon={Clock}
          accentColor="bg-primary/40"
          valueColor="text-foreground"
          iconBg="bg-secondary"
          loading={isLoading}
          isCount
        />
      </div>

      {/* Alertas inline */}
      <div className="space-y-2">
        {/* Aprovações pendentes */}
        {pendingApprovals.length > 0 && (
          <button
            onClick={() => navigate('/approvals')}
            className="w-full flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3.5 text-left hover:bg-primary/10 transition-colors"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/15 shrink-0">
              <CheckSquare className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {pendingApprovals.length} despesa{pendingApprovals.length > 1 ? 's' : ''} aguardando aprovação
              </p>
              <p className="text-xs text-muted-foreground">Toque para revisar</p>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-primary text-white shrink-0">
              {pendingApprovals.length}
            </span>
          </button>
        )}

        {/* Próximas recorrentes */}
        {upcomingRecurring.length > 0 && (
          <button
            onClick={() => navigate('/settings')}
            className="w-full flex items-center gap-3 rounded-xl border bg-secondary/40 p-3.5 text-left hover:bg-secondary transition-colors"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary shrink-0">
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">
                {upcomingRecurring.map(r => r.description).join(', ')}
              </p>
              {upcomingTotal > 0 && (
                <p className="text-xs text-muted-foreground">
                  Total previsto: <span className="font-mono text-[hsl(var(--expense))]">{formatCurrency(upcomingTotal)}</span>
                </p>
              )}
            </div>
          </button>
        )}

        {/* Orçamentos em alerta — barras semânticas */}
        {alertBudgets.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Orçamentos do mês
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {alertBudgets.map((b) => {
                const pct = Math.round(b.percentage ?? 0)
                return (
                  <div key={b.id} className="space-y-1.5">
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm font-medium truncate max-w-[55%]">{b.category}</span>
                      <span className={cn('font-mono text-xs font-bold', budgetTextColor(pct))}>
                        {pct}% · {formatCurrency(b.spent ?? 0)} / {formatCurrency(b.amount)}
                      </span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-500', budgetBarColor(pct))}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Chart + Transactions */}
      <div className="grid lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Últimos 6 meses</CardTitle></CardHeader>
          <CardContent><MonthlyAreaChart data={monthlyStats} /></CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3"><CardTitle>Transações</CardTitle></CardHeader>
          <CardContent>
            <TransactionList onEdit={openEdit} monthFilter={monthFilter} />
          </CardContent>
        </Card>
      </div>

      <Dialog open={formOpen} onOpenChange={(open) => !open && closeForm()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar transação' : 'Nova transação'}</DialogTitle>
          </DialogHeader>
          <TransactionForm editing={editing} onClose={closeForm} />
        </DialogContent>
      </Dialog>
    </div>
  )
}