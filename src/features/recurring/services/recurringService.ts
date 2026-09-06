import { format, parseISO, addMonths, startOfMonth, endOfMonth, getDaysInMonth } from 'date-fns'
import { supabase } from '@/shared/lib/supabase'
import { roundToCents } from '@/shared/lib/utils'
import { fetchFriendships, getOtherUserId } from '@/features/social/services/socialService'
import type { RecurringTransaction, RecurringTransactionShare, SharedRecurringTransaction, UserProfile } from '@/shared/types'

export interface RecurringShareInput {
  user_id: string
  amount: number
  percentage?: number
}

// ─── Fetch ────────────────────────────────────────────────────
export async function fetchRecurring(userId: string): Promise<RecurringTransaction[]> {
  const { data, error } = await supabase
    .from('recurring_transactions').select('*').eq('user_id', userId).order('created_at')
  if (error) return []
  return (data ?? []).map((r) => ({
    ...r,
    type: (r.type === 'credit' ? 'income' : 'expense') as RecurringTransaction['type'],
  }))
}

export async function fetchRecurringShares(recurringId: string): Promise<RecurringTransactionShare[]> {
  const { data, error } = await supabase
    .from('recurring_transaction_shares')
    .select('*')
    .eq('recurring_id', recurringId)
  if (error) return []
  return data ?? []
}

// Recorrências de amigos que compartilharam com o usuário atual
export async function fetchSharedRecurring(userId: string): Promise<SharedRecurringTransaction[]> {
  const { data: shares, error } = await supabase
    .from('recurring_transaction_shares')
    .select('*')
    .eq('shared_with_user_id', userId)
  if (error || !shares?.length) return []

  const recurringIds = [...new Set(shares.map((s) => s.recurring_id as string))]
  const { data: recurringRows } = await supabase
    .from('recurring_transactions')
    .select('*')
    .in('id', recurringIds)
    .eq('active', true)

  const recurringMap = new Map((recurringRows ?? []).map((r) => [r.id as string, r]))

  const ownerIds = [...new Set((recurringRows ?? []).map((r) => r.user_id as string))]
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('*')
    .in('user_id', ownerIds)
  const profileMap = new Map((profiles ?? []).map((p) => [p.user_id as string, p as UserProfile]))

  return shares
    .map((s) => {
      const r = recurringMap.get(s.recurring_id as string)
      if (!r) return null
      return {
        ...r,
        type: (r.type === 'credit' ? 'income' : 'expense') as RecurringTransaction['type'],
        owner_profile: profileMap.get(r.user_id as string) ?? null,
        split_amount: s.split_amount as number,
      } as SharedRecurringTransaction
    })
    .filter((x): x is SharedRecurringTransaction => x !== null)
}

// ─── Geração de meses (motor novo) ──────────────────────────────
// Gera as transações de recurring pra cada mês faltante entre fromMonthKey
// e toMonthKey ('yyyy-MM', inclusive), com o compartilhamento configurado.
// Idempotente: consulta o range inteiro de uma vez e pula meses já criados.
export async function generateRecurringMonths(
  recurring: RecurringTransaction,
  shares: RecurringShareInput[],
  fromMonthKey: string,
  toMonthKey: string
): Promise<number> {
  if (fromMonthKey > toMonthKey) return 0

  const monthKeys = monthKeysBetween(fromMonthKey, toMonthKey)
  const rangeStart = `${fromMonthKey}-01`
  const rangeEnd = format(endOfMonth(parseISO(`${toMonthKey}-01`)), 'yyyy-MM-dd')

  const { data: existingRows } = await supabase
    .from('transactions')
    .select('date')
    .eq('recurring_id', recurring.id)
    .gte('date', rangeStart)
    .lte('date', rangeEnd)

  const existingMonths = new Set((existingRows ?? []).map((r) => (r.date as string).slice(0, 7)))
  const monthsToGenerate = monthKeys.filter((m) => !existingMonths.has(m))
  let created = 0

  if (monthsToGenerate.length) {
    // Só compartilha com amigos cuja amizade ainda está ativa — se foi
    // desfeita, o dono simplesmente paga o valor cheio daquele mês
    let acceptedFriendIds = new Set<string>()
    if (shares.length) {
      const friendships = await fetchFriendships(recurring.user_id)
      acceptedFriendIds = new Set(
        friendships
          .filter((f) => f.status === 'accepted')
          .map((f) => getOtherUserId(f, recurring.user_id))
      )
    }
    const effectiveShares = shares.filter((s) => acceptedFriendIds.has(s.user_id))

    const totalNominal = Math.abs(recurring.amount)
    const totalShared = effectiveShares.reduce((sum, s) => sum + s.amount, 0)
    const ownerAmount = Math.max(0, roundToCents(totalNominal - totalShared))
    const signedOwnerAmount = recurring.type === 'expense' ? -ownerAmount : ownerAmount

    for (const monthKey of monthsToGenerate) {
      const date = dateForMonth(monthKey, recurring.day_of_month)

      const { data: txRow, error: insertError } = await supabase
        .from('transactions')
        .insert({
          user_id: recurring.user_id,
          recurring_id: recurring.id,
          description: recurring.description,
          amount: signedOwnerAmount,
          type: recurring.type === 'income' ? 'credit' : 'debit',
          category: recurring.category,
          payment_method: recurring.payment_method,
          date,
        })
        .select('id')
        .single()

      if (insertError || !txRow) {
        console.error('[generateRecurringMonths] insert error:', insertError?.message)
        continue
      }

      created++

      if (effectiveShares.length) {
        const records = effectiveShares.map((s) => ({
          transaction_id: txRow.id,
          shared_with_user_id: s.user_id,
          split_amount: roundToCents(s.amount),
          split_percentage: s.percentage ?? null,
          status: 'pending_approval',
          recurring_id: recurring.id,
        }))
        const { error: shareError } = await supabase.from('shared_transactions').insert(records)
        if (shareError) console.error('[generateRecurringMonths] share insert error:', shareError.message)
      }
    }
  }

  await supabase
    .from('recurring_transactions')
    .update({ generated_until: toMonthKey })
    .eq('id', recurring.id)

  return created
}

function monthKeysBetween(fromKey: string, toKey: string): string[] {
  const keys: string[] = []
  let cursor = parseISO(`${fromKey}-01`)
  const end = parseISO(`${toKey}-01`)
  while (cursor <= end) {
    keys.push(format(cursor, 'yyyy-MM'))
    cursor = addMonths(cursor, 1)
  }
  return keys
}

function dateForMonth(monthKey: string, dayOfMonth: number): string {
  const monthStart = parseISO(`${monthKey}-01`)
  const days = getDaysInMonth(monthStart)
  const day = Math.min(dayOfMonth, days)
  return format(new Date(monthStart.getFullYear(), monthStart.getMonth(), day), 'yyyy-MM-dd')
}

function currentMonthKey(): string {
  return format(new Date(), 'yyyy-MM')
}

function yearEndKey(): string {
  return `${format(new Date(), 'yyyy')}-12`
}

// ─── Create ───────────────────────────────────────────────────
export async function createRecurring(
  userId: string,
  input: Omit<RecurringTransaction, 'id' | 'user_id' | 'created_at' | 'last_created_at' | 'generated_until'>,
  shares: RecurringShareInput[] = []
): Promise<void> {
  const { data, error } = await supabase
    .from('recurring_transactions')
    .insert({
      user_id: userId,
      description: input.description,
      amount: input.type === 'expense' ? -Math.abs(input.amount) : Math.abs(input.amount),
      type: input.type === 'income' ? 'credit' : 'debit',
      category: input.category,
      payment_method: input.payment_method,
      day_of_month: input.day_of_month,
      active: input.active,
    })
    .select('*')
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Erro ao criar recorrência')

  const recurring: RecurringTransaction = {
    ...data,
    type: (data.type === 'credit' ? 'income' : 'expense') as RecurringTransaction['type'],
  }

  if (shares.length) {
    const shareRecords = shares.map((s) => ({
      recurring_id: recurring.id,
      shared_with_user_id: s.user_id,
      split_amount: roundToCents(s.amount),
      split_percentage: s.percentage ?? null,
    }))
    const { error: shareError } = await supabase.from('recurring_transaction_shares').insert(shareRecords)
    if (shareError) throw new Error(`Erro ao compartilhar recorrência: ${shareError.message}`)
  }

  await generateRecurringMonths(recurring, shares, currentMonthKey(), yearEndKey())
}

// ─── Activate / Deactivate ──────────────────────────────────────
export async function activateRecurring(id: string): Promise<void> {
  const { data, error } = await supabase
    .from('recurring_transactions')
    .update({ active: true })
    .eq('id', id)
    .select('*')
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Erro ao ativar recorrência')

  const recurring: RecurringTransaction = {
    ...data,
    type: (data.type === 'credit' ? 'income' : 'expense') as RecurringTransaction['type'],
  }

  // Recorrências legadas (nunca migradas pro motor novo) continuam reativas,
  // dia a dia — não geram nada aqui
  if (!recurring.generated_until) return

  const shares = await fetchRecurringShares(id)
  await generateRecurringMonths(
    recurring,
    shares.map((s) => ({ user_id: s.shared_with_user_id, amount: s.split_amount, percentage: s.split_percentage ?? undefined })),
    currentMonthKey(),
    yearEndKey()
  )
}

export async function deactivateRecurring(id: string): Promise<void> {
  const nextMonthStart = format(startOfMonth(addMonths(new Date(), 1)), 'yyyy-MM-dd')

  // RLS permite que o dono apague tanto as próprias transações futuras
  // quanto a cópia já aprovada na conta do amigo (ver migration SQL);
  // o cascade de shared_transactions/notificações acontece sozinho
  const { error: deleteError } = await supabase
    .from('transactions')
    .delete()
    .eq('recurring_id', id)
    .gte('date', nextMonthStart)
  if (deleteError) throw new Error(`Erro ao remover lançamentos futuros: ${deleteError.message}`)

  const { error } = await supabase
    .from('recurring_transactions')
    .update({ active: false })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

// ─── Delete ───────────────────────────────────────────────────
export async function deleteRecurring(id: string): Promise<void> {
  const nextMonthStart = format(startOfMonth(addMonths(new Date(), 1)), 'yyyy-MM-dd')
  await supabase.from('transactions').delete().eq('recurring_id', id).gte('date', nextMonthStart)

  const { error } = await supabase.from('recurring_transactions').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
