// useRecurringRunner — cria transações recorrentes automaticamente ao logar
//
// Duas recorrências convivem aqui:
// - Motor legado (generated_until null): reativo, dia a dia, olha só o dia
//   de hoje — igual ao comportamento original, intocado.
// - Motor novo (generated_until preenchido): geração antecipada — sempre que
//   generated_until fica atrás do mês atual (virada de ano, ou qualquer gap),
//   gera de uma vez até dezembro do ano corrente via generateRecurringMonths.
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { useAuth } from '@/shared/hooks/useAuth'
import { supabase } from '@/shared/lib/supabase'
import { queryKeys } from '@/shared/lib/queryKeys'
import { generateRecurringMonths, fetchRecurringShares } from '../services/recurringService'
import type { RecurringTransaction } from '@/shared/types'

export function useRecurringRunner() {
  const { user } = useAuth()
  const qc = useQueryClient()

  useEffect(() => {
    if (!user?.id) return
    Promise.all([runLegacyRecurring(user.id), runNewRecurring(user.id)]).then(([legacy, fresh]) => {
      const created = legacy + fresh
      if (created > 0) {
        toast.success(
          `${created} transaç${created === 1 ? 'ão recorrente criada' : 'ões recorrentes criadas'} automaticamente`,
          { duration: 5000 }
        )
        qc.invalidateQueries({ queryKey: queryKeys.transactions.all(user.id) })
        qc.invalidateQueries({ queryKey: queryKeys.analytics.monthly(user.id) })
        qc.invalidateQueries({ queryKey: queryKeys.recurring.mine(user.id) })
      }
    })
  }, [user?.id])
}

// ─── Motor legado — reativo, dia a dia (recorrências nunca migradas) ────
async function runLegacyRecurring(userId: string): Promise<number> {
  const today = new Date()
  const todayDay = today.getDate()
  const todayStr = format(today, 'yyyy-MM-dd')
  const currentMonth = format(today, 'yyyy-MM')

  const { data: recurring, error } = await supabase
    .from('recurring_transactions')
    .select('id, description, amount, type, category, payment_method, day_of_month, last_created_at, active')
    .eq('user_id', userId)
    .eq('active', true)
    .is('generated_until', null)

  if (error || !recurring?.length) return 0

  let created = 0

  for (const r of recurring) {
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    const targetDay = Math.min(r.day_of_month, daysInMonth)

    // Só executa no dia correto do mês
    if (todayDay !== targetDay) continue

    // Verifica no banco se já foi criada esse mês
    const lastCreated = r.last_created_at as string | null
    if (lastCreated && lastCreated.startsWith(currentMonth)) continue

    // Atualiza last_created_at ANTES de inserir — age como lock otimista
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
      await supabase
        .from('recurring_transactions')
        .update({ last_created_at: lastCreated })
        .eq('id', r.id)
      console.error('[useRecurringRunner] insert error:', insertError.message)
      continue
    }

    created++
  }

  return created
}

// ─── Motor novo — geração antecipada até dezembro do ano corrente ───────
async function runNewRecurring(userId: string): Promise<number> {
  const currentMonth = format(new Date(), 'yyyy-MM')
  const yearEnd = `${format(new Date(), 'yyyy')}-12`

  const { data: recurring, error } = await supabase
    .from('recurring_transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true)
    .not('generated_until', 'is', null)
    .lt('generated_until', currentMonth)

  if (error || !recurring?.length) return 0

  let created = 0

  for (const raw of recurring) {
    const r: RecurringTransaction = {
      ...raw,
      type: (raw.type === 'credit' ? 'income' : 'expense') as RecurringTransaction['type'],
    }
    const shares = await fetchRecurringShares(r.id)
    created += await generateRecurringMonths(
      r,
      shares.map((s) => ({ user_id: s.shared_with_user_id, amount: s.split_amount, percentage: s.split_percentage ?? undefined })),
      currentMonth,
      yearEnd
    )
  }

  return created
}
