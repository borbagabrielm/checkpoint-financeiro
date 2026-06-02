import type { UseFormRegister, Control, FieldErrors } from 'react-hook-form'
import { Controller } from 'react-hook-form'
import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/form-elements'
import { cn } from '@/shared/lib/utils'
import type { TransactionFormValues } from './TransactionForm'

interface Props {
  register: UseFormRegister<TransactionFormValues>
  control: Control<TransactionFormValues>
  errors: FieldErrors<TransactionFormValues>
  type: 'income' | 'expense'
  categories: string[]
  paymentMethods: string[]
  installmentAmount: string | null
  installments: number
}

export function BasicFields({
  register, control, errors, type, categories, paymentMethods, installmentAmount, installments,
}: Props) {
  return (
    <>
      {/* Type toggle */}
      <div className="flex rounded-lg border border-border overflow-hidden">
        {(['expense', 'income'] as const).map((t) => (
          <Controller key={t} name="type" control={control}
            render={({ field }) => (
              <button type="button"
                onClick={() => field.onChange(t)}
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

      {/* Description */}
      <div className="space-y-1.5">
        <Label>Descrição</Label>
        <Input {...register('description')} placeholder="Ex: Supermercado, Salário..." autoFocus />
        {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
      </div>

      {/* Amount + Installments */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Valor (R$)</Label>
          <Input {...register('amount', { valueAsNumber: true })} type="number" step="0.01" min="0.01" placeholder="0,00" className="font-mono" />
          {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Parcelas</Label>
          <Input {...register('installments', { valueAsNumber: true })} type="number" min="1" max="48" placeholder="1" />
          {installmentAmount && (
            <p className="text-xs text-muted-foreground font-mono">{installments}x de R$ {installmentAmount}</p>
          )}
        </div>
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <Label>Categoria</Label>
        <Controller name="category" control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger><SelectValue placeholder="Selecione uma categoria" /></SelectTrigger>
              <SelectContent>
                {categories.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
              </SelectContent>
            </Select>
          )} />
        {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
      </div>

      {/* Payment + Date */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Pagamento</Label>
          <Controller name="payment_method" control={control}
            render={({ field }) => (
              <Select value={field.value ?? ''} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            )} />
        </div>
        <div className="space-y-1.5">
          <Label>Data</Label>
          <Input {...register('date')} type="date" />
        </div>
      </div>

      {/* Tags */}
      <div className="space-y-1.5">
        <Label>Tags <span className="text-muted-foreground font-normal text-xs">(opcional, separadas por vírgula)</span></Label>
        <Input {...register('tags')} placeholder="Ex: viagem, reembolsável, trabalho" className="text-sm" />
      </div>
    </>
  )
}