import { supabase } from '@/shared/lib/supabase'
import type { FinancialGoal } from '@/shared/types'

export async function fetchGoals(userId: string): Promise<FinancialGoal[]> {
  const { data, error } = await supabase
    .from('financial_goals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) return []
  return data ?? []
}

export async function createGoal(
  userId: string,
  input: Omit<FinancialGoal, 'id' | 'user_id' | 'created_at'>
): Promise<void> {
  const { error } = await supabase.from('financial_goals').insert({
    user_id: userId,
    title: input.title,
    target_amount: input.target_amount,
    current_amount: input.current_amount,
    deadline: input.deadline || null,
    category: input.category || null,
  })
  if (error) throw new Error(error.message)
}

export async function updateGoalProgress(
  id: string,
  current_amount: number
): Promise<void> {
  const { error } = await supabase
    .from('financial_goals')
    .update({ current_amount, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteGoal(id: string): Promise<void> {
  const { error } = await supabase.from('financial_goals').delete().eq('id', id)
  if (error) throw new Error(error.message)
}