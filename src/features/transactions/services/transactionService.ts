import { supabase } from '@/shared/lib/supabase'
import { roundToCents } from '@/shared/lib/utils'
import type { Transaction, TransactionInput } from '@/shared/types'

// ─── Fetch ────────────────────────────────────────────────────
export async function fetchTransactions(userId: string): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Erro ao buscar transações: ${error.message}`)
  return (data ?? []).map(normalizeTransaction)
}

// ─── Create ───────────────────────────────────────────────────
export async function createTransaction(
  input: TransactionInput,
  userId: string
): Promise<Transaction> {
  // Se há divisão, o criador paga apenas o que sobrar depois de descontar
  // os valores que serão cobrados dos amigos
  let creatorAmount = input.amount
  if (input.shared_with?.length) {
    const totalShared = input.shared_with.reduce((s, f) => s + f.amount, 0)
    creatorAmount = Math.max(0, input.amount - totalShared)
  }

  const amount = input.type === 'expense'
    ? -Math.abs(creatorAmount)
    : Math.abs(creatorAmount)

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      description: input.description.trim(),
      amount: roundToCents(amount),
      type: input.type === 'income' ? 'credit' : 'debit',
      category: input.category,
      payment_method: input.payment_method,
      date: input.date,
      ...(input.tags?.length ? { tags: input.tags } : {}),
    })
    .select()
    .single()

  if (error) throw new Error(`Erro ao criar transação: ${error.message}`)
  return normalizeTransaction(data)
}

// ─── Create installments ──────────────────────────────────────
export async function createInstallmentTransactions(
  input: TransactionInput,
  userId: string,
  installments: number
): Promise<Transaction[]> {
  const { addMonths, format, parseISO } = await import('date-fns')
  const startDate = parseISO(input.date)

  // O criador paga sua parte por parcela = (total - partes dos amigos) / parcelas
  const totalShared = (input.shared_with ?? []).reduce((s, f) => s + f.amount, 0)
  const creatorTotal = Math.max(0, input.amount - totalShared)
  const installmentAmount = roundToCents(creatorTotal / installments)

  const rows = Array.from({ length: installments }, (_, i) => ({
    user_id: userId,
    description: `${input.description.trim()} (${i + 1}/${installments})`,
    amount: input.type === 'expense'
      ? -Math.abs(installmentAmount)
      : Math.abs(installmentAmount),
    type: input.type === 'income' ? 'credit' : 'debit',
    category: input.category,
    payment_method: input.payment_method,
    date: format(addMonths(startDate, i), 'yyyy-MM-dd'),
  }))

  const { data, error } = await supabase
    .from('transactions')
    .insert(rows)
    .select()

  if (error) throw new Error(`Erro ao criar parcelas: ${error.message}`)
  return (data ?? []).map(normalizeTransaction)
}

// ─── Update ───────────────────────────────────────────────────
export async function updateTransaction(
  id: string,
  input: Partial<TransactionInput>,
  userId: string
): Promise<Transaction> {
  const updates: Record<string, unknown> = {}

  if (input.description !== undefined) updates.description = input.description.trim()
  if (input.category !== undefined) updates.category = input.category
  if (input.payment_method !== undefined) updates.payment_method = input.payment_method
  if (input.date !== undefined) updates.date = input.date
  if (input.type !== undefined && input.amount !== undefined) {
    const amount = input.type === 'expense'
      ? -Math.abs(input.amount)
      : Math.abs(input.amount)
    updates.amount = roundToCents(amount)
    updates.type = input.type === 'income' ? 'credit' : 'debit'
  }

  const { data, error } = await supabase
    .from('transactions')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw new Error(`Erro ao atualizar transação: ${error.message}`)
  return normalizeTransaction(data)
}

// ─── Delete ───────────────────────────────────────────────────
export async function deleteTransaction(id: string, userId: string): Promise<void> {
  await supabase.from('shared_transactions').delete().eq('transaction_id', id)
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw new Error(`Erro ao excluir transação: ${error.message}`)
}

// ─── Shared expense ───────────────────────────────────────────
// Cria os registros de shared_transactions para cada amigo.
// O trigger no banco cria automaticamente a notificação para cada um.
export async function createSharedExpense(
  transactionId: string,
  shares: { user_id: string; amount: number; percentage?: number }[]
): Promise<void> {
  if (!shares.length) return

  // Verificar duplicatas — evitar criar shared_transaction que já existe
  const { data: existing } = await supabase
    .from('shared_transactions')
    .select('shared_with_user_id')
    .eq('transaction_id', transactionId)

  const existingUserIds = new Set((existing ?? []).map((r) => r.shared_with_user_id))

  const newShares = shares.filter((s) => !existingUserIds.has(s.user_id))
  if (!newShares.length) {
    console.warn('[createSharedExpense] Todas as divisões já existem — ignorando para evitar duplicata')
    return
  }

  const records = newShares.map((s) => ({
    transaction_id: transactionId,
    shared_with_user_id: s.user_id,
    split_amount: roundToCents(s.amount),
    split_percentage: s.percentage ?? null,
    status: 'pending_approval',
  }))

  const { error } = await supabase.from('shared_transactions').insert(records)
  if (error) throw new Error(`Erro ao criar despesa compartilhada: ${error.message}`)
}

// ─── Normalize ────────────────────────────────────────────────
function normalizeTransaction(raw: Record<string, unknown>): Transaction {
  return {
    id: raw.id as string,
    user_id: raw.user_id as string,
    description: raw.description as string,
    amount: raw.amount as number,
    type: (raw.type === 'credit' ? 'income' : 'expense') as Transaction['type'],
    category: raw.category as string,
    payment_method: (raw.payment_method as string) ?? null,
    date: raw.date as string,
    created_at: raw.created_at as string,
    updated_at: raw.updated_at as string,
  }
}