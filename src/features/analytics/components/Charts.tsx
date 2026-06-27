import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts'
import { cn, formatCurrency } from '@/shared/lib/utils'
import type { MonthlyStats, CategoryBreakdown } from '@/shared/types'

// ─── Cores da identidade Raxo ────────────────────────────────
const INCOME_COLOR  = '#22A800'   // verde legível
const EXPENSE_COLOR = '#FF4747'   // danger red
const PRIMARY_COLOR = '#3B3BFF'   // electric blue

// Paleta para categorias (pie chart)
const CATEGORY_COLORS = [
  '#3B3BFF', '#AAFF47', '#FF4747', '#22A800',
  '#7C3AED', '#F59E0B', '#06B6D4', '#EC4899',
  '#84CC16', '#F97316',
]

// ─── Area Chart — receitas e despesas ────────────────────────
export function MonthlyAreaChart({ data }: { data: MonthlyStats[] }) {
  if (!data?.length) return (
    <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
      Sem dados suficientes
    </div>
  )
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={INCOME_COLOR}  stopOpacity={0.15} />
            <stop offset="95%" stopColor={INCOME_COLOR}  stopOpacity={0} />
          </linearGradient>
          <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={EXPENSE_COLOR} stopOpacity={0.15} />
            <stop offset="95%" stopColor={EXPENSE_COLOR} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false}
          tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
        <Tooltip
          formatter={(v: number, n: string) => [formatCurrency(v), n]}
          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
        />
        <Area type="monotone" dataKey="income" name="Receitas"
          stroke={INCOME_COLOR} strokeWidth={2} fill="url(#incomeGrad)" />
        <Area type="monotone" dataKey="expense" name="Despesas"
          stroke={EXPENSE_COLOR} strokeWidth={2} fill="url(#expenseGrad)" />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ─── Pie Chart — categorias com legenda externa ──────────────
export function CategoryPieChart({ data }: { data: CategoryBreakdown[] }) {
  if (!data?.length) return (
    <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
      Sem dados
    </div>
  )
  const total = data.reduce((s, d) => s + d.amount, 0)
  // Mostra só top 6 para não poluir a legenda
  const top = data.slice(0, 6)
  return (
    <div className="flex items-center gap-4">
      <div className="shrink-0" style={{ width: 140, height: 140 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={top} dataKey="amount" nameKey="category" cx="50%" cy="50%"
              innerRadius={36} outerRadius={58} paddingAngle={2} startAngle={90} endAngle={-270}>
              {top.map((_, i) => (
                <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: number) => formatCurrency(v)}
              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {/* Legenda externa com cor + nome + valor + % */}
      <ul className="flex-1 space-y-1.5 min-w-0">
        {top.map((item, i) => (
          <li key={item.category} className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
            <span className="text-xs text-muted-foreground truncate flex-1">{item.category.replace(/^\p{Emoji}\s*/u, '')}</span>
            <span className="text-xs font-mono font-medium shrink-0">{((item.amount / total) * 100).toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Progress Bars — categorias ──────────────────────────────
export function CategoryProgressBars({
  items, selected, onSelect,
}: {
  items: CategoryBreakdown[]
  selected?: string | null
  onSelect?: (cat: string | null) => void
}) {
  if (!items?.length) return (
    <p className="text-sm text-muted-foreground py-4 text-center">Sem dados</p>
  )
  return (
    <ul className="space-y-3">
      {items.map((item, i) => (
        <li
          key={item.category}
          onClick={() => onSelect?.(selected === item.category ? null : item.category)}
          className={cn('space-y-1 rounded-lg px-2 py-1 -mx-2 transition-colors',
            onSelect && 'cursor-pointer hover:bg-secondary/50',
            selected === item.category && 'bg-secondary/70'
          )}
        >
          <div className="flex justify-between text-sm">
            <span className="font-medium truncate max-w-[60%]">{item.category}</span>
            <span className="text-muted-foreground font-mono text-xs">
              {formatCurrency(item.amount)} · {item.percentage.toFixed(0)}%
            </span>
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${item.percentage}%`,
                backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

// ─── Balance Evolution Chart ──────────────────────────────────
export function BalanceEvolutionChart({ data }: { data: MonthlyStats[] }) {
  if (!data?.length) return null
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={PRIMARY_COLOR} stopOpacity={0.2} />
            <stop offset="95%" stopColor={PRIMARY_COLOR} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false}
          tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
        <Tooltip
          formatter={(v: number) => [formatCurrency(v), 'Saldo acumulado']}
          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
        />
        <Area type="monotone" dataKey="cumulative" name="Saldo acumulado"
          stroke={PRIMARY_COLOR} strokeWidth={2} fill="url(#balanceGrad)" />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ─── Bar Chart mensal ─────────────────────────────────────────
export function MonthlyBarChart({ data }: { data: MonthlyStats[] }) {
  if (!data?.length) return null
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false}
          tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
        <Tooltip
          formatter={(v: number, n: string) => [formatCurrency(v), n]}
          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
        />
        <Bar dataKey="income" name="Receitas" fill={INCOME_COLOR} radius={[4, 4, 0, 0]} maxBarSize={32} />
        <Bar dataKey="expense" name="Despesas" fill={EXPENSE_COLOR} radius={[4, 4, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  )
}