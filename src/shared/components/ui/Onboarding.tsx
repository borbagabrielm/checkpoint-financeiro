import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Compass, ArrowRight, Check } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/form-elements'
import { cn, DEFAULT_CATEGORIES, DEFAULT_DEBIT_METHODS, toISODate } from '@/shared/lib/utils'
import { useTransactions } from '@/features/transactions/hooks/useTransactions'

const steps = ['Boas-vindas', 'Primeira transação', 'Pronto!'] as const

const txSchema = z.object({
  description: z.string().min(1),
  amount: z.coerce.number().positive(),
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
  const { add } = useTransactions()
  const navigate = useNavigate()

  const form = useForm({
    resolver: zodResolver(txSchema),
    defaultValues: {
      description: '',
      amount: undefined,
      type: 'expense' as const,
      category: '',
      payment_method: null,
      date: toISODate(new Date()),
      installments: 1,
    },
  })

  const skipOnboarding = () => {
    localStorage.setItem(`onboarding_done_${userId}`, '1')
    onComplete()
  }

  const handleAddTransaction = async (values: z.infer<typeof txSchema>) => {
    try {
      await add.mutateAsync(values)
      setStep(2)
    } catch {
      toast.error('Erro ao adicionar transação')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
      <div className="w-full max-w-md animate-scale-in">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((_, i) => (
            <div
              key={i}
              className={cn(
                'rounded-full transition-all duration-300',
                i === step ? 'w-6 h-2 bg-primary' : i < step ? 'w-2 h-2 bg-primary/60' : 'w-2 h-2 bg-border'
              )}
            />
          ))}
        </div>

        <div className="bg-card border rounded-2xl p-8 shadow-lg">
          {/* Step 0 — Boas-vindas */}
          {step === 0 && (
            <div className="text-center space-y-6">
              <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground mx-auto shadow-lg">
                <Compass className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl font-display font-semibold">Bem-vindo ao Checkpoint Financeiro!</h1>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  Seu novo app de controle financeiro. Vamos começar adicionando sua primeira transação para você ver como é fácil.
                </p>
              </div>
              <div className="space-y-2">
                <Button className="w-full" onClick={() => setStep(1)}>
                  Começar
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <button
                  onClick={skipOnboarding}
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
                >
                  Pular por agora
                </button>
              </div>
            </div>
          )}

          {/* Step 1 — Primeira transação */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-display font-semibold">Adicione sua primeira transação</h2>
                <p className="text-sm text-muted-foreground mt-1">Pode ser uma despesa recente ou uma receita.</p>
              </div>

              <form onSubmit={form.handleSubmit(handleAddTransaction)} className="space-y-4">
                {/* Tipo */}
                <div className="flex rounded-lg border border-border overflow-hidden">
                  {(['expense', 'income'] as const).map((t) => (
                    <Controller key={t} name="type" control={form.control}
                      render={({ field }) => (
                        <button type="button" onClick={() => field.onChange(t)}
                          className={cn('flex-1 py-2 text-sm font-medium transition-colors',
                            field.value === t
                              ? t === 'expense' ? 'bg-[hsl(var(--expense))] text-white' : 'bg-[hsl(var(--income))] text-white'
                              : 'bg-background text-muted-foreground hover:bg-secondary'
                          )}>
                          {t === 'expense' ? '↓ Despesa' : '↑ Receita'}
                        </button>
                      )}
                    />
                  ))}
                </div>

                <div className="space-y-1.5">
                  <Label>Descrição</Label>
                  <Input {...form.register('description')} placeholder="Ex: Almoço, Salário..." autoFocus />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Valor (R$)</Label>
                    <Input {...form.register('amount', { valueAsNumber: true })} type="number" step="0.01" placeholder="0,00" className="font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Categoria</Label>
                    <Controller name="category" control={form.control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            {DEFAULT_CATEGORIES.slice(0, 8).map((c) => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={add.isPending}>
                  {add.isPending ? 'Adicionando...' : 'Adicionar e continuar'}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>

              <button onClick={skipOnboarding} className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-1">
                Pular
              </button>
            </div>
          )}

          {/* Step 2 — Concluído */}
          {step === 2 && (
            <div className="text-center space-y-6">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-[hsl(var(--income)/0.15)] mx-auto">
                <Check className="h-8 w-8 text-[hsl(var(--income))]" />
              </div>
              <div>
                <h2 className="text-2xl font-display font-semibold">Tudo pronto! 🎉</h2>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  Sua primeira transação foi adicionada. Agora explore o dashboard, convide amigos e divida despesas.
                </p>
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  localStorage.setItem(`onboarding_done_${userId}`, '1')
                  onComplete()
                }}
              >
                Ir para o Dashboard
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}