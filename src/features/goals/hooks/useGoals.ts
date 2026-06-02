import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/shared/hooks/useAuth'
import type { FinancialGoal } from '@/shared/types'
import { fetchGoals, createGoal, updateGoalProgress, deleteGoal } from '../services/goalsService'

const KEY = (uid: string) => ['goals', uid] as const

export function useGoals() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY(user?.id ?? '') })

  const query = useQuery({
    queryKey: KEY(user?.id ?? ''),
    queryFn: () => fetchGoals(user!.id),
    enabled: !!user?.id,
    staleTime: 60_000,
  })

  const create = useMutation({
    mutationFn: (input: Omit<FinancialGoal, 'id' | 'user_id' | 'created_at'>) =>
      createGoal(user!.id, input),
    onSuccess: () => { invalidate(); toast.success('Meta criada!') },
    onError: (e: Error) => toast.error(e.message),
  })

  const updateProgress = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      updateGoalProgress(id, amount),
    onSuccess: () => { invalidate(); toast.success('Progresso atualizado') },
    onError: (e: Error) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteGoal(id),
    onSuccess: () => { invalidate(); toast.success('Meta removida') },
    onError: (e: Error) => toast.error(e.message),
  })

  return {
    goals: query.data ?? [],
    isLoading: query.isLoading,
    create,
    updateProgress,
    remove,
  }
}