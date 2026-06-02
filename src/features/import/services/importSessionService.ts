import { supabase } from '@/shared/lib/supabase'
import type { ImportSession } from '@/shared/types'

export async function hashFile(content: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(content)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function checkDuplicate(userId: string, fileHash: string): Promise<ImportSession | null> {
  const { data } = await supabase
    .from('import_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('file_hash', fileHash)
    .maybeSingle()
  return data
}

export async function saveImportSession(s: {
  userId: string; name: string; bankId: string; format: string
  fileHash: string; transactionCount: number; failedCount: number
}): Promise<void> {
  const { error } = await supabase.from('import_sessions').insert({
    user_id: s.userId, name: s.name, bank_id: s.bankId, format: s.format,
    file_hash: s.fileHash, transaction_count: s.transactionCount, failed_count: s.failedCount,
  })
  if (error) console.error('[saveImportSession]', error.message)
}

export async function fetchImportHistory(userId: string): Promise<ImportSession[]> {
  const { data, error } = await supabase
    .from('import_sessions').select('*').eq('user_id', userId)
    .order('created_at', { ascending: false }).limit(50)
  if (error) return []
  return data ?? []
}

export async function deleteImportSession(id: string): Promise<void> {
  await supabase.from('import_sessions').delete().eq('id', id)
}