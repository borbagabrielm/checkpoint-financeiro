import { useState, useMemo, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/display'
import { Skeleton } from '@/shared/components/ui/display'
import { formatCurrency, getCurrentMonthKey, getMonthOptions } from '@/shared/lib/utils'
import { useAnalytics } from '@/features/analytics/hooks/useAnalytics'
import {
  MonthlyAreaChart, CategoryPieChart, CategoryProgressBars, BalanceEvolutionChart,
} from '@/features/analytics/components/Charts'
import {
  computeCategoryBreakdown, computeSummary, computeMonthlyStats,
} from '@/features/analytics/services/analyticsService'
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import type { Transaction } from '@/shared/types'
import type { MonthlyStats } from '@/shared/types'

export default function AnalyticsPage() {
  const [monthFilter, setMonthFilter] = useState(getCurrentMonthKey())
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const monthOptions = getMonthOptions()
  const monthScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = monthScrollRef.current?.querySelector<HTMLElement>(`[data-month="${monthFilter}"]`)
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [monthFilter])

  const { transactions, allTransactions, expenseCategories, isLoading } =
    useAnalytics(monthFilter)

  // Transações filtradas por categoria (quando ativo)
  const filteredTransactions: Transaction[] = useMemo(() => {
    if (!categoryFilter) return transactions
    return transactions.filter((t) => t.category === categoryFilter)
  }, [transactions, categoryFilter])

  // Todos os derivados recalculados com base no filtro de categoria
  const summary = useMemo(() => computeSummary(filteredTransactions), [filteredTransactions])

  const monthlyStats = useMemo(() => {
    // Para gráfico mensal: filtra allTransactions por categoria se necessário
    const base = categoryFilter
      ? allTransactions.filter((t) => t.category === categoryFilter)
      : allTransactions
    return computeMonthlyStats(base)
  }, [allTransactions, categoryFilter])

  const filteredExpenseCategories = useMemo(
    () => computeCategoryBreakdown(filteredTransactions, 'expense'),
    [filteredTransactions]
  )

  const filteredIncomeCategories = useMemo(
    () => computeCategoryBreakdown(filteredTransactions, 'income'),
    [filteredTransactions]
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Análises</h1>
        <p className="page-subtitle">Entenda seus padrões de gastos</p>
      </div>

      {/* Filtro de mês */}
      <div ref={monthScrollRef} className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        <button
          data-month="all"
          onClick={() => { setMonthFilter('all'); setCategoryFilter(null) }}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${monthFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
        >
          Tudo
        </button>
        {monthOptions.map((m) => (
          <button key={m.value} data-month={m.value} onClick={() => { setMonthFilter(m.value); setCategoryFilter(null) }}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${monthFilter === m.value ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Filtro de categoria */}
      {expenseCategories.length > 0 && (
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-xs text-muted-foreground">Filtrar por:</span>
          {categoryFilter ? (
            <button
              onClick={() => setCategoryFilter(null)}
              className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center gap-1"
            >
              {categoryFilter} ✕
            </button>
          ) : (
            expenseCategories.slice(0, 6).map((c) => (
              <button key={c.category} onClick={() => setCategoryFilter(c.category)}
                className="px-3 py-1 rounded-full bg-secondary hover:bg-secondary/80 text-xs font-medium transition-colors"
              >
                {c.category}
              </button>
            ))
          )}
        </div>
      )}

      {/* Cards de resumo — sempre baseados no filtro ativo */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: categoryFilter ? 'Gasto na categoria' : 'Receitas', value: categoryFilter ? summary.expense : summary.income, icon: TrendingUp, cls: 'text-[hsl(var(--income))]' },
          { label: 'Despesas', value: summary.expense, icon: TrendingDown, cls: 'text-[hsl(var(--expense))]' },
          { label: 'Saldo', value: summary.balance, icon: Wallet, cls: summary.balance >= 0 ? 'text-[hsl(var(--income))]' : 'text-[hsl(var(--expense))]' },
        ].map(({ label, value, icon: Icon, cls }) => (
          <div key={label} className="stat-card">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Icon className="h-4 w-4" />
              <span className="text-sm">{label}</span>
            </div>
            {isLoading ? (
              <Skeleton className="h-6 w-24 mt-1" />
            ) : (
              <p className={`text-xl font-display font-semibold ${cls}`}>
                {formatCurrency(value)}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Gráficos — todos refletem o filtro de categoria */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>
              {categoryFilter ? `Evolução — ${categoryFilter}` : 'Receitas vs Despesas'}
            </CardTitle>
          </CardHeader>
          <CardContent><MonthlyAreaChart data={monthlyStats} /></CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {categoryFilter ? `Saldo — ${categoryFilter}` : 'Evolução do saldo'}
            </CardTitle>
          </CardHeader>
          <CardContent><BalanceEvolutionChart data={monthlyStats} /></CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {categoryFilter ? `Despesas — ${categoryFilter}` : 'Despesas por categoria'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredExpenseCategories.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                Sem despesas {categoryFilter ? `em ${categoryFilter}` : 'neste período'}
              </div>
            ) : (
              <CategoryPieChart data={filteredExpenseCategories} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {categoryFilter ? `Detalhes — ${categoryFilter}` : 'Top categorias de despesa'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredExpenseCategories.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">Sem dados</div>
            ) : (
              <CategoryProgressBars
                items={categoryFilter ? filteredExpenseCategories : expenseCategories}
                onSelect={setCategoryFilter}
                selected={categoryFilter}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {categoryFilter ? `Receitas — ${categoryFilter}` : 'Fontes de receita'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredIncomeCategories.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                Sem receitas {categoryFilter ? `em ${categoryFilter}` : 'neste período'}
              </div>
            ) : (
              <CategoryProgressBars items={filteredIncomeCategories} />
            )}
          </CardContent>
        </Card>

        {/* Exportação CSV — exporta apenas o que está filtrado */}
        <Card>
          <CardHeader><CardTitle>Exportar dados</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {categoryFilter
                ? `Exportando despesas de "${categoryFilter}" no período selecionado.`
                : 'Exporte suas transações do período selecionado em formato CSV.'}
            </p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => exportCSV(filteredTransactions, monthFilter, categoryFilter)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-sm font-medium transition-colors"
              >
                📊 Baixar CSV ({filteredTransactions.length} transações)
              </button>
              <button
                onClick={() => exportPDF(filteredTransactions, summary, monthFilter, categoryFilter)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-sm font-medium transition-colors"
              >
                📄 Baixar PDF
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function exportCSV(transactions: Transaction[], monthFilter: string, categoryFilter: string | null) {
  const header = ['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor', 'Pagamento']
  const rows = transactions.map((t) => [
    t.date,
    `"${t.description.replace(/"/g, '""')}"`,
    `"${t.category}"`,
    t.type === 'income' ? 'Receita' : 'Despesa',
    Math.abs(t.amount).toFixed(2).replace('.', ','),
    t.payment_method ?? '',
  ])
  const csv = [header, ...rows].map((r) => r.join(';')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `checkpoint-${categoryFilter ? categoryFilter.replace(/[^\w]/g, '-') : monthFilter}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function exportPDF(
  transactions: Transaction[],
  summary: { income: number; expense: number; balance: number },
  monthFilter: string,
  categoryFilter: string | null
) {
  const title = categoryFilter
    ? `Relatório — ${categoryFilter}`
    : `Relatório Financeiro — ${monthFilter === 'all' ? 'Todos os períodos' : monthFilter}`

  const rows = transactions.map((t) => `
    <tr style="border-bottom:1px solid #eee">
      <td style="padding:6px 8px;font-size:12px">${t.date}</td>
      <td style="padding:6px 8px;font-size:12px">${t.description}</td>
      <td style="padding:6px 8px;font-size:12px">${t.category}</td>
      <td style="padding:6px 8px;font-size:12px;text-align:right;color:${t.type === 'income' ? '#16a34a' : '#dc2626'}">
        ${t.type === 'income' ? '+' : '-'} R$ ${Math.abs(t.amount).toFixed(2).replace('.', ',')}
      </td>
    </tr>
  `).join('')

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, sans-serif; padding: 32px; color: #111; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    .subtitle { color: #666; font-size: 13px; margin-bottom: 24px; }
    .summary { display: flex; gap: 24px; margin-bottom: 24px; }
    .card { background: #f9f9f9; border-radius: 8px; padding: 12px 16px; min-width: 140px; }
    .card-label { font-size: 11px; color: #888; margin-bottom: 4px; }
    .card-value { font-size: 18px; font-weight: 700; }
    .income { color: #16a34a; }
    .expense { color: #dc2626; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f4f4f5; padding: 8px; text-align: left; font-size: 12px; color: #555; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p class="subtitle">Gerado em ${new Date().toLocaleDateString('pt-BR')} por Raxo</p>
  <div class="summary">
    <div class="card">
      <div class="card-label">Receitas</div>
      <div class="card-value income">R$ ${summary.income.toFixed(2).replace('.', ',')}</div>
    </div>
    <div class="card">
      <div class="card-label">Despesas</div>
      <div class="card-value expense">R$ ${summary.expense.toFixed(2).replace('.', ',')}</div>
    </div>
    <div class="card">
      <div class="card-label">Saldo</div>
      <div class="card-value ${summary.balance >= 0 ? 'income' : 'expense'}">
        R$ ${summary.balance.toFixed(2).replace('.', ',')}
      </div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Data</th><th>Descrição</th><th>Categoria</th><th style="text-align:right">Valor</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p style="font-size:11px;color:#aaa;margin-top:24px;text-align:center">
    ${transactions.length} transações · Raxo
  </p>
</body>
</html>`

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank')
  if (win) {
    win.onload = () => { win.print(); URL.revokeObjectURL(url) }
  }
}