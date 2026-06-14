import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/shared/hooks/useAuth'
import { supabase } from '@/shared/lib/supabase'
import { queryKeys } from '@/shared/lib/queryKeys'
import { format } from 'date-fns'

export function useRecurringRunner() {
  const { user } = useAuth()
  const qc = useQueryClient()

  useEffect(() => {
    if (!user?.id) return

    const key = `recurring_ran_${user.id}_${format(new Date(), 'yyyy-MM-dd')}`
    if (localStorage.getItem(key)) return

    runRecurring(user.id).then(({ created, errors }) => {
      if (created > 0) {
        toast.success(
          `${created} transaç${created === 1 ? 'ão recorrente criada' : 'ões recorrentes criadas'} automaticamente`,
          { duration: 5000 }
        )
        qc.invalidateQueries({ queryKey: queryKeys.transactions.all(user.id) })
        qc.invalidateQueries({ queryKey: queryKeys.analytics.monthly(user.id) })
      }
      if (errors > 0) {
        toast.warning(`${errors} transação(ões) recorrente(s) não puderam ser criadas`)
      }
      localStorage.setItem(key, '1')
    })
  }, [user?.id])
}

async function runRecurring(userId: string): Promise<{ created: number; errors: number }> {
  const today = new Date()
  const todayDay = today.getDate()
  const todayStr = format(today, 'yyyy-MM-dd')
  const currentMonth = format(today, 'yyyy-MM')

  const { data: recurring, error } = await supabase
    .from('recurring_transactions')
    .select('id, description, amount, type, category, payment_method, day_of_month, last_created_at, active')
    .eq('user_id', userId)
    .eq('active', true)

  if (error) {
    console.error('[useRecurringRunner] Erro ao buscar recorrentes:', error.message)
    return { created: 0, errors: 0 }
  }

  if (!recurring?.length) return { created: 0, errors: 0 }

  let created = 0
  let errors = 0

  for (const r of recurring) {
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    const targetDay = Math.min(r.day_of_month, daysInMonth)

    if (todayDay !== targetDay) continue

    const lastCreated = r.last_created_at as string | null
    if (lastCreated && lastCreated.startsWith(currentMonth)) continue

    try {
      const { error: insertError } = await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          description: r.description,
          amount: r.type === 'expense' ? -Math.abs(r.amount) : Math.abs(r.amount),
          type: r.type === 'income' ? 'credit' : 'debit',
          category: r.category,
          payment_method: r.payment_method,
          date: todayStr,
        })

      if (insertError) throw new Error(insertError.message)

      await supabase
        .from('recurring_transactions')
        .update({ last_created_at: todayStr })
        .eq('id', r.id)

      created++
    } catch (e) {
      console.error('[useRecurringRunner] Erro ao criar transação:', e)
      errors++
    }
  }

  return { created, errors }
}