import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/shared/hooks/useAuth'
import { queryKeys } from '@/shared/lib/queryKeys'
import { useTransactions } from '@/features/transactions/hooks/useTransactions'
import {
  computeMonthlyStats,
  computeCategoryBreakdown,
  computeSummary,
} from '../services/analyticsService'

export function useAnalytics(monthFilter = 'all') {
  const { user } = useAuth()

  // Reutiliza o cache de transactions — sem query duplicada
  const { transactions: allTransactions, isLoading } = useTransactions()

  // Ordena por data crescente para gráficos (transactions vem desc)
  const sorted = [...allTransactions].sort((a, b) =>
    a.date.localeCompare(b.date)
  )

  // Filtra por mês se necessário
  const transactions =
    monthFilter === 'all'
      ? sorted
      : sorted.filter((t) => t.date.startsWith(monthFilter))

  const monthlyStats = computeMonthlyStats(sorted)
  const expenseCategories = computeCategoryBreakdown(transactions, 'expense')
  const incomeCategories = computeCategoryBreakdown(transactions, 'income')
  const summary = computeSummary(transactions)

  return {
    isLoading,
    allTransactions: sorted,
    transactions,
    monthlyStats,
    expenseCategories,
    incomeCategories,
    summary,
  }
}