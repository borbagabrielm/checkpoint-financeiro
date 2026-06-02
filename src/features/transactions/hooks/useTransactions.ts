import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/shared/hooks/useAuth'
import { queryKeys } from '@/shared/lib/queryKeys'
import type { TransactionInput } from '@/shared/types'
import {
  fetchTransactions,
  createTransaction,
  createInstallmentTransactions,
  updateTransaction,
  deleteTransaction,
  createSharedExpense,
} from '../services/transactionService'

export function useTransactions() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: queryKeys.transactions.all(user?.id ?? ''),
    queryFn: () => fetchTransactions(user!.id),
    enabled: !!user?.id,
    staleTime: 30_000,
  })

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: queryKeys.transactions.all(user?.id ?? '') })

  // ─── Add ──────────────────────────────────────────────────
  const add = useMutation({
    mutationFn: async (input: TransactionInput) => {
      const installments = input.installments ?? 1
      let transactions

      if (installments > 1) {
        // Cria as parcelas passando shared_with para que cada parcela
        // seja dividida com os amigos proporcionalmente
        transactions = await createInstallmentTransactions(input, user!.id, installments)
        // Cria shared_transaction para cada parcela gerada
        if (input.shared_with?.length) {
          const perInstallment = input.shared_with.map((s) => ({
            ...s,
            amount: Math.round((s.amount / installments) * 100) / 100,
          }))
          await Promise.all(
            transactions.map((tx) => createSharedExpense(tx.id, perInstallment))
          )
        }
      } else {
        const tx = await createTransaction(input, user!.id)
        transactions = [tx]
        if (input.shared_with?.length) {
          await createSharedExpense(tx.id, input.shared_with)
        }
      }
      return transactions
    },
    onSuccess: (transactions) => {
      invalidate()
      qc.invalidateQueries({ queryKey: queryKeys.analytics.monthly(user?.id ?? '') })
      const label = transactions.length > 1
        ? `${transactions.length} parcelas adicionadas`
        : 'Transação adicionada'
      toast.success(label)
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  // ─── Update ───────────────────────────────────────────────
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<TransactionInput> }) =>
      updateTransaction(id, input, user!.id),
    onSuccess: () => {
      invalidate()
      qc.invalidateQueries({ queryKey: queryKeys.analytics.monthly(user?.id ?? '') })
      toast.success('Transação atualizada')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // ─── Delete ───────────────────────────────────────────────
  const remove = useMutation({
    mutationFn: (id: string) => deleteTransaction(id, user!.id),
    onMutate: async (id) => {
      // Optimistic update
      await qc.cancelQueries({ queryKey: queryKeys.transactions.all(user?.id ?? '') })
      const prev = qc.getQueryData(queryKeys.transactions.all(user?.id ?? ''))
      qc.setQueryData(
        queryKeys.transactions.all(user?.id ?? ''),
        (old: ReturnType<typeof fetchTransactions> extends Promise<infer T> ? T : never) =>
          (old ?? []).filter((t) => t.id !== id)
      )
      return { prev }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.analytics.monthly(user?.id ?? '') })
      toast.success('Transação excluída')
    },
    onError: (err: Error, _, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(queryKeys.transactions.all(user?.id ?? ''), ctx.prev)
      }
      toast.error(err.message)
    },
  })

  return {
    transactions: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    add,
    update,
    remove,
  }
}