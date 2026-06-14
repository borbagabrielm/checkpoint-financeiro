import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './useAuth'
import { queryKeys } from '@/shared/lib/queryKeys'
import { supabase } from '@/shared/lib/supabase'
import { fetchFriendships } from '@/features/social/services/socialService'
import { useBudgets } from '@/features/budgets/hooks/useBudgets'
import { approveSharedTransaction } from '@/features/shared-expenses/services/sharedExpensesService'

export type NotificationItem =
  | { kind: 'friend_request'; friendshipId: string; fromName: string; fromAvatar: string | null; fromUserId: string; at: string }
  | { kind: 'shared_expense'; sharedTxId: string; fromName: string; fromAvatar: string | null; description: string; amount: number; at: string }
  | { kind: 'budget_alert'; category: string; percentage: number; spent: number; limit: number; at: string }

export function useNotifications() {
  const { user } = useAuth()
  const qc = useQueryClient()

  // ── Alertas de orçamento ──────────────────────────────────
  const { budgets } = useBudgets()

  const budgetNotifs: NotificationItem[] = budgets
    .filter((b) => (b.percentage ?? 0) >= 90)
    .map((b) => ({
      kind: 'budget_alert' as const,
      category: b.category,
      percentage: Math.round(b.percentage ?? 0),
      spent: b.spent ?? 0,
      limit: b.amount,
      at: new Date().toISOString(),
    }))

  // ── Solicitações de amizade pendentes ────────────────────
  const friendsQuery = useQuery({
    queryKey: queryKeys.friendships.pending(user?.id ?? ''),
    queryFn: () => fetchFriendships(user!.id),
    enabled: !!user?.id,
    staleTime: 30_000,
    refetchInterval: 30_000,
    select: (data) => data.filter((f) => f.status === 'pending' && f.addressee_id === user?.id),
  })

  // ── Despesas compartilhadas pendentes ────────────────────
  // Busca em duas etapas simples: shared_transactions → profiles
  const expensesQuery = useQuery({
    queryKey: queryKeys.sharedExpenses.pending(user?.id ?? ''),
    queryFn: async () => {
      // 1. Busca shared_transactions + a transação original
      const { data: rows, error } = await supabase
        .from('shared_transactions')
        .select('id, split_amount, created_at, transaction:transactions(description, user_id)')
        .eq('shared_with_user_id', user!.id)
        .eq('status', 'pending_approval')
        .order('created_at', { ascending: false })

      if (error) throw new Error(error.message)
      if (!rows?.length) return []

      // 2. Busca perfis dos remetentes em uma única query
      const senderIds = [...new Set(rows.map((r) => {
        const tx = (r.transaction as unknown) as { user_id: string } | null
        return tx?.user_id
      }).filter(Boolean))] as string[]

      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('user_id, display_name, username, avatar_url')
        .in('user_id', senderIds)

      const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]))

      return rows.map((r) => {
        const tx = (r.transaction as unknown) as { description: string; user_id: string } | null
        const profile = profileMap.get(tx?.user_id ?? '')
        return {
          id: r.id,
          split_amount: r.split_amount,
          created_at: r.created_at,
          description: tx?.description ?? '',
          sender_name: profile?.display_name ?? profile?.username ?? 'Alguém',
          sender_avatar: profile?.avatar_url ?? null,
        }
      })
    },
    enabled: !!user?.id,
    staleTime: 20_000,
    refetchInterval: 30_000,
  })

  // ── Montar lista unificada ────────────────────────────────
  const friendNotifs: NotificationItem[] = (friendsQuery.data ?? []).map((f) => ({
    kind: 'friend_request',
    friendshipId: f.id,
    fromName: f.requester_profile?.display_name ?? f.requester_profile?.username ?? 'Alguém',
    fromAvatar: f.requester_profile?.avatar_url ?? null,
    fromUserId: f.requester_id,
    at: f.created_at,
  }))

  const expenseNotifs: NotificationItem[] = (expensesQuery.data ?? []).map((a) => ({
    kind: 'shared_expense',
    sharedTxId: a.id,
    fromName: a.sender_name,
    fromAvatar: a.sender_avatar,
    description: a.description,
    amount: a.split_amount,
    at: a.created_at,
  }))

  const all = [...friendNotifs, ...expenseNotifs, ...budgetNotifs].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
  )

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.friendships.pending(user?.id ?? '') })
    qc.invalidateQueries({ queryKey: queryKeys.friendships.all(user?.id ?? '') })
    qc.invalidateQueries({ queryKey: queryKeys.sharedExpenses.pending(user?.id ?? '') })
    qc.invalidateQueries({ queryKey: queryKeys.sharedExpenses.history(user?.id ?? '') })
  }

  const acceptFriend = useMutation({
    mutationFn: async (friendshipId: string) => {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', friendshipId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => invalidate(),
  })

  const rejectFriend = useMutation({
    mutationFn: async (friendshipId: string) => {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', friendshipId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => invalidate(),
  })

  const approveExpense = useMutation({
    mutationFn: (sharedTxId: string) => approveSharedTransaction(sharedTxId, user!.id),
    onSuccess: () => {
      invalidate()
      qc.invalidateQueries({ queryKey: queryKeys.transactions.all(user?.id ?? '') })
    },
  })

  const rejectExpense = useMutation({
    mutationFn: async (sharedTxId: string) => {
      const { error } = await supabase
        .from('shared_transactions')
        .update({ status: 'rejected' })
        .eq('id', sharedTxId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => invalidate(),
  })

  return {
    all,
    count: all.length,
    isLoading: friendsQuery.isLoading || expensesQuery.isLoading,
    acceptFriend,
    rejectFriend,
    approveExpense,
    rejectExpense,
  }
}