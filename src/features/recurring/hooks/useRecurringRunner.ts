import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/shared/hooks/useAuth'
import { supabase } from '@/shared/lib/supabase'
import { queryKeys } from '@/shared/lib/queryKeys'
import { format } from 'date-fns'

// Roda uma vez por sessão de login.
// Verifica quais recorrentes ativas devem ser criadas hoje e cria automaticamente.
export function useRecurringRunner() {
  const { user } = useAuth()
  const qc = useQueryClient()

  useEffect(() => {
    if (!user?.id) return

    // Chave por usuário + data para não rodar mais de uma vez por dia
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
        toast.warning(`${errors} recorrente(s) não puderam ser criadas`)
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

  // Busca todas as recorrentes ativas do usuário
  const { data: recurring, error } = await supabase
    .from('recurring_transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true)

  if (error || !recurring?.length) return { created: 0, errors: 0 }

  let created = 0
  let errors = 0

  for (const r of recurring) {
    // Verifica se hoje é o dia desta recorrente
    // (ou se o dia não existe neste mês, usa o último dia do mês)
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    const targetDay = Math.min(r.day_of_month, daysInMonth)
    if (todayDay !== targetDay) continue

    // Verifica se já foi criada este mês
    const lastCreated = r.last_created_at as string | null
    if (lastCreated && lastCreated.startsWith(currentMonth)) continue

    try {
      // Cria a transação
      const { error: insertError } = await supabase.from('transactions').insert({
        user_id: userId,
        description: r.description,
        amount: r.amount,
        type: r.type,
        category: r.category,
        payment_method: r.payment_method,
        date: todayStr,
      })

      if (insertError) throw new Error(insertError.message)

      // Atualiza last_created_at
      await supabase
        .from('recurring_transactions')
        .update({ last_created_at: todayStr })
        .eq('id', r.id)

      created++
    } catch {
      errors++
    }
  }

  return { created, errors }
}