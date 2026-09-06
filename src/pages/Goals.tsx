import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Plus, Target, Trash2, Pencil, Check, X } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/form-elements'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/display'
import { Skeleton } from '@/shared/components/ui/display'
import { ConfirmDialog } from '@/shared/components/ui/feedback'
import { cn, formatCurrency, clampPercentage } from '@/shared/lib/utils'
import { useGoals } from '@/features/goals/hooks/useGoals'
import { useUserPreferences } from '@/shared/hooks/useUserPreferences'
import type { FinancialGoal } from '@/shared/types'
import { EmptyState } from '@/shared/components/ui/EmptyState'

const schema = z.object({
  title: z.string().min(1, 'Nome obrigatório'),
  target_amount: z.coerce.number().positive('Valor obrigatório'),
  current_amount: z.coerce.number().min(0).default(0),
  deadline: z.string().optional(),
  category: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export default function GoalsPage() {
  const { goals, isLoading, create, updateProgress, remove } = useGoals()
  const { preferences } = useUserPreferences()
  const [showForm, setShowForm] = useState(false)
  const [editingProgress, setEditingProgress] = useState<{ id: string; value: string } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FinancialGoal | null>(null)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { current_amount: 0 },
  })

  const onSubmit = async (data: FormValues) => {
    await create.mutateAsync({
      title: data.title,
      target_amount: data.target_amount,
      current_amount: data.current_amount,
      deadline: data.deadline || null,
      category: data.category || null,
    })
    reset()
    setShowForm(false)
  }

  const saveProgress = (goal: FinancialGoal) => {
    if (!editingProgress || editingProgress.id !== goal.id) return
    const amount = parseFloat(editingProgress.value.replace(',', '.')) || 0

    const wasIncomplete = goal.current_amount < goal.target_amount
    const isNowComplete = amount >= goal.target_amount

    updateProgress.mutate({ id: goal.id, amount })
    setEditingProgress(null)

    // Celebra apenas na transição de incompleta -> completa
    if (wasIncomplete && isNowComplete) {
      toast.success(`Meta "${goal.title}" atingida! 🎉`, {
        description: 'Parabéns por chegar lá. Hora de criar a próxima.',
        duration: 5000,
        style: {
          background: '#AAFF47',
          color: '#0A0A0A',
          border: 'none',
          fontWeight: 600,
        },
      })
    }
  }

  // Ordena: incompletas primeiro, depois por prazo
  const sorted = [...goals].sort((a, b) => {
    const aDone = a.current_amount >= a.target_amount
    const bDone = b.current_amount >= b.target_amount
    if (aDone !== bDone) return aDone ? 1 : -1
    if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline)
    if (a.deadline) return -1
    if (b.deadline) return 1
    return 0
  })

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div className="page-header">
          <h1 className="page-title">Metas financeiras</h1>
          <p className="page-subtitle">Acompanhe seus objetivos de economia</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" />
          Nova meta
        </Button>
      </div>

      {/* Formulário de criação */}
      {showForm && (
        <Card className="border-primary/30 bg-primary/5 animate-fade-in">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4" />
              Nova meta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nome da meta</Label>
                <Input {...register('title')} placeholder="Ex: Reserva de emergência, Viagem..." autoFocus />
                {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Valor alvo (R$)</Label>
                  <Input {...register('target_amount')} type="number" step="0.01" placeholder="0,00" className="font-mono" />
                  {errors.target_amount && <p className="text-xs text-destructive">{errors.target_amount.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Já tenho (R$)</Label>
                  <Input {...register('current_amount')} type="number" step="0.01" placeholder="0,00" className="font-mono" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Prazo (opcional)</Label>
                  <Input {...register('deadline')} type="date" />
                </div>
                <div className="space-y-1.5">
                  <Label>Categoria (opcional)</Label>
                  <Select onValueChange={(v) => register('category').onChange({ target: { value: v } })}>
                    <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                    <SelectContent>
                      {preferences.categories.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Salvando...' : 'Criar meta'}
                </Button>
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); reset() }}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Lista de metas */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        </div>
      ) : goals.length === 0 ? (
        <EmptyState
          title="Nenhuma meta ainda"
          description="Crie sua primeira meta e acompanhe seu progresso mês a mês."
          action={
            <Button className="mt-2 bg-[#AAFF47] text-[#0A0A0A] hover:bg-[#AAFF47]/85 font-bold" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" />
              Criar primeira meta
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {sorted.map((goal) => {
            const pct = clampPercentage((goal.current_amount / goal.target_amount) * 100)
            const isDone = goal.current_amount >= goal.target_amount
            const justCompleted = isDone && editingProgress === null && goal.current_amount > 0
            const remaining = goal.target_amount - goal.current_amount
            const isEditing = editingProgress?.id === goal.id

            // Calcula dias restantes para o prazo
            let daysLeft: number | null = null
            let overdue = false
            if (goal.deadline) {
              const diff = new Date(goal.deadline + 'T23:59:59').getTime() - Date.now()
              daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24))
              overdue = daysLeft < 0
            }

            return (
              <Card key={goal.id} className={cn(isDone && 'border-[hsl(var(--income)/0.4)] bg-[hsl(var(--income)/0.04)]')}>
                <CardContent className="pt-5 pb-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={cn('flex items-center justify-center w-9 h-9 rounded-full shrink-0 text-lg',
                        isDone ? 'bg-[hsl(var(--income)/0.15)]' : 'bg-secondary')}>
                        {isDone ? '🎉' : '🎯'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{goal.title}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          {goal.category && (
                            <span className="text-xs text-muted-foreground">{goal.category}</span>
                          )}
                          {goal.deadline && (
                            <span className={cn('text-xs', overdue ? 'text-destructive font-medium' : daysLeft && daysLeft <= 30 ? 'text-amber-500' : 'text-muted-foreground')}>
                              {overdue ? `Prazo vencido há ${Math.abs(daysLeft!)} dias` : `${daysLeft} dia${daysLeft === 1 ? '' : 's'} restantes`}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => setDeleteTarget(goal)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Barra de progresso — visual melhorado */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-baseline">
                      <span className={cn('text-xl font-bold font-mono tracking-tight',
                        isDone ? 'text-[hsl(var(--income))]' : 'text-foreground')}>
                        {formatCurrency(goal.current_amount)}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        de {formatCurrency(goal.target_amount)}
                      </span>
                    </div>
                    {/* Barra grossa com cor semântica */}
                    <div className="h-3 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${pct}%`,
                          background: isDone
                            ? '#22A800'
                            : pct >= 75 ? '#AAFF47'
                            : pct >= 40 ? '#3B3BFF'
                            : '#888',
                        }}
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={cn('text-xs font-bold',
                        isDone ? 'text-[hsl(var(--income))]'
                        : pct >= 75 ? 'text-[hsl(var(--income))]'
                        : 'text-primary')}>
                        {pct.toFixed(0)}%
                      </span>
                      {!isDone && (
                        <span className="text-xs text-muted-foreground">
                          Faltam <span className="font-mono font-medium text-foreground">{formatCurrency(remaining)}</span>
                        </span>
                      )}
                      {isDone && (
                        <span className="text-xs text-[hsl(var(--income))] font-semibold">✓ Meta atingida!</span>
                      )}
                    </div>
                  </div>

                  {/* Depósito manual */}
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <>
                        <div className="relative flex-1">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                          <Input
                            autoFocus
                            type="number"
                            step="0.01"
                            value={editingProgress.value}
                            onChange={(e) => setEditingProgress({ id: goal.id, value: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveProgress(goal)
                              if (e.key === 'Escape') setEditingProgress(null)
                            }}
                            className="h-8 pl-8 text-sm font-mono"
                            placeholder="Novo total acumulado"
                          />
                        </div>
                        <button onClick={() => saveProgress(goal)}
                          className="p-1.5 rounded-md bg-[#AAFF47] text-[#0A0A0A] hover:opacity-85 transition-opacity">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setEditingProgress(null)}
                          className="p-1.5 rounded-md bg-secondary hover:bg-secondary/80 transition-colors">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setEditingProgress({ id: goal.id, value: goal.current_amount.toString() })}
                        className={cn(
                          'flex items-center gap-1.5 text-xs font-medium transition-colors px-3 py-1.5 rounded-lg',
                          isDone
                            ? 'bg-[hsl(var(--income)/0.1)] text-[hsl(var(--income))] hover:bg-[hsl(var(--income)/0.15)]'
                            : 'bg-secondary text-muted-foreground hover:text-foreground'
                        )}
                      >
                        <Pencil className="h-3 w-3" />
                        {isDone ? 'Editar progresso' : 'Registrar depósito'}
                      </button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Remover meta"
        description={`Tem certeza que deseja remover a meta "${deleteTarget?.title}"?`}
        confirmLabel="Remover"
        destructive
        onConfirm={() => { if (deleteTarget) remove.mutate(deleteTarget.id); setDeleteTarget(null) }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}