import { useState } from 'react'
import {
  Plus, TrendingUp, TrendingDown, Wallet, RefreshCw, CheckSquare, AlertTriangle, Heart, HeartCrack,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button, TrailingIcon } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, Badge, Skeleton } from '@/shared/components/ui/display'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/feedback'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/form-elements'
import { StatCard } from '@/shared/components/ui/StatCard'
import { Gauge } from '@/shared/components/ui/Gauge'
import { formatCurrency, getMonthLabel, getCurrentMonthKey, getYearMonthOptions, cn } from '@/shared/lib/utils'
import { useTransactions } from '@/features/transactions/hooks/useTransactions'
import { TransactionForm } from '@/features/transactions/components/TransactionForm'
import { TransactionList } from '@/features/transactions/components/TransactionList'
import { MonthlyAreaChart } from '@/features/analytics/components/Charts'
import { useAnalytics } from '@/features/analytics/hooks/useAnalytics'
import { useBudgets } from '@/features/budgets/hooks/useBudgets'
import { useRecurring } from '@/features/recurring/hooks/useRecurring'
import { useApprovals } from '@/features/shared-expenses/hooks/useApprovals'
import { useGoals } from '@/features/goals/hooks/useGoals'
import { useFriends } from '@/features/social/hooks/useFriends'
import type { Transaction } from '@/shared/types'

export default function HomePage() {
  const navigate = useNavigate()
  const [monthFilter, setMonthFilter] = useState(getCurrentMonthKey())
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)

  const { isLoading } = useTransactions()
  const { summary, monthlyStats, transactions: filteredTxs } = useAnalytics(monthFilter)
  const { budgets } = useBudgets()
  const { recurring } = useRecurring()
  const { pending: pendingApprovals } = useApprovals()
  const { goals } = useGoals()
  const { accepted: friends } = useFriends()
  const monthOptions = getYearMonthOptions()

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

  // Comparativo com o mês anterior — usado nos StatCards e no card de insight
  const currentMonthKey = getCurrentMonthKey()
  const [insightYear, insightMonth] = currentMonthKey.split('-').map(Number)
  const prevMonthKey = insightMonth === 1 ? `${insightYear - 1}-12` : `${insightYear}-${String(insightMonth - 1).padStart(2, '0')}`
  const currentMonthStats = monthlyStats.find((m) => m.month === currentMonthKey)
  const prevMonthStats = monthlyStats.find((m) => m.month === prevMonthKey)
  const pctDelta = (curr?: number, prev?: number) =>
    curr !== undefined && prev !== undefined && prev > 0 ? ((curr - prev) / prev) * 100 : null
  const incomeDelta = pctDelta(currentMonthStats?.income, prevMonthStats?.income)
  const expenseDelta = pctDelta(currentMonthStats?.expense, prevMonthStats?.expense)
  const balanceDelta = pctDelta(currentMonthStats?.balance, prevMonthStats?.balance)

  const buildCaption = (curr?: number, prev?: number) => {
    if (curr === undefined || prev === undefined) return undefined
    const diff = curr - prev
    if (Math.abs(diff) < 0.5) return undefined
    return `${diff >= 0 ? '↗' : '↘'} ${formatCurrency(Math.abs(diff))} ${diff >= 0 ? 'a mais' : 'a menos'} que ${getMonthLabel(prevMonthKey)}`
  }
  const incomeCaption = buildCaption(currentMonthStats?.income, prevMonthStats?.income)
  const expenseCaption = buildCaption(currentMonthStats?.expense, prevMonthStats?.expense)
  const balanceCaption = buildCaption(currentMonthStats?.balance, prevMonthStats?.balance)

  // Janela de 6 meses (3 pra trás + atual + 2 pra frente) pro mini gráfico de barras
  const currentIdx = monthlyStats.findIndex((m) => m.month === currentMonthKey)
  const windowStart = currentIdx >= 0 ? Math.max(0, currentIdx - 3) : Math.max(0, monthlyStats.length - 6)
  const trendWindow = monthlyStats.slice(windowStart, windowStart + 6)
  const trendHighlightIndex = currentIdx >= 0 ? currentIdx - windowStart : trendWindow.length - 1

  const barPctFor = (key: 'income' | 'expense' | 'balance') => {
    const max = Math.max(...trendWindow.map((m) => Math.abs(m[key])), 1)
    const current = currentMonthStats?.[key] ?? 0
    return Math.max(0, (current / max) * 100)
  }

  // Metas — progresso agregado (não escopado ao mês, é o total guardado até agora)
  const totalGuardado = goals.reduce((s, g) => s + g.current_amount, 0)
  const avgGoalsPct = goals.length
    ? goals.reduce((s, g) => s + Math.min(100, (g.current_amount / g.target_amount) * 100), 0) / goals.length
    : 0

  // Saúde financeira — quanto das receitas as despesas do mês representam
  const healthPct = summary.income > 0
    ? (summary.expense / summary.income) * 100
    : (summary.expense > 0 ? 999 : 0)
  const healthState: 'good' | 'warning' | 'danger' =
    healthPct <= 85 ? 'good' : healthPct <= 100 ? 'warning' : 'danger'
  const HEALTH_COLORS = {
    good:    { circle: '#AAFF47', icon: '#0A0A0A' },
    warning: { circle: '#F59E0B', icon: '#0A0A0A' },
    danger:  { circle: '#FF4747', icon: '#FFFFFF' },
  } as const
  const HealthIcon = healthState === 'danger' ? HeartCrack : Heart

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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="page-header">
          <h1 className="page-title">Sua jornada financeira</h1>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Button
            onClick={openAdd}
            className="shrink-0 bg-[hsl(var(--income-fill))] text-[#0A0A0A] hover:bg-[hsl(var(--income-fill)/0.85)] font-bold shadow-sm justify-between pl-5 pr-2"
          >
            Nova transação
            <TrailingIcon><Plus className="h-4 w-4" /></TrailingIcon>
          </Button>

          {/* Saúde financeira — quanto das receitas as despesas do mês já consumiram */}
          <div className="rounded-lg border bg-card p-4 w-full sm:w-[290px] shrink-0">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="text-sm font-semibold">Saúde Financeira</h3>
              <div
                className="flex items-center justify-center h-8 w-8 rounded-full shrink-0"
                style={{ background: HEALTH_COLORS[healthState].circle }}
              >
                <HealthIcon className="h-4 w-4" style={{ color: HEALTH_COLORS[healthState].icon }} />
              </div>
            </div>

            <div className="relative mb-4">
              <div className="aurora-progress-track">
                <div
                  className="aurora-progress-fill"
                  style={{ width: `${Math.min(100, healthPct)}%`, background: HEALTH_COLORS[healthState].circle }}
                />
              </div>
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                style={{ left: `${Math.min(100, healthPct)}%` }}
              >
                <span className="aurora-diamond border-2 border-white shadow-sm" style={{ background: HEALTH_COLORS[healthState].circle }} />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Saldo</p>
                <p className={cn('text-base font-bold font-mono',
                  summary.balance >= 0 ? 'text-[#3B3BFF]' : 'text-[hsl(var(--expense))]')}>
                  {formatCurrency(summary.balance)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Comprometido</p>
                <p className="text-base font-bold font-mono">{Math.round(healthPct)}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filtro de período */}
      <Select value={monthFilter} onValueChange={setMonthFilter}>
        <SelectTrigger className="w-auto h-auto gap-1.5 rounded-full border-0 bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-primary/90 focus:ring-2 focus:ring-ring focus:ring-offset-2">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {monthOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="capitalize">
              {opt.value === getCurrentMonthKey() ? 'Este mês' : opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Métricas soltas */}
      <div className="grid sm:grid-cols-3 gap-3">
        <StatCard
          label="Receitas"
          value={summary.income}
          icon={TrendingUp}
          accentColor="bg-[hsl(var(--income-fill))]"
          valueColor="text-[hsl(var(--income))]"
          iconBg="bg-[hsl(var(--income-fill)/0.15)]"
          loading={isLoading}
          delta={incomeDelta}
          caption={incomeCaption}
          barPct={barPctFor('income')}
          barColor="hsl(var(--income))"
          trendBars={trendWindow.map((m) => ({ label: m.label, value: m.income }))}
          trendHighlightIndex={trendHighlightIndex}
          trendHighlightLabel={incomeDelta !== null ? `${incomeDelta >= 0 ? '+' : ''}${incomeDelta.toFixed(0)}%` : undefined}
        />
        <StatCard
          label="Despesas"
          value={summary.expense}
          icon={TrendingDown}
          accentColor="bg-[hsl(var(--expense))]"
          valueColor="text-[hsl(var(--expense))]"
          iconBg="bg-[hsl(var(--expense)/0.12)]"
          loading={isLoading}
          delta={expenseDelta}
          caption={expenseCaption}
          barPct={barPctFor('expense')}
          barColor="hsl(var(--expense))"
          trendBars={trendWindow.map((m) => ({ label: m.label, value: m.expense }))}
          trendHighlightIndex={trendHighlightIndex}
          trendHighlightLabel={expenseDelta !== null ? `${expenseDelta >= 0 ? '+' : ''}${expenseDelta.toFixed(0)}%` : undefined}
        />
        <StatCard
          label="Saldo"
          value={summary.balance}
          icon={Wallet}
          accentColor="bg-primary"
          valueColor={summary.balance >= 0 ? 'text-[#3B3BFF]' : 'text-[hsl(var(--expense))]'}
          iconBg="bg-primary/10"
          loading={isLoading}
          delta={balanceDelta}
          caption={balanceCaption}
          barPct={barPctFor('balance')}
          barColor="#3B3BFF"
          trendBars={trendWindow.map((m) => ({ label: m.label, value: m.balance }))}
          trendHighlightIndex={trendHighlightIndex}
          trendHighlightLabel={balanceDelta !== null ? `${balanceDelta >= 0 ? '+' : ''}${balanceDelta.toFixed(0)}%` : undefined}
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

      {/* Metas + Amigos — resumo com link pra tela cheia */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-5 flex items-center gap-4">
            <Gauge
              value={avgGoalsPct}
              size={72}
              strokeWidth={7}
              color="#AAFF47"
              label={<span className="text-xs font-bold text-foreground">{avgGoalsPct.toFixed(0)}%</span>}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Metas</p>
              <p className="text-xs text-muted-foreground mb-2 truncate">
                {goals.length} meta{goals.length === 1 ? '' : 's'} · {formatCurrency(totalGuardado)} guardados
              </p>
              <Button variant="outline" size="sm" onClick={() => navigate('/goals')}>Ver metas</Button>
            </div>
          </CardContent>
        </Card>

        <div className="aurora-card-dark p-5">
          <div className="absolute inset-0 dot-grid-texture opacity-[0.15] pointer-events-none" aria-hidden="true" />
          <div className="relative flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Amigos</p>
              <p className="text-xs text-white/60 truncate">
                {friends.length} amigo{friends.length === 1 ? '' : 's'} conectado{friends.length === 1 ? '' : 's'}
              </p>
            </div>
            <Button
              size="sm"
              className="shrink-0 bg-[#AAFF47] text-[#0A0A0A] hover:bg-[#AAFF47]/85 font-bold"
              onClick={() => navigate('/social')}
            >
              Ver amigos
            </Button>
          </div>
        </div>
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
