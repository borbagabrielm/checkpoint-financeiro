import { useState } from 'react'
import { Plus, TrendingUp, TrendingDown, Wallet, Clock, RefreshCw, CheckSquare } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/display'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/feedback'
import { Skeleton } from '@/shared/components/ui/display'
import { formatCurrency, getMonthLabel, getCurrentMonthKey, cn } from '@/shared/lib/utils'
import { useTransactions } from '@/features/transactions/hooks/useTransactions'
import { TransactionForm } from '@/features/transactions/components/TransactionForm'
import { TransactionList } from '@/features/transactions/components/TransactionList'
import { MonthlyAreaChart } from '@/features/analytics/components/Charts'
import { useAnalytics } from '@/features/analytics/hooks/useAnalytics'
import { useBudgets } from '@/features/budgets/hooks/useBudgets'
import { useRecurring } from '@/features/recurring/hooks/useRecurring'
import { useApprovals } from '@/features/shared-expenses/hooks/useApprovals'
import { AlertTriangle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Transaction } from '@/shared/types'

function getMonthOptions() {
  const seen = new Set<string>()
  const options: { value: string; label: string }[] = []
  for (let i = 0; i < 6; i++) {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!seen.has(key)) { seen.add(key); options.push({ value: key, label: getMonthLabel(key) }) }
  }
  return options
}

function StatCard({ label, value, icon: Icon, color, loading, isCount = false }: {
  label: string; value: number; icon: React.ElementType; color: string; loading?: boolean; isCount?: boolean
}) {
  return (
    <div className="stat-card animate-fade-in">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className={`p-2 rounded-lg ${color}`}><Icon className="h-4 w-4" /></div>
      </div>
      {loading ? <Skeleton className="h-7 w-32 mt-1" /> : (
        <p className="text-2xl font-display font-semibold">
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

  const openAdd = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (tx: Transaction) => { setEditing(tx); setFormOpen(true) }
  const closeForm = () => { setFormOpen(false); setEditing(null) }

  // Próximas recorrentes no mês
  const today = new Date().getDate()
  const upcomingRecurring = recurring
    .filter((r) => r.active && r.day_of_month >= today)
    .sort((a, b) => a.day_of_month - b.day_of_month)
    .slice(0, 3)

  const upcomingTotal = upcomingRecurring
    .filter((r) => r.type === 'expense')
    .reduce((s, r) => s + Math.abs(r.amount), 0)

  const alertBudgets = budgets.filter((b) => (b.percentage ?? 0) >= 70)

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
        <Button onClick={openAdd} className="shrink-0">
          <Plus className="h-4 w-4" />
          Nova transação
        </Button>
      </div>

      {/* Filtros de mês */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        <button onClick={() => setMonthFilter('all')}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${monthFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
          Todos
        </button>
        {monthOptions.map((opt) => (
          <button key={opt.value} onClick={() => setMonthFilter(opt.value)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${monthFilter === opt.value ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Saldo" value={summary.balance} icon={Wallet} color="bg-primary/10 text-primary" loading={isLoading} />
        <StatCard label="Receitas" value={summary.income} icon={TrendingUp} color="bg-[hsl(var(--income)/0.12)] text-[hsl(var(--income))]" loading={isLoading} />
        <StatCard label="Despesas" value={summary.expense} icon={TrendingDown} color="bg-[hsl(var(--expense)/0.12)] text-[hsl(var(--expense))]" loading={isLoading} />
        <StatCard label="Movimentações" value={filteredTxs.length} icon={Clock} color="bg-accent/10 text-accent" loading={isLoading} isCount />
      </div>

      {/* Alertas inline */}
      <div className="space-y-2">
        {/* Aprovações pendentes */}
        {pendingApprovals.length > 0 && (
          <button onClick={() => navigate('/approvals')}
            className="w-full flex items-center gap-3 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-900/20 p-3 text-left hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors">
            <CheckSquare className="h-4 w-4 text-amber-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                {pendingApprovals.length} despesa{pendingApprovals.length > 1 ? 's' : ''} aguardando aprovação
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400">Clique para revisar</p>
            </div>
          </button>
        )}

        {/* Próximas recorrentes */}
        {upcomingRecurring.length > 0 && (
          <button onClick={() => navigate('/settings')}
            className="w-full flex items-center gap-3 rounded-lg border bg-secondary/50 p-3 text-left hover:bg-secondary transition-colors">
            <RefreshCw className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                Próximas cobranças: {upcomingRecurring.map(r => r.description).join(', ')}
              </p>
              {upcomingTotal > 0 && (
                <p className="text-xs text-muted-foreground">
                  Total previsto: <span className="font-mono text-[hsl(var(--expense))]">{formatCurrency(upcomingTotal)}</span>
                </p>
              )}
            </div>
          </button>
        )}

        {/* Orçamentos em alerta */}
        {alertBudgets.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Orçamentos do mês
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {alertBudgets.map((b) => (
                <div key={b.id} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="truncate max-w-[60%]">{b.category}</span>
                    <span className={cn('font-mono text-xs', (b.percentage ?? 0) >= 100 ? 'text-destructive font-semibold' : 'text-muted-foreground')}>
                      {formatCurrency(b.spent ?? 0)} / {formatCurrency(b.amount)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all', (b.percentage ?? 0) >= 100 ? 'bg-destructive' : 'bg-amber-500')}
                      style={{ width: `${Math.min(100, b.percentage ?? 0)}%` }} />
                  </div>
                </div>
              ))}
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