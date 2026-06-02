import { cn } from '@/shared/lib/utils'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import { formatCurrency } from '@/shared/lib/utils'
import type { MonthlyStats, CategoryBreakdown } from '@/shared/types'

const COLORS = [
  'hsl(220, 80%, 60%)',
  'hsl(152, 55%, 48%)',
  'hsl(262, 75%, 65%)',
  'hsl(35, 85%, 55%)',
  'hsl(0, 65%, 55%)',
  'hsl(190, 70%, 50%)',
  'hsl(320, 60%, 60%)',
]

interface MonthlyChartProps {
  data: MonthlyStats[]
}

export function MonthlyAreaChart({ data }: MonthlyChartProps) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
        <defs>
          <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(152, 55%, 48%)" stopOpacity={0.25} />
            <stop offset="95%" stopColor="hsl(152, 55%, 48%)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(0, 65%, 55%)" stopOpacity={0.25} />
            <stop offset="95%" stopColor="hsl(0, 65%, 55%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            fontSize: '12px',
          }}
          formatter={(value: number) => [formatCurrency(value), '']}
        />
        <Area
          type="monotone"
          dataKey="income"
          name="Receitas"
          stroke="hsl(152, 55%, 48%)"
          strokeWidth={2}
          fill="url(#incomeGrad)"
        />
        <Area
          type="monotone"
          dataKey="expense"
          name="Despesas"
          stroke="hsl(0, 65%, 55%)"
          strokeWidth={2}
          fill="url(#expenseGrad)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

interface CategoryChartProps {
  data: CategoryBreakdown[]
}

export function CategoryPieChart({ data }: CategoryChartProps) {
  const top = data.slice(0, 7)
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={top}
          dataKey="amount"
          nameKey="category"
          cx="50%"
          cy="50%"
          outerRadius={80}
          innerRadius={40}
        >
          {top.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            fontSize: '12px',
          }}
          formatter={(value: number) => [formatCurrency(value), '']}
        />
        <Legend
          formatter={(value) => (
            <span style={{ fontSize: '11px', color: 'hsl(var(--muted-foreground))' }}>
              {value}
            </span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

interface ProgressBarProps {
  items: CategoryBreakdown[]
  onSelect?: (category: string) => void
  selected?: string | null
}

export function CategoryProgressBars({ items, onSelect, selected }: ProgressBarProps) {
  const top = items.slice(0, 6)
  return (
    <ul className="space-y-3">
      {top.map((item, i) => (
        <li
          key={item.category}
          className={cn('space-y-1 rounded-lg px-2 py-1 -mx-2 transition-colors', onSelect && 'cursor-pointer hover:bg-secondary/50', selected === item.category && 'bg-secondary/70')}
          onClick={() => onSelect?.(item.category)}
        >
          <div className="flex justify-between text-sm">
            <span className="text-foreground truncate max-w-[60%]">{item.category}</span>
            <span className="font-mono text-muted-foreground text-xs">
              {formatCurrency(item.amount)} · {item.percentage.toFixed(0)}%
            </span>
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${item.percentage}%`, backgroundColor: COLORS[i % COLORS.length] }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

// ─── Balance evolution chart ──────────────────────────────────
interface BalanceChartProps {
  data: MonthlyStats[]
}

export function BalanceEvolutionChart({ data }: BalanceChartProps) {
  // Calcula saldo acumulado
  let cumulative = 0
  const cumulativeData = data.map((d) => {
    cumulative += d.balance
    return { ...d, cumulative }
  })

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={cumulativeData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
        <defs>
          <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(220, 80%, 60%)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(220, 80%, 60%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
        <Tooltip
          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
          formatter={(value: number) => [formatCurrency(value), 'Saldo acumulado']}
        />
        <Area type="monotone" dataKey="cumulative" name="Saldo acumulado" stroke="hsl(220, 80%, 60%)" strokeWidth={2} fill="url(#balanceGrad)" />
      </AreaChart>
    </ResponsiveContainer>
  )
}