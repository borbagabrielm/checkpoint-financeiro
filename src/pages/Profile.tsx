import { useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Camera, Loader2 } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input, Label, Textarea } from '@/shared/components/ui/form-elements'
import { Card, CardContent } from '@/shared/components/ui/display'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/display'
import { useAuth } from '@/shared/hooks/useAuth'
import { useAvatarUpload } from '@/shared/hooks/useAvatarUpload'
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

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = await upload(file)
    if (url) {
      qc.invalidateQueries({ queryKey: queryKeys.profiles.me(user?.id ?? '') })
      toast.success('Foto atualizada')
    } else {
      toast.error('Erro ao fazer upload da foto')
    }
    // Reset input para permitir reselecionar o mesmo arquivo
    e.target.value = ''
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-lg">
      <div className="page-header">
        <h1 className="page-title">Meu perfil</h1>
        <p className="page-subtitle">Suas informações públicas</p>
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
                onChange={handleAvatarChange}
              />
            </div>
            <div>
              <p className="font-medium">{profile?.display_name ?? 'Usuário'}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                JPG, PNG ou WebP · máx. 2MB
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
    </div>
  )
}