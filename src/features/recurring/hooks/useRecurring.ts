import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/shared/hooks/useAuth'
import { queryKeys } from '@/shared/lib/queryKeys'
import type { RecurringTransaction } from '@/shared/types'
import {
  fetchRecurring,
  fetchSharedRecurring,
  createRecurring,
  activateRecurring,
  deactivateRecurring,
  deleteRecurring,
  type RecurringShareInput,
} from '../services/recurringService'

export function useRecurring() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: queryKeys.recurring.mine(user?.id ?? ''),
    queryFn: () => fetchRecurring(user!.id),
    enabled: !!user?.id,
    staleTime: 60_000,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.recurring.mine(user?.id ?? '') })
    qc.invalidateQueries({ queryKey: queryKeys.transactions.all(user?.id ?? '') })
  }

  const create = useMutation({
    mutationFn: ({ input, shares }: {
      input: Omit<RecurringTransaction, 'id' | 'user_id' | 'created_at' | 'last_created_at' | 'generated_until'>
      shares?: RecurringShareInput[]
    }) => createRecurring(user!.id, input, shares),
    onSuccess: () => { invalidate(); toast.success('Transação recorrente criada') },
    onError: (e: Error) => toast.error(e.message),
  })

  const activate = useMutation({
    mutationFn: (id: string) => activateRecurring(id),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  })

  const deactivate = useMutation({
    mutationFn: (id: string) => deactivateRecurring(id),
    onSuccess: () => { invalidate(); toast.success('Recorrência desativada') },
    onError: (e: Error) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteRecurring(id),
    onSuccess: () => { invalidate(); toast.success('Recorrente removida') },
    onError: (e: Error) => toast.error(e.message),
  })

  return { recurring: query.data ?? [], isLoading: query.isLoading, create, activate, deactivate, remove }
}

// Recorrências de amigos que compartilharam com o usuário atual — somente leitura
export function useSharedRecurring() {
  const { user } = useAuth()

  const query = useQuery({
    queryKey: queryKeys.recurring.shared(user?.id ?? ''),
    queryFn: () => fetchSharedRecurring(user!.id),
    enabled: !!user?.id,
    staleTime: 60_000,
  })

  return { sharedRecurring: query.data ?? [], isLoading: query.isLoading }
}
