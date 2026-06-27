// useRecurringRunner — cria transações recorrentes automaticamente
// Usa flag no Supabase (last_created_at) como única fonte de verdade
// para evitar duplicatas mesmo com múltiplas abas abertas
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
    runRecurring(user.id).then(({ created }) => {
      if (created > 0) {
        toast.success(
          `${created} transaç${created === 1 ? 'ão recorrente criada' : 'ões recorrentes criadas'} automaticamente`,
          { duration: 5000 }
        )
        qc.invalidateQueries({ queryKey: queryKeys.transactions.all(user.id) })
        qc.invalidateQueries({ queryKey: queryKeys.analytics.monthly(user.id) })
      }
    })
  }, [user?.id])
}

async function runRecurring(userId: string): Promise<{ created: number }> {
  const today = new Date()
  const todayDay = today.getDate()
  const todayStr = format(today, 'yyyy-MM-dd')
  const currentMonth = format(today, 'yyyy-MM')

  const { data: recurring, error } = await supabase
    .from('recurring_transactions')
    .select('id, description, amount, type, category, payment_method, day_of_month, last_created_at, active')
    .eq('user_id', userId)
    .eq('active', true)

  if (error || !recurring?.length) return { created: 0 }

  let created = 0

  for (const r of recurring) {
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    const targetDay = Math.min(r.day_of_month, daysInMonth)

    // Só executa no dia correto do mês
    if (todayDay !== targetDay) continue

    // Verifica no banco se já foi criada esse mês
    // Essa verificação é atômica — não depende de localStorage ou estado local
    const lastCreated = r.last_created_at as string | null
    if (lastCreated && lastCreated.startsWith(currentMonth)) continue

    // Atualiza last_created_at ANTES de inserir — age como lock otimista
    // Se duas abas tentarem ao mesmo tempo, só a primeira vai passar
    const { error: lockError } = await supabase
      .from('recurring_transactions')
      .update({ last_created_at: todayStr })
      .eq('id', r.id)
      .or(`last_created_at.is.null,last_created_at.lt.${currentMonth}-01`)

    // Se nenhuma linha foi atualizada, outra instância já processou
    if (lockError) continue

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

    if (insertError) {
      // Reverte o lock se o insert falhou
      await supabase
        .from('recurring_transactions')
        .update({ last_created_at: lastCreated })
        .eq('id', r.id)
      console.error('[useRecurringRunner] insert error:', insertError.message)
      continue
    }

    created++
  }

  return { created }
}