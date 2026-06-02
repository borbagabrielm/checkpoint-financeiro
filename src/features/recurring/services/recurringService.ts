import { supabase } from '@/shared/lib/supabase'
import type { RecurringTransaction } from '@/shared/types'

export async function fetchRecurring(userId: string): Promise<RecurringTransaction[]> {
  const { data, error } = await supabase
    .from('recurring_transactions').select('*').eq('user_id', userId).order('created_at')
  if (error) return []
  return (data ?? []).map((r) => ({
    ...r,
    type: (r.type === 'credit' ? 'income' : 'expense') as RecurringTransaction['type'],
  }))
}

export async function createRecurring(
  userId: string,
  input: Omit<RecurringTransaction, 'id' | 'user_id' | 'created_at' | 'last_created_at'>
): Promise<void> {
  const { error } = await supabase.from('recurring_transactions').insert({
    user_id: userId,
    description: input.description,
    amount: input.type === 'expense' ? -Math.abs(input.amount) : Math.abs(input.amount),
    type: input.type === 'income' ? 'credit' : 'debit',
    category: input.category,
    payment_method: input.payment_method,
    day_of_month: input.day_of_month,
    active: input.active,
  })
  if (error) throw new Error(error.message)
}

export async function toggleRecurring(id: string, active: boolean): Promise<void> {
  const { error } = await supabase
    .from('recurring_transactions').update({ active }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteRecurring(id: string): Promise<void> {
  const { error } = await supabase.from('recurring_transactions').delete().eq('id', id)
  if (error) throw new Error(error.message)
}