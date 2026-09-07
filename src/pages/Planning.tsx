import { useState, useRef, useEffect, useMemo } from 'react'
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@/shared/components/ui/display'
import { formatCurrency, getCurrentMonthKey, getYearMonthOptions, cn } from '@/shared/lib/utils'
import { useAnalytics } from '@/features/analytics/hooks/useAnalytics'
import { DailyBalanceChart } from '@/features/analytics/components/Charts'
import { computeDailyBalances } from '@/features/planning/services/planningService'

// ─── Stat card com barra de acento no topo (mesmo padrão do Dashboard) ─
function StatCard({ label, value, icon: Icon, accentColor, valueColor, iconBg, loading }: {
  label: string
  value: number
  icon: React.ElementType
  accentColor: string
  valueColor: string
  iconBg: string
  loading?: boolean
}) {
  return (
    <div className="stat-card animate-fade-in">
      <div className={cn('stat-card-accent-top', accentColor)} />
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <div className={cn('p-2 rounded-lg', iconBg)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      {loading ? <Skeleton className="h-8 w-32" /> : (
        <p className={cn('text-2xl font-display font-bold tracking-tight', valueColor)}>
          {formatCurrency(value)}
        </p>
      )}
    </div>
  )
}

export default function PlanningPage() {
  const [monthFilter, setMonthFilter] = useState(getCurrentMonthKey())
  const { summary, transactions, isLoading } = useAnalytics(monthFilter)
  const monthOptions = getYearMonthOptions()
  const monthScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = monthScrollRef.current?.querySelector<HTMLElement>(`[data-month="${monthFilter}"]`)
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [monthFilter])

  const dailyBalances = useMemo(
    () => computeDailyBalances(transactions, monthFilter),
    [transactions, monthFilter]
  )

  const todayKey = getCurrentMonthKey() === monthFilter ? new Date().getDate() : null

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Planejamento</h1>
        <p className="page-subtitle">Acompanhe dia a dia como o mês está se desenrolando</p>
      </div>

      {/* Filtros de mês */}
      <div ref={monthScrollRef} className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {monthOptions.map((opt) => (
          <button key={opt.value} data-month={opt.value} onClick={() => setMonthFilter(opt.value)}
            className={cn('shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize',
              monthFilter === opt.value ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground')}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
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
      </div>

      {/* Gráfico + Tabela */}
      <div className="grid lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-3">
          <CardHeader><CardTitle>Saldo diário</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[220px] w-full" /> : <DailyBalanceChart data={dailyBalances} />}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Dia a dia</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[420px] overflow-y-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="text-xs text-muted-foreground border-b border-border">
                    <th className="text-left font-medium px-4 py-2">Dia</th>
                    <th className="text-right font-medium px-4 py-2">Despesas</th>
                    <th className="text-right font-medium px-4 py-2">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i}><td colSpan={3} className="px-4 py-2"><Skeleton className="h-4 w-full" /></td></tr>
                    ))
                  ) : dailyBalances.map((d) => (
                    <tr key={d.day}
                      className={cn('border-b border-border/50 last:border-0',
                        d.day === todayKey && 'bg-primary/5')}>
                      <td className="px-4 py-1.5 font-medium">
                        {d.day}
                        {d.day === todayKey && <span className="ml-1.5 text-[10px] text-primary font-normal">hoje</span>}
                      </td>
                      <td className="px-4 py-1.5 text-right font-mono text-xs text-muted-foreground">
                        {d.expense > 0 ? formatCurrency(d.expense) : '—'}
                      </td>
                      <td className={cn('px-4 py-1.5 text-right font-mono text-xs font-medium',
                        d.balance < 0 ? 'text-[hsl(var(--expense))]' : 'text-foreground')}>
                        {d.balance < 0 ? '−' : ''}{formatCurrency(d.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
