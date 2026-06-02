import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/shared/hooks/useAuth'
import type { RecurringTransaction } from '@/shared/types'
import { fetchRecurring, createRecurring, toggleRecurring, deleteRecurring } from '../services/recurringService'

const KEY = (uid: string) => ['recurring', uid] as const

export function useRecurring() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: KEY(user?.id ?? ''),
    queryFn: () => fetchRecurring(user!.id),
    enabled: !!user?.id,
    staleTime: 60_000,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: KEY(user?.id ?? '') })

  const create = useMutation({
    mutationFn: (input: Omit<RecurringTransaction, 'id' | 'user_id' | 'created_at' | 'last_created_at'>) =>
      createRecurring(user!.id, input),
    onSuccess: () => { invalidate(); toast.success('Transação recorrente criada') },
    onError: (e: Error) => toast.error(e.message),
  })

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => toggleRecurring(id, active),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteRecurring(id),
    onSuccess: () => { invalidate(); toast.success('Recorrente removida') },
    onError: (e: Error) => toast.error(e.message),
  })

  return { recurring: query.data ?? [], isLoading: query.isLoading, create, toggle, remove }
}