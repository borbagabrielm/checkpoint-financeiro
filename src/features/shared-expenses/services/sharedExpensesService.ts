import { supabase } from '@/shared/lib/supabase'
import type { SharedTransactionWithDetails } from '@/shared/types'

// ─── helpers ─────────────────────────────────────────────────

async function enrichSharedRows(rows: Record<string, unknown>[]): Promise<SharedTransactionWithDetails[]> {
  if (!rows || !rows.length) return []

  // 1. Busca transações em batch (sem join — evita RLS cruzada)
  const txIds = [...new Set(rows.map((r) => r.transaction_id as string))]
  const { data: transactions } = await supabase
    .from('transactions')
    .select('id, description, amount, type, category, payment_method, date, user_id, recurring_id')
    .in('id', txIds)
  const txMap = new Map((transactions ?? []).map((t) => [t.id, t]))

  // 2. Busca perfis dos remetentes em batch
  const senderIds = [...new Set(
    (transactions ?? []).map((t) => t.user_id).filter(Boolean)
  )]
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('user_id, display_name, username, avatar_url')
    .in('user_id', senderIds)

  const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]))

  const result = rows.map((row) => {
    const tx = txMap.get(row.transaction_id as string)
    const profile = tx ? profileMap.get(tx.user_id) : undefined
    return {
      id: row.id as string,
      transaction_id: row.transaction_id as string,
      shared_with_user_id: row.shared_with_user_id as string,
      split_amount: row.split_amount as number,
      split_percentage: (row.split_percentage as number) ?? null,
      status: row.status as SharedTransactionWithDetails['status'],
      created_at: row.created_at as string,
      transaction: tx ? {
        ...tx,
        type: (tx.type === 'credit' ? 'income' : 'expense') as 'income' | 'expense',
        updated_at: '',
        created_at: '',
      } : null as unknown as SharedTransactionWithDetails['transaction'],
      sender_profile: profile ? { ...profile, id: '', bio: null, created_at: '', updated_at: '' } as unknown as SharedTransactionWithDetails['sender_profile'] : null as unknown as SharedTransactionWithDetails['sender_profile'],
    }
  })
  return result
}

// ─── fetch pending ────────────────────────────────────────────

export async function fetchPendingApprovals(userId: string): Promise<SharedTransactionWithDetails[]> {
  console.log('[fetchPendingApprovals] querying for userId:', userId)
  const { data, error } = await supabase
    .from('shared_transactions')
    .select('id, transaction_id, shared_with_user_id, split_amount, split_percentage, status, created_at')
    .eq('shared_with_user_id', userId)
    .eq('status', 'pending_approval')
    .order('created_at', { ascending: false })

  console.log('[fetchPendingApprovals] result:', { error: error?.message, count: data?.length, data })
  if (error) {
    console.error('[fetchPendingApprovals] error:', error.message)
    return []
  }
  if (!data || !data.length) return []
  return enrichSharedRows(data)
}

// ─── fetch history ────────────────────────────────────────────

export async function fetchApprovalHistory(userId: string): Promise<SharedTransactionWithDetails[]> {
  const { data, error } = await supabase
    .from('shared_transactions')
    .select('id, transaction_id, shared_with_user_id, split_amount, split_percentage, status, created_at')
    .eq('shared_with_user_id', userId)
    .in('status', ['approved', 'rejected'])
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) {
    console.error('[fetchApprovalHistory] error:', error.message)
    return []  // retorna array vazio em vez de throw para não quebrar a página
  }
  if (!data || !data.length) return []
  return enrichSharedRows(data)
}

// ─── approve ─────────────────────────────────────────────────

export async function approveSharedTransaction(
  sharedTransactionId: string,
  userId: string
): Promise<void> {
  // 1. Busca o shared_transaction (o amigo TEM acesso a essa linha — é dele)
  const { data: shared, error: fetchError } = await supabase
    .from('shared_transactions')
    .select('id, transaction_id, split_amount, split_percentage, recurring_id')
    .eq('id', sharedTransactionId)
    .eq('shared_with_user_id', userId)
    .single()

  if (fetchError || !shared) throw new Error('Compartilhamento não encontrado')

  // 2. Busca a transação original — a policy de SELECT libera para quem
  //    tem um shared_transactions apontando pra ela (ver migration SQL)
  const { data: tx } = await supabase
    .from('transactions')
    .select('description, category, payment_method, date, amount')
    .eq('id', shared.transaction_id)
    .maybeSingle()

  // 3. Insere a transação na conta do aprovador (user_id = auth.uid()),
  //    propagando recurring_id pra permitir limpeza em cascata se o dono
  //    desativar a recorrência mais tarde
  const { error: insertError } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      description: tx?.description ?? 'Despesa compartilhada',
      amount: -Math.abs(shared.split_amount),
      type: 'debit',
      category: tx?.category ?? 'Outros',
      payment_method: tx?.payment_method ?? null,
      date: tx?.date ?? new Date().toISOString().split('T')[0],
      recurring_id: shared.recurring_id ?? null,
    })

  if (insertError) throw new Error(`Erro ao criar transação: ${insertError.message}`)

  // 4. Atualiza status
  const { error: updateError } = await supabase
    .from('shared_transactions')
    .update({ status: 'approved' })
    .eq('id', sharedTransactionId)

  if (updateError) throw new Error(updateError.message)
}

// ─── reject ───────────────────────────────────────────────────

export async function rejectSharedTransaction(sharedTransactionId: string): Promise<void> {
  const { error } = await supabase
    .from('shared_transactions')
    .update({ status: 'rejected' })
    .eq('id', sharedTransactionId)

  if (error) throw new Error(error.message)
}

// ─── unread count ─────────────────────────────────────────────

export async function fetchUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('shared_transaction_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_user_id', userId)
    .eq('is_read', false)

  if (error) return 0
  return count ?? 0
}