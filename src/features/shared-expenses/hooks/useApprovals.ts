import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/shared/hooks/useAuth'
import { queryKeys } from '@/shared/lib/queryKeys'
import {
  fetchPendingApprovals,
  fetchApprovalHistory,
  approveSharedTransaction,
  rejectSharedTransaction,
  fetchUnreadNotificationCount,
} from '../services/sharedExpensesService'

export function useApprovals() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const pending = useQuery({
    queryKey: queryKeys.sharedExpenses.approvalsPending(user?.id ?? ''),
    queryFn: async () => {
      try {
        const result = await fetchPendingApprovals(user!.id)
        return result ?? []
      } catch (e) {
        console.error('[useApprovals pending]', e)
        return []
      }
    },
    enabled: !!user?.id,
    staleTime: 0,
    refetchInterval: 60_000,
    retry: false,
  })

  const history = useQuery({
    queryKey: queryKeys.sharedExpenses.approvalsHistory(user?.id ?? ''),
    queryFn: async () => {
      try {
        const result = await fetchApprovalHistory(user!.id)
        return result ?? []
      } catch (e) {
        console.error('[useApprovals history]', e)
        return []
      }
    },
    enabled: !!user?.id,
    staleTime: 0,
    retry: false,
  })

  const unreadCount = useQuery({
    queryKey: queryKeys.notifications.unreadCount(user?.id ?? ''),
    queryFn: () => fetchUnreadNotificationCount(user!.id),
    enabled: !!user?.id,
    refetchInterval: 30_000,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.sharedExpenses.pending(user?.id ?? '') })
    qc.invalidateQueries({ queryKey: queryKeys.sharedExpenses.history(user?.id ?? '') })
    qc.invalidateQueries({ queryKey: queryKeys.sharedExpenses.approvalsPending(user?.id ?? '') })
    qc.invalidateQueries({ queryKey: queryKeys.sharedExpenses.approvalsHistory(user?.id ?? '') })
    qc.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount(user?.id ?? '') })
    qc.invalidateQueries({ queryKey: queryKeys.transactions.all(user?.id ?? '') })
  }

  const approve = useMutation({
    mutationFn: (id: string) => approveSharedTransaction(id, user!.id),
    onSuccess: () => { invalidate(); toast.success('Despesa aprovada e adicionada à sua conta') },
    onError: (e: Error) => toast.error(e.message),
  })

  const reject = useMutation({
    mutationFn: (id: string) => rejectSharedTransaction(id),
    onSuccess: () => { invalidate(); toast.info('Despesa recusada') },
    onError: (e: Error) => toast.error(e.message),
  })

  return {
    pending: pending.data ?? [],
    history: history.data ?? [],
    isLoading: pending.isLoading,
    isError: pending.isError,
    unreadCount: unreadCount.data ?? 0,
    approve,
    reject,
  }
}