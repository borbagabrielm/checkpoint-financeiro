import { useState } from 'react'
import { Search, UserPlus, UserCheck, UserX, Eye, Link2 } from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/form-elements'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/display'
import { Avatar, AvatarFallback, AvatarImage, Badge, Skeleton } from '@/shared/components/ui/display'
import { getInitials, formatDate } from '@/shared/lib/utils'
import { useFriends } from '@/features/social/hooks/useFriends'
import { useAuth } from '@/shared/hooks/useAuth'
import { searchProfiles, getOtherProfile } from '@/features/social/services/socialService'
import type { UserProfile } from '@/shared/types'

export default function SocialPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { accepted, pending, sent, isLoading, sendRequest, respond, remove } = useFriends()

  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<UserProfile[]>([])
  const [searching, setSearching] = useState(false)

  const handleSearch = async (term: string) => {
    setSearchTerm(term)
    if (term.length < 2) { setSearchResults([]); return }
    setSearching(true)
    try {
      const results = await searchProfiles(term, user!.id)
      setSearchResults(results)
    } catch {
      toast.error('Erro na busca')
    } finally {
      setSearching(false)
    }
  }

  const copyInviteLink = () => {
    const link = `${window.location.origin}/invite/${user!.id}`
    if (navigator.share) {
      navigator.share({ title: 'Checkpoint Financeiro', text: 'Me adicione no Checkpoint Financeiro!', url: link })
    } else {
      navigator.clipboard.writeText(link)
      toast.success('Link copiado! Compartilhe com seus amigos.')
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="page-header">
          <h1 className="page-title">Amigos</h1>
          <p className="page-subtitle">Gerencie suas conexões e despesas compartilhadas</p>
        </div>
        <Button variant="outline" size="sm" onClick={copyInviteLink} className="shrink-0">
          <Link2 className="h-4 w-4" />
          Convidar
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardHeader><CardTitle>Adicionar amigo</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou usuário..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {searching && <Skeleton className="h-12 w-full" />}
          {searchResults.length > 0 && (
            <ul className="space-y-1.5">
              {searchResults.map((profile) => {
                const alreadySent = sent.some(
                  (f) => f.addressee_id === profile.user_id
                )
                const alreadyFriend = accepted.some(
                  (f) =>
                    f.requester_id === profile.user_id ||
                    f.addressee_id === profile.user_id
                )
                return (
                  <li
                    key={profile.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary transition-colors"
                  >
                    <Avatar className="h-8 w-8">
                      {profile.avatar_url && <AvatarImage src={profile.avatar_url} />}
                      <AvatarFallback>{getInitials(profile.display_name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {profile.display_name ?? profile.username}
                      </p>
                      {profile.username && (
                        <p className="text-xs text-muted-foreground">@{profile.username}</p>
                      )}
                    </div>
                    {alreadyFriend ? (
                      <Badge variant="approved">Amigo</Badge>
                    ) : alreadySent ? (
                      <Badge variant="pending">Solicitado</Badge>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => sendRequest.mutate(profile.user_id)}
                        disabled={sendRequest.isPending}
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Adicionar
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Pending requests */}
      {pending.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Solicitações recebidas
              <Badge variant="pending">{pending.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {pending.map((f) => {
                const profile = f.requester_profile
                return (
                  <li key={f.id} className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
                      <AvatarFallback>{getInitials(profile?.display_name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{profile?.display_name ?? 'Usuário'}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(f.created_at)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => respond.mutate({ id: f.id, accept: true })}
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                        Aceitar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => respond.mutate({ id: f.id, accept: false })}
                      >
                        <UserX className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Friends list */}
      <Card>
        <CardHeader>
          <CardTitle>
            Meus amigos{' '}
            {!isLoading && (
              <span className="text-muted-foreground font-normal text-sm">
                ({accepted.length})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-4 w-40" />
                </div>
              ))}
            </div>
          ) : accepted.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <p className="text-2xl mb-2">👥</p>
              <p className="text-sm text-muted-foreground">
                Nenhum amigo ainda. Busque pelo nome para adicionar.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {accepted.map((f) => {
                const profile = getOtherProfile(f, user!.id)
                return (
                  <li key={f.id} className="flex items-center gap-3 group">
                    <Avatar className="h-8 w-8">
                      {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
                      <AvatarFallback>{getInitials(profile?.display_name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {profile?.display_name ?? profile?.username ?? 'Usuário'}
                      </p>
                      {profile?.username && (
                        <p className="text-xs text-muted-foreground">@{profile.username}</p>
                      )}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => profile && navigate(`/friend/${profile.user_id}`)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 hover:text-destructive"
                        onClick={() => remove.mutate(f.id)}
                      >
                        <UserX className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}