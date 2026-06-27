import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader2, Check, UserPlus } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/display'
import { Card, CardContent } from '@/shared/components/ui/display'
import { getInitials } from '@/shared/lib/utils'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/shared/hooks/useAuth'
import { useFriends } from '@/features/social/hooks/useFriends'
import type { UserProfile } from '@/shared/types'

// Logo completo do Raxo — % azul (light) ou lime (dark) via --logo-accent
function RaxoLogo({ height = 36 }: { height?: number }) {
  return (
    <svg viewBox="322 194 380 120" height={height} xmlns="http://www.w3.org/2000/svg" aria-label="Raxo">
      <path d="M381.1,306.23h32.17l-22.16-40.68c5.65-2.72,10.11-6.56,13.34-11.57,3.46-5.36,5.19-11.95,5.19-19.76s-1.69-14.38-5.06-19.92c-3.37-5.54-8.1-9.78-14.17-12.73-6.07-2.95-13.16-4.42-21.25-4.42h-47.09v109.09h29.62v-36.01h10.25l19.15,36.01ZM351.7,220.78h10.44c3.48,0,6.45.47,8.92,1.41,2.47.94,4.37,2.4,5.7,4.37,1.33,1.97,2,4.52,2,7.64s-.67,5.59-2,7.51-3.23,3.31-5.7,4.18c-2.47.87-5.44,1.3-8.92,1.3h-10.44v-26.42Z" fill="currentColor"/>
      <path d="M416.19,284.59c0-15.2,10.74-24.62,30.57-26.11l23.14-1.82v-1.32c0-8.1-4.96-12.39-14.05-12.39-10.74,0-16.53,4.13-16.53,11.57h-21.15c0-18.67,15.37-30.9,39-30.9s37.51,13.39,37.51,37.02v48.26h-22.48l-1.65-10.91c-2.64,7.6-13.55,13.05-25.95,13.05-17.52,0-28.42-10.25-28.42-26.44ZM470.07,277.98v-4.46l-12.89,1.16c-11.07.99-15.04,3.47-15.04,8.76,0,5.95,3.64,8.76,11.4,8.76,9.75,0,16.53-4.79,16.53-14.21Z" fill="currentColor"/>
      <polygon points="582.48,230.12 530.02,308.99 501.15,308.99 553.61,230.12 582.48,230.12" fill="#AAFF47"/>
      <circle cx="515.62" cy="244.36" r="14.47" fill="#AAFF47"/>
      <circle cx="568.01" cy="293.67" r="14.47" fill="#AAFF47"/>
      <path d="M629.26,223.62c25.68,0,44.42,17.12,44.42,42.64s-18.74,42.48-44.42,42.48-44.58-16.96-44.58-42.48,18.74-42.64,44.58-42.64ZM629.26,286.45c11.47,0,19.38-8.08,19.38-20.35s-7.91-20.19-19.38-20.19-19.54,8.08-19.54,20.19,7.91,20.35,19.54,20.35Z" fill="currentColor"/>
    </svg>
  )
}

function PercentWatermark() {
  return (
    <svg viewBox="492 221 90 88" width="160" height="160"
      className="absolute -top-10 -right-12 opacity-[0.07] pointer-events-none"
      xmlns="http://www.w3.org/2000/svg">
      <polygon points="582.48,230.12 530.02,308.99 501.15,308.99 553.61,230.12 582.48,230.12" fill="#fff"/>
      <circle cx="515.62" cy="244.36" r="14.47" fill="#fff"/>
      <circle cx="568.01" cy="293.67" r="14.47" fill="#fff"/>
    </svg>
  )
}

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
      localStorage.setItem('pending_invite', userId ?? '')
      navigate('/auth')
      return
    }
    if (!userId) return
    await sendRequest.mutateAsync(userId)
    setSent(true)
  }

  useEffect(() => {
    if (!user) return
    const pending = localStorage.getItem('pending_invite')
    if (pending && pending !== user.id) {
      localStorage.removeItem('pending_invite')
      sendRequest.mutate(pending)
    }
  }, [user])

  // Wrapper azul com logo — usado em todos os estados desta página
  const BrandHeader = () => (
    <div className="relative bg-primary px-6 pt-8 pb-10 rounded-b-[28px] overflow-hidden text-center">
      <PercentWatermark />
      <div className="relative z-10 text-white">
        <RaxoLogo height={32} />
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <BrandHeader />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <BrandHeader />
        <div className="flex items-center justify-center px-6 -mt-4">
          <div className="text-center max-w-sm">
            <p className="text-lg font-semibold mt-6">Convite inválido</p>
            <p className="text-sm text-muted-foreground mt-1">Este link de convite não é válido.</p>
            <Button className="mt-4 bg-[#AAFF47] text-[#0A0A0A] hover:bg-[#AAFF47]/85 font-bold" onClick={() => navigate('/')}>
              Ir para o app
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (user?.id === userId) {
    return (
      <div className="min-h-screen bg-background">
        <BrandHeader />
        <div className="flex items-center justify-center px-6 -mt-4">
          <div className="text-center max-w-sm">
            <p className="text-lg font-semibold mt-6">Este é seu próprio convite!</p>
            <p className="text-sm text-muted-foreground mt-1">Compartilhe com amigos para conectar.</p>
            <Button className="mt-4 bg-[#AAFF47] text-[#0A0A0A] hover:bg-[#AAFF47]/85 font-bold" onClick={() => navigate('/')}>
              Voltar ao app
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <BrandHeader />

      <div className="px-4 -mt-8 relative z-10 max-w-sm mx-auto animate-scale-in">
        <Card className="shadow-lg">
          <CardContent className="pt-7 pb-7 text-center space-y-4">
            <Avatar className="h-20 w-20 mx-auto ring-4 ring-background -mt-14 shadow-md">
              {profile.avatar_url && <AvatarImage src={profile.avatar_url} />}
              <AvatarFallback className="text-2xl bg-[#AAFF47] text-[#0A0A0A] font-bold">
                {getInitials(profile.display_name)}
              </AvatarFallback>
            </Avatar>

            <div>
              <p className="font-semibold text-lg">{profile.display_name ?? profile.username}</p>
              {profile.username && <p className="text-sm text-muted-foreground">@{profile.username}</p>}
              {profile.bio && <p className="text-sm text-muted-foreground mt-1">{profile.bio}</p>}
            </div>

            <p className="text-sm text-muted-foreground">
              quer se conectar com você no <span className="font-semibold text-foreground">Raxo</span> para dividir despesas e acompanhar gastos juntos.
            </p>

            {sent ? (
              <div className="flex items-center justify-center gap-2 text-[hsl(var(--income))] font-semibold">
                <Check className="h-5 w-5" />
                Solicitação enviada!
              </div>
            ) : (
              <Button
                className="w-full bg-[#AAFF47] text-[#0A0A0A] hover:bg-[#AAFF47]/85 font-bold"
                onClick={handleAccept}
                disabled={sendRequest.isPending}
              >
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

        <p className="text-center text-xs text-muted-foreground mt-4 pb-8">
          Divida gastos. Não amizades.
        </p>
      </div>
    </div>
  )
}