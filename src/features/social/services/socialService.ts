import { supabase } from '@/shared/lib/supabase'
import type { Friendship, UserProfile } from '@/shared/types'

export async function fetchFriendships(userId: string): Promise<Friendship[]> {
  const { data, error } = await supabase
    .from('friendships')
    .select('*')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  if (!data?.length) return []

  // Busca todos os perfis em batch — uma query só em vez de N*2
  const userIds = [...new Set(data.flatMap((f) => [f.requester_id, f.addressee_id]))]
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('*')
    .in('user_id', userIds)

  const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p as UserProfile]))

  return data.map((f) => ({
    ...f,
    status: f.status as Friendship['status'],
    requester_profile: profileMap.get(f.requester_id) ?? undefined,
    addressee_profile: profileMap.get(f.addressee_id) ?? undefined,
  }))
}

export async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  return data
}

export async function searchProfiles(term: string, currentUserId: string): Promise<UserProfile[]> {
  if (term.length < 2) return []
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .neq('user_id', currentUserId)
    .or(`username.ilike.%${term}%,display_name.ilike.%${term}%`)
    .limit(10)

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function sendFriendRequest(requesterId: string, addresseeId: string): Promise<void> {
  const { error } = await supabase.from('friendships').insert({
    requester_id: requesterId,
    addressee_id: addresseeId,
    status: 'pending',
  })
  if (error) throw new Error(`Erro ao enviar solicitação: ${error.message}`)
}

export async function respondToFriendRequest(friendshipId: string, accept: boolean): Promise<void> {
  const { error } = await supabase
    .from('friendships')
    .update({ status: accept ? 'accepted' : 'rejected', updated_at: new Date().toISOString() })
    .eq('id', friendshipId)
  if (error) throw new Error(error.message)
}

export async function removeFriend(friendshipId: string): Promise<void> {
  const { error } = await supabase.from('friendships').delete().eq('id', friendshipId)
  if (error) throw new Error(error.message)
}

export function getOtherUserId(friendship: Friendship, currentUserId: string): string {
  return friendship.requester_id === currentUserId
    ? friendship.addressee_id
    : friendship.requester_id
}

export function getOtherProfile(friendship: Friendship, currentUserId: string): UserProfile | undefined {
  return friendship.requester_id === currentUserId
    ? friendship.addressee_profile
    : friendship.requester_profile
}