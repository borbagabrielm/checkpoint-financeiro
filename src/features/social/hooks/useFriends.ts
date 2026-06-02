import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/shared/hooks/useAuth'
import { queryKeys } from '@/shared/lib/queryKeys'
import {
  fetchFriendships,
  sendFriendRequest,
  respondToFriendRequest,
  removeFriend,
} from '../services/socialService'

export function useFriends() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: queryKeys.friendships.all(user?.id ?? ''),
    queryFn: () => fetchFriendships(user!.id),
    enabled: !!user?.id,
    staleTime: 60_000,
  })

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: queryKeys.friendships.all(user?.id ?? '') })

  const friendships = query.data ?? []
  const accepted = friendships.filter((f) => f.status === 'accepted')
  const pending = friendships.filter(
    (f) => f.status === 'pending' && f.addressee_id === user?.id
  )
  const sent = friendships.filter(
    (f) => f.status === 'pending' && f.requester_id === user?.id
  )

  const sendRequest = useMutation({
    mutationFn: (addresseeId: string) => sendFriendRequest(user!.id, addresseeId),
    onSuccess: () => { invalidate(); toast.success('Solicitação enviada') },
    onError: (e: Error) => toast.error(e.message),
  })

  const respond = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
      respondToFriendRequest(id, accept),
    onSuccess: (_, { accept }) => {
      invalidate()
      toast.success(accept ? 'Amizade aceita!' : 'Solicitação recusada')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: (id: string) => removeFriend(id),
    onSuccess: () => { invalidate(); toast.success('Amigo removido') },
    onError: (e: Error) => toast.error(e.message),
  })

  return {
    isLoading: query.isLoading,
    accepted,
    pending,
    sent,
    sendRequest,
    respond,
    remove,
  }
}
