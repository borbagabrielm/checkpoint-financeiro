import { supabase } from '@/shared/lib/supabase'
import type { Budget } from '@/shared/types'

export async function fetchBudgets(userId: string): Promise<Budget[]> {
  const { data, error } = await supabase
    .from('budgets').select('*').eq('user_id', userId)
  if (error) return []
  return data ?? []
}

export async function upsertBudget(userId: string, category: string, amount: number): Promise<void> {
  const { error } = await supabase.from('budgets').upsert(
    { user_id: userId, category, amount, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,category' }
  )
  if (error) throw new Error(error.message)
}

export async function deleteBudget(id: string): Promise<void> {
  const { error } = await supabase.from('budgets').delete().eq('id', id)
  if (error) throw new Error(error.message)
}