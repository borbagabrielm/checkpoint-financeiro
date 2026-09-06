import { supabase } from '@/shared/lib/supabase'
import { format, subMonths, addMonths, parseISO, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { MonthlyStats, CategoryBreakdown, Transaction } from '@/shared/types'

export async function fetchTransactionsForAnalytics(userId: string): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map((raw) => ({
    ...raw,
    type: raw.type === 'credit' ? 'income' : 'expense',
  })) as Transaction[]
}

export function computeMonthlyStats(
  transactions: Transaction[],
  monthsBack = 5,
  monthsForward = 3
): MonthlyStats[] {
  const now = new Date()
  const total = monthsBack + monthsForward + 1
  return Array.from({ length: total }, (_, i) => {
    const date = addMonths(subMonths(now, monthsBack), i)
    const monthKey = format(date, 'yyyy-MM')
    const label = format(date, 'MMM', { locale: ptBR })
    const start = startOfMonth(date)
    const end = endOfMonth(date)

    const monthTxs = transactions.filter((t) => {
      const d = parseISO(t.date)
      return d >= start && d <= end
    })

    const income = monthTxs
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + Math.abs(t.amount), 0)

    const expense = monthTxs
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + Math.abs(t.amount), 0)

    return { month: monthKey, label, income, expense, balance: income - expense }
  })
}

export function computeCategoryBreakdown(
  transactions: Transaction[],
  type: 'income' | 'expense' = 'expense'
): CategoryBreakdown[] {
  const filtered = transactions.filter((t) => t.type === type)
  const total = filtered.reduce((s, t) => s + Math.abs(t.amount), 0)

  const map = new Map<string, { amount: number; count: number }>()
  filtered.forEach((t) => {
    const existing = map.get(t.category) ?? { amount: 0, count: 0 }
    map.set(t.category, {
      amount: existing.amount + Math.abs(t.amount),
      count: existing.count + 1,
    })
  })

  return Array.from(map.entries())
    .map(([category, { amount, count }]) => ({
      category,
      amount,
      count,
      percentage: total > 0 ? (amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
}

export function computeSummary(transactions: Transaction[]) {
  const income = transactions
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + Math.abs(t.amount), 0)
  const expense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + Math.abs(t.amount), 0)
  return { income, expense, balance: income - expense }
}
