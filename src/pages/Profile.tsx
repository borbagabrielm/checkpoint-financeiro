import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient, useQueries } from '@tanstack/react-query'
import { Camera, Loader2, BarChart3, Users, Calendar, Target } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input, Label, Textarea } from '@/shared/components/ui/form-elements'
import { Card, CardContent } from '@/shared/components/ui/display'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/display'
import { useAuth } from '@/shared/hooks/useAuth'
import { useAvatarUpload } from '@/shared/hooks/useAvatarUpload'
import { AvatarCropModal } from '@/shared/components/ui/AvatarCropModal'
import { queryKeys } from '@/shared/lib/queryKeys'
import { getInitials } from '@/shared/lib/utils'
import { supabase } from '@/shared/lib/supabase'

const schema = z.object({
  display_name: z.string().min(2, 'Nome obrigatório'),
  username: z
    .string()
    .min(3, 'Mínimo 3 caracteres')
    .max(20, 'Máximo 20 caracteres')
    .regex(/^[a-z0-9_]+$/, 'Apenas letras minúsculas, números e _')
    .optional()
    .or(z.literal('')),
  bio: z.string().max(160, 'Máximo 160 caracteres').optional(),
})

type FormValues = z.infer<typeof schema>

export default function ProfilePage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { upload, uploading } = useAvatarUpload(user?.id ?? '')
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  const { data: profile, isLoading } = useQuery({
    queryKey: queryKeys.profiles.me(user?.id ?? ''),
    queryFn: async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle()
      return data
    },
    enabled: !!user?.id,
  })

  // Estatísticas do usuário
  const statsQueries = useQueries({
    queries: [
      {
        queryKey: ['profile-stats-transactions', user?.id],
        queryFn: async () => {
          const { count } = await supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('user_id', user!.id)
          return count ?? 0
        },
        enabled: !!user?.id,
      },
      {
        queryKey: ['profile-stats-friends', user?.id],
        queryFn: async () => {
          const { count } = await supabase.from('friendships').select('id', { count: 'exact', head: true }).eq('status', 'accepted').or(`requester_id.eq.${user!.id},addressee_id.eq.${user!.id}`)
          return count ?? 0
        },
        enabled: !!user?.id,
      },
      {
        queryKey: ['profile-stats-goals', user?.id],
        queryFn: async () => {
          const { count } = await supabase.from('financial_goals').select('id', { count: 'exact', head: true }).eq('user_id', user!.id)
          return count ?? 0
        },
        enabled: !!user?.id,
      },
    ],
  })

  const [txCount, friendCount, goalCount] = statsQueries.map((q) => q.data ?? 0)

  // Meses usando o app (desde a criação da conta)
  const monthsActive = user?.created_at
    ? Math.max(1, Math.round((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30)))
    : 1

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      display_name: profile?.display_name ?? user?.user_metadata?.full_name ?? '',
      username: profile?.username ?? '',
      bio: profile?.bio ?? '',
    },
  })

  const update = useMutation({
    mutationFn: async (data: FormValues) => {
      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: user!.id,
          display_name: data.display_name,
          username: data.username || null,
          bio: data.bio || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.profiles.me(user?.id ?? '') })
      toast.success('Perfil atualizado')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // Ao selecionar o arquivo, abre o modal de recorte em vez de subir direto.
  // Isso evita a foto aparecer deformada — o usuário ajusta zoom/posição
  // e só então o canvas gera um quadrado 400x400 já cortado certo.
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem')
      e.target.value = ''
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Imagem deve ter no máximo 8MB')
      e.target.value = ''
      return
    }
    setPendingFile(file)
    e.target.value = '' // permite reselecionar o mesmo arquivo depois
  }

  // Chamado pelo AvatarCropModal já com o blob 400x400 recortado
  const handleCropConfirm = async (croppedBlob: Blob) => {
    setPendingFile(null)
    const url = await upload(croppedBlob)
    if (url) {
      qc.invalidateQueries({ queryKey: queryKeys.profiles.me(user?.id ?? '') })
      toast.success('Foto atualizada')
    } else {
      toast.error('Erro ao fazer upload da foto')
    }
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-lg">
      <div className="page-header">
        <h1 className="page-title">Meu perfil</h1>
        <p className="page-subtitle">Suas informações públicas</p>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { icon: BarChart3, label: 'transações', value: txCount },
          { icon: Users, label: 'amigos', value: friendCount },
          { icon: Calendar, label: 'meses ativo', value: monthsActive },
          { icon: Target, label: 'metas', value: goalCount },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex flex-col items-center gap-1 bg-secondary/40 rounded-xl p-3 text-center">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="text-lg font-bold text-primary leading-none">{value}</span>
            <span className="text-[10px] text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6 space-y-5">
          {/* Avatar com upload */}
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <Avatar className="h-16 w-16">
                <AvatarImage src={profile?.avatar_url ?? undefined} />
                <AvatarFallback className="text-lg bg-primary/10 text-primary">
                  {getInitials(profile?.display_name ?? user?.user_metadata?.full_name)}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground border-2 border-card hover:bg-primary/90 transition-colors disabled:opacity-50"
                title="Alterar foto"
              >
                {uploading
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Camera className="h-3.5 w-3.5" />
                }
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelected}
              />
            </div>
            <div>
              <p className="font-medium">{profile?.display_name ?? 'Usuário'}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                JPG, PNG ou WebP · máx. 5MB
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit((d) => update.mutate(d))} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome de exibição</Label>
              <Input {...register('display_name')} placeholder="Seu nome" />
              {errors.display_name && (
                <p className="text-xs text-destructive">{errors.display_name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Usuário</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                <Input {...register('username')} className="pl-7" placeholder="seu_usuario" />
              </div>
              {errors.username && (
                <p className="text-xs text-destructive">{errors.username.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Bio</Label>
              <Textarea
                {...register('bio')}
                placeholder="Uma breve descrição sobre você..."
                rows={3}
              />
              {errors.bio && (
                <p className="text-xs text-destructive">{errors.bio.message}</p>
              )}
            </div>
            <Button type="submit" disabled={isSubmitting || update.isPending}>
              {update.isPending ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Modal de recorte — abre logo após selecionar a foto */}
      {pendingFile && (
        <AvatarCropModal
          file={pendingFile}
          onConfirm={handleCropConfirm}
          onCancel={() => setPendingFile(null)}
        />
      )}
    </div>
  )
}