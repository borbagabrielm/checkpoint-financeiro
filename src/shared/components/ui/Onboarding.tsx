import { useState, useRef } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Compass, ArrowRight, Check, Camera, Loader2 } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/shared/components/ui/button'
import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/form-elements'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/display'
import { cn, DEFAULT_CATEGORIES, toISODate, getInitials } from '@/shared/lib/utils'
import { useTransactions } from '@/features/transactions/hooks/useTransactions'
import { useAuth } from '@/shared/hooks/useAuth'
import { useAvatarUpload } from '@/shared/hooks/useAvatarUpload'
import { supabase } from '@/shared/lib/supabase'
import { queryKeys } from '@/shared/lib/queryKeys'

// ─── Steps ───────────────────────────────────────────────────
const steps = ['Boas-vindas', 'Seu perfil', 'Primeira transação', 'Pronto!'] as const

// ─── Schemas ─────────────────────────────────────────────────
const profileSchema = z.object({
  display_name: z.string().min(2, 'Nome obrigatório'),
  username: z
    .string()
    .min(3, 'Mínimo 3 caracteres')
    .max(20)
    .regex(/^[a-z0-9_]+$/, 'Apenas letras minúsculas, números e _')
    .optional()
    .or(z.literal('')),
})

const txSchema = z.object({
  description: z.string().min(1),
  amount: z.coerce.number().min(0.01, 'Valor obrigatório'),
  type: z.enum(['income', 'expense']),
  category: z.string().min(1),
  payment_method: z.string().nullable(),
  date: z.string(),
  installments: z.number().default(1),
})

interface Props {
  onComplete: () => void
  userId?: string
}

export function Onboarding({ onComplete, userId }: Props) {
  const [step, setStep] = useState(0)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const { add } = useTransactions()
  const { user } = useAuth()
  const { upload, uploading } = useAvatarUpload(userId ?? '')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()

  // ── Profile form ────────────────────────────────────────
  const profileForm = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      display_name: user?.user_metadata?.full_name ?? '',
      username: '',
    },
  })

  // ── Transaction form ─────────────────────────────────────
  const txForm = useForm({
    resolver: zodResolver(txSchema),
    defaultValues: {
      description: '',
      amount: 0,
      type: 'expense' as const,
      category: '',
      payment_method: null,
      date: toISODate(new Date()),
      installments: 1,
    },
  })

  const saveProfile = useMutation({
    mutationFn: async (data: z.infer<typeof profileSchema>) => {
      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: userId!,
          display_name: data.display_name,
          username: data.username || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.profiles.me(userId ?? '') })
      setStep(2)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = await upload(file)
    if (url) {
      setAvatarUrl(url)
      qc.invalidateQueries({ queryKey: queryKeys.profiles.me(userId ?? '') })
    } else {
      toast.error('Erro ao fazer upload da foto')
    }
    e.target.value = ''
  }

  const handleAddTransaction = async (values: z.infer<typeof txSchema>) => {
    try {
      await add.mutateAsync(values)
      setStep(3)
    } catch {
      toast.error('Erro ao adicionar transação')
    }
  }

  const skipOnboarding = () => {
    localStorage.setItem(`onboarding_done_${userId}`, '1')
    onComplete()
  }

  const displayName = profileForm.watch('display_name') || user?.user_metadata?.full_name || user?.email

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-md animate-scale-in my-auto">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((_, i) => (
            <div key={i} className={cn(
              'rounded-full transition-all duration-300',
              i === step ? 'w-6 h-2 bg-primary' : i < step ? 'w-2 h-2 bg-primary/60' : 'w-2 h-2 bg-border'
            )} />
          ))}
        </div>

        <div className="bg-card border rounded-2xl p-8 shadow-lg">

          {/* ── Step 0: Boas-vindas ─────────────────────── */}
          {step === 0 && (
            <div className="text-center space-y-6">
              <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground mx-auto shadow-lg">
                <Compass className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl font-display font-semibold">Bem-vindo ao Checkpoint Financeiro!</h1>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  Vamos configurar sua conta em poucos passos. Primeiro, personalize seu perfil.
                </p>
              </div>
              <div className="space-y-2">
                <Button className="w-full" onClick={() => setStep(1)}>
                  Começar
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <button onClick={skipOnboarding}
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2">
                  Pular por agora
                </button>
              </div>
            </div>
          )}

          {/* ── Step 1: Perfil ──────────────────────────── */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-display font-semibold">Seu perfil</h2>
                <p className="text-sm text-muted-foreground mt-1">Como os seus amigos vão te encontrar.</p>
              </div>

              {/* Avatar */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <Avatar className="h-20 w-20">
                    {avatarUrl
                      ? <AvatarImage src={avatarUrl} />
                      : user?.user_metadata?.avatar_url
                        ? <AvatarImage src={user.user_metadata.avatar_url} />
                        : null
                    }
                    <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                      {getInitials(displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="absolute -bottom-1 -right-1 flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground border-2 border-card hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                </div>
                <p className="text-xs text-muted-foreground">JPG, PNG ou WebP · máx. 2MB</p>
              </div>

              <form onSubmit={profileForm.handleSubmit((d) => saveProfile.mutate(d))} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Nome de exibição</Label>
                  <Input {...profileForm.register('display_name')} placeholder="Seu nome completo" autoFocus />
                  {profileForm.formState.errors.display_name && (
                    <p className="text-xs text-destructive">{profileForm.formState.errors.display_name.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Nome de usuário <span className="text-muted-foreground font-normal text-xs">(opcional)</span></Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                    <Input {...profileForm.register('username')} className="pl-7" placeholder="seu_usuario" />
                  </div>
                  {profileForm.formState.errors.username && (
                    <p className="text-xs text-destructive">{profileForm.formState.errors.username.message}</p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={saveProfile.isPending}>
                  {saveProfile.isPending ? 'Salvando...' : 'Salvar e continuar'}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>

              <button onClick={() => setStep(2)}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-1">
                Pular
              </button>
            </div>
          )}

          {/* ── Step 2: Primeira transação ─────────────── */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-display font-semibold">Adicione sua primeira transação</h2>
                <p className="text-sm text-muted-foreground mt-1">Pode ser uma despesa recente ou uma receita.</p>
              </div>

              <form onSubmit={txForm.handleSubmit(handleAddTransaction)} className="space-y-4">
                <div className="flex rounded-lg border border-border overflow-hidden">
                  {(['expense', 'income'] as const).map((t) => (
                    <Controller key={t} name="type" control={txForm.control}
                      render={({ field }) => (
                        <button type="button" onClick={() => field.onChange(t)}
                          className={cn('flex-1 py-2 text-sm font-medium transition-colors',
                            field.value === t
                              ? t === 'expense' ? 'bg-[hsl(var(--expense))] text-white' : 'bg-[hsl(var(--income))] text-white'
                              : 'bg-background text-muted-foreground hover:bg-secondary'
                          )}>
                          {t === 'expense' ? '↓ Despesa' : '↑ Receita'}
                        </button>
                      )} />
                  ))}
                </div>

                <div className="space-y-1.5">
                  <Label>Descrição</Label>
                  <Input {...txForm.register('description')} placeholder="Ex: Almoço, Salário..." autoFocus />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Valor (R$)</Label>
                    <Input {...txForm.register('amount', { valueAsNumber: true })} type="number" step="0.01" placeholder="0,00" className="font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Categoria</Label>
                    <Controller name="category" control={txForm.control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            {DEFAULT_CATEGORIES.slice(0, 8).map((c) => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )} />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={add.isPending}>
                  {add.isPending ? 'Adicionando...' : 'Adicionar e continuar'}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>

              <button onClick={skipOnboarding}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-1">
                Pular
              </button>
            </div>
          )}

          {/* ── Step 3: Pronto ──────────────────────────── */}
          {step === 3 && (
            <div className="text-center space-y-6">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-[hsl(var(--income)/0.15)] mx-auto">
                <Check className="h-8 w-8 text-[hsl(var(--income))]" />
              </div>
              <div>
                <h2 className="text-2xl font-display font-semibold">Tudo pronto! 🎉</h2>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  Sua conta está configurada. Agora explore o dashboard, convide amigos e divida despesas.
                </p>
              </div>
              <Button className="w-full" onClick={() => {
                localStorage.setItem(`onboarding_done_${userId}`, '1')
                onComplete()
              }}>
                Ir para o Dashboard
              </Button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}