import { useState, useRef, useEffect } from 'react'
import { Plus, TrendingUp, TrendingDown, Wallet, Clock, RefreshCw, CheckSquare, AlertTriangle } from 'lucide-react'
import { Button, TrailingIcon } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@/shared/components/ui/display'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/feedback'
import { Skeleton } from '@/shared/components/ui/display'
import { StatCard } from '@/shared/components/ui/StatCard'
import { formatCurrency, getMonthLabel, getCurrentMonthKey, getYearMonthOptions, cn } from '@/shared/lib/utils'
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
  const monthOptions = getYearMonthOptions()
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

  // Insight simples: compara despesas do mês vigente com o mês anterior
  const currentMonthKey = getCurrentMonthKey()
  const [insightYear, insightMonth] = currentMonthKey.split('-').map(Number)
  const prevMonthKey = insightMonth === 1 ? `${insightYear - 1}-12` : `${insightYear}-${String(insightMonth - 1).padStart(2, '0')}`
  const currentMonthStats = monthlyStats.find((m) => m.month === currentMonthKey)
  const prevMonthStats = monthlyStats.find((m) => m.month === prevMonthKey)
  const expenseDelta = currentMonthStats && prevMonthStats && prevMonthStats.expense > 0
    ? ((currentMonthStats.expense - prevMonthStats.expense) / prevMonthStats.expense) * 100
    : null

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
    <div className="relative space-y-6 animate-fade-in">
      {/* Onda decorativa — só ambiente, nunca codifica dado real (RAXO-DESIGN-SYSTEM-V2.md §2.5) */}
      <div className="absolute -top-8 -left-8 -right-8 h-36 bg-gradient-wave opacity-[0.07] blur-3xl -z-10 pointer-events-none" aria-hidden="true" />

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="page-header">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Resumo — <span className="text-foreground font-medium capitalize">{getMonthLabel(monthFilter)}</span>
          </p>
        </div>
        {/* Botão CTA principal em lime — ícone circular trailing (padrão Raxo) */}
        <Button
          onClick={openAdd}
          className="shrink-0 bg-[hsl(var(--income-fill))] text-[#0A0A0A] hover:bg-[hsl(var(--income-fill)/0.85)] font-bold shadow-sm justify-between pl-5 pr-2"
        >
          Nova transação
          <TrailingIcon><Plus className="h-4 w-4" /></TrailingIcon>
        </Button>
      </div>

      {/* Filtros de mês */}
      <div ref={monthScrollRef} className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        <button
          data-month="all"
          onClick={() => setMonthFilter('all')}
          className={cn('shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
            monthFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground')}>
          Todos
        </button>
        {monthOptions.map((opt) => (
          <button key={opt.value} data-month={opt.value} onClick={() => setMonthFilter(opt.value)}
            className={cn('shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize',
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
          trend={monthlyStats.map((m) => m.income)}
        />
        <StatCard
          label="Despesas"
          value={summary.expense}
          icon={TrendingDown}
          accentColor="bg-[hsl(var(--expense))]"
          valueColor="text-[hsl(var(--expense))]"
          iconBg="bg-[hsl(var(--expense)/0.12)]"
          loading={isLoading}
          trend={monthlyStats.map((m) => m.expense)}
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

      {/* Insight do mês — card escuro Aurora trazido pro Core */}
      {expenseDelta !== null && Math.abs(expenseDelta) >= 10 && (
        <div className="aurora-card-dark p-5">
          <div className="absolute inset-0 dot-grid-texture opacity-[0.15] pointer-events-none" aria-hidden="true" />
          <div className="relative">
            <p className="text-xs text-white/60 mb-1">Insight do mês</p>
            <p className="font-semibold text-base leading-snug">
              {expenseDelta > 0
                ? `Suas despesas subiram ${expenseDelta.toFixed(0)}% em relação a ${getMonthLabel(prevMonthKey)}`
                : `Suas despesas caíram ${Math.abs(expenseDelta).toFixed(0)}% em relação a ${getMonthLabel(prevMonthKey)}`}
            </p>
          </div>
        </div>
      )}

      {/* Alertas inline */}
      <div className="space-y-2">
        {/* Aprovações pendentes */}
        {pendingApprovals.length > 0 && (
          <button
            onClick={() => navigate('/approvals')}
            className="w-full flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3.5 text-left hover:bg-primary/10 transition-colors"
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
            <Badge className="shrink-0 bg-primary text-primary-foreground">
              {pendingApprovals.length}
            </Badge>
          </button>
        )}

        {/* Próximas recorrentes */}
        {upcomingRecurring.length > 0 && (
          <button
            onClick={() => navigate('/settings')}
            className="w-full flex items-center gap-3 rounded-lg border bg-secondary/40 p-3.5 text-left hover:bg-secondary transition-colors"
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
          <CardHeader><CardTitle>Últimos 12 meses</CardTitle></CardHeader>
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