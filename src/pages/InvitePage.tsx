import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { UserPlus, Loader2, Check } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/display'
import { Card, CardContent } from '@/shared/components/ui/display'
import { getInitials } from '@/shared/lib/utils'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/shared/hooks/useAuth'
import { useFriends } from '@/features/social/hooks/useFriends'
import type { UserProfile } from '@/shared/types'

export default function InvitePage() {
  const { userId } = useParams<{ userId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { sendRequest } = useFriends()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (!userId) return
    supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => { setProfile(data); setLoading(false) })
  }, [userId])

  const handleAccept = async () => {
    if (!user) {
      // Salva o convite no localStorage e redireciona para login
      localStorage.setItem('pending_invite', userId ?? '')
      navigate('/auth')
      return
    }
    if (!userId) return
    await sendRequest.mutateAsync(userId)
    setSent(true)
  }

  // Ao fazer login, processa convite pendente
  useEffect(() => {
    if (!user) return
    const pending = localStorage.getItem('pending_invite')
    if (pending && pending !== user.id) {
      localStorage.removeItem('pending_invite')
      sendRequest.mutate(pending)
    }
  }, [user])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-lg font-semibold">Convite inválido</p>
          <p className="text-sm text-muted-foreground mt-1">Este link de convite não é válido.</p>
          <Button className="mt-4" onClick={() => navigate('/')}>Ir para o app</Button>
        </div>
      </div>
    )
  }

  // Não pode adicionar a si mesmo
  if (user?.id === userId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-lg font-semibold">Este é seu próprio convite!</p>
          <p className="text-sm text-muted-foreground mt-1">Compartilhe com amigos para conectar.</p>
          <Button className="mt-4" onClick={() => navigate('/')}>Voltar ao app</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm animate-scale-in">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium mb-4">
            <UserPlus className="h-4 w-4" />
            Convite de amizade
          </div>
          <h1 className="text-2xl font-display font-semibold">Checkpoint Financeiro</h1>
          <p className="text-sm text-muted-foreground mt-1">Controle financeiro com divisão de gastos</p>
        </div>

        <Card>
          <CardContent className="pt-6 pb-6 text-center space-y-4">
            <Avatar className="h-20 w-20 mx-auto">
              {profile.avatar_url && <AvatarImage src={profile.avatar_url} />}
              <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                {getInitials(profile.display_name)}
              </AvatarFallback>
            </Avatar>

            <div>
              <p className="font-semibold text-lg">{profile.display_name ?? profile.username}</p>
              {profile.username && <p className="text-sm text-muted-foreground">@{profile.username}</p>}
              {profile.bio && <p className="text-sm text-muted-foreground mt-1">{profile.bio}</p>}
            </div>

            <p className="text-sm text-muted-foreground">
              quer se conectar com você no Checkpoint Financeiro para dividir despesas e acompanhar gastos juntos.
            </p>

            {sent ? (
              <div className="flex items-center justify-center gap-2 text-[hsl(var(--income))] font-medium">
                <Check className="h-5 w-5" />
                Solicitação enviada!
              </div>
            ) : (
              <Button className="w-full" onClick={handleAccept} disabled={sendRequest.isPending}>
                {sendRequest.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Enviando...</>
                ) : user ? (
                  <><UserPlus className="h-4 w-4" />Adicionar como amigo</>
                ) : (
                  <><UserPlus className="h-4 w-4" />Criar conta e adicionar</>
                )}
              </Button>
            )}

            {sent && (
              <Button variant="outline" className="w-full" onClick={() => navigate('/')}>
                Ir para o Dashboard
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}