import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/shared/hooks/useAuth'
import { useTransactions } from '@/features/transactions/hooks/useTransactions'
import { getCurrentMonthKey } from '@/shared/lib/utils'
import { fetchBudgets, upsertBudget, deleteBudget } from '../services/budgetService'

const KEY = (uid: string) => ['budgets', uid] as const

export function useBudgets() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const { transactions } = useTransactions()

  const query = useQuery({
    queryKey: KEY(user?.id ?? ''),
    queryFn: () => fetchBudgets(user!.id),
    enabled: !!user?.id,
    staleTime: 60_000,
  })

  const currentMonth = getCurrentMonthKey()
  const monthExpenses = transactions.filter(
    (t) => t.type === 'expense' && t.date.startsWith(currentMonth)
  )

  const budgetsWithSpent = (query.data ?? []).map((b) => {
    const spent = monthExpenses
      .filter((t) => t.category === b.category)
      .reduce((s, t) => s + Math.abs(t.amount), 0)
    return { ...b, spent, percentage: Math.min(100, (spent / b.amount) * 100) }
  })

  const upsert = useMutation({
    mutationFn: ({ category, amount }: { category: string; amount: number }) =>
      upsertBudget(user!.id, category, amount),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY(user?.id ?? '') }); toast.success('Orçamento salvo') },
    onError: (e: Error) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteBudget(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY(user?.id ?? '') }); toast.success('Orçamento removido') },
    onError: (e: Error) => toast.error(e.message),
  })

  return { budgets: budgetsWithSpent, isLoading: query.isLoading, upsert, remove }
}