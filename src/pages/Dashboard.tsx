import { useState } from 'react'
import { Plus, TrendingUp, TrendingDown, Wallet, Clock } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/display'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/shared/components/ui/feedback'
import { Skeleton } from '@/shared/components/ui/display'
import { formatCurrency, getMonthLabel, getCurrentMonthKey } from '@/shared/lib/utils'
import { useTransactions } from '@/features/transactions/hooks/useTransactions'
import { TransactionForm } from '@/features/transactions/components/TransactionForm'
import { TransactionList } from '@/features/transactions/components/TransactionList'
import { MonthlyAreaChart } from '@/features/analytics/components/Charts'
import { useAnalytics } from '@/features/analytics/hooks/useAnalytics'
import type { Transaction } from '@/shared/types'
import { useBudgets } from '@/features/budgets/hooks/useBudgets'
import { AlertTriangle } from 'lucide-react'

// Corrigido: cria um novo Date() para cada iteração evitando mutação do mesmo objeto
function getMonthOptions() {
  const seen = new Set<string>()
  const options: { value: string; label: string }[] = []
  for (let i = 0; i < 6; i++) {
    const d = new Date()
    d.setDate(1) // evita bug de overflow em meses com dias diferentes
    d.setMonth(d.getMonth() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!seen.has(key)) {
      seen.add(key)
      options.push({ value: key, label: getMonthLabel(key) })
    }
  }
  return options
}

function StatCard({
  label, value, icon: Icon, color, loading, isCount = false
}: {
  label: string
  value: number
  icon: React.ElementType
  color: string
  loading?: boolean
  isCount?: boolean
}) {
  return (
    <div className="stat-card animate-fade-in">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      {loading ? (
        <Skeleton className="h-7 w-32 mt-1" />
      ) : (
        <p className="text-2xl font-display font-semibold">
          {isCount ? value : formatCurrency(value)}
        </p>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const [monthFilter, setMonthFilter] = useState(getCurrentMonthKey())
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)

  const { isLoading } = useTransactions()
  const { budgets } = useBudgets()
  const { summary, monthlyStats, transactions: filteredTxs } = useAnalytics(monthFilter)

  // Calculado dentro do componente para sempre refletir a data atual
  const monthOptions = getMonthOptions()

  const openAdd = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (tx: Transaction) => { setEditing(tx); setFormOpen(true) }
  const closeForm = () => { setFormOpen(false); setEditing(null) }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="page-header">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Resumo das suas finanças</p>
        </div>
        <Button onClick={openAdd} className="shrink-0">
          <Plus className="h-4 w-4" />
          Nova transação
        </Button>
      </div>

      {/* Month filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        <button
          onClick={() => setMonthFilter('all')}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            monthFilter === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-muted-foreground hover:text-foreground'
          }`}
        >
          Todos
        </button>
        {monthOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setMonthFilter(opt.value)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
              monthFilter === opt.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Saldo"
          value={summary.balance}
          icon={Wallet}
          color="bg-primary/10 text-primary"
          loading={isLoading}
        />
        <StatCard
          label="Receitas"
          value={summary.income}
          icon={TrendingUp}
          color="bg-[hsl(var(--income)/0.12)] text-[hsl(var(--income))]"
          loading={isLoading}
        />
        <StatCard
          label="Despesas"
          value={summary.expense}
          icon={TrendingDown}
          color="bg-[hsl(var(--expense)/0.12)] text-[hsl(var(--expense))]"
          loading={isLoading}
        />
        <StatCard
          label="Movimentações"
          value={filteredTxs.length}
          icon={Clock}
          color="bg-accent/10 text-accent"
          loading={isLoading}
          isCount
        />
      </div>

      {/* Chart + Transactions */}
      <div className="grid lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Últimos 6 meses</CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyAreaChart data={monthlyStats} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle>Transações</CardTitle>
          </CardHeader>
          <CardContent>
            <TransactionList onEdit={openEdit} monthFilter={monthFilter} />
          </CardContent>
        </Card>
      </div>

      {/* Orçamentos com alerta */}
      {budgets.filter((b) => (b.percentage ?? 0) >= 70).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Orçamentos do mês
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {budgets.filter((b) => (b.percentage ?? 0) >= 70).map((b) => (
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

      {/* Form dialog */}
      <Dialog open={formOpen} onOpenChange={(open) => !open && closeForm()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Editar transação' : 'Nova transação'}
            </DialogTitle>
          </DialogHeader>
          <TransactionForm editing={editing} onClose={closeForm} />
        </DialogContent>
      </Dialog>
    </div>
  )
}