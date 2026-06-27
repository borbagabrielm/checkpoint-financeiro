import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { Users, SplitSquareHorizontal } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/feedback'
import { roundToCents } from '@/shared/lib/utils'
import { useTransactions } from '../hooks/useTransactions'
import { useFriends } from '@/features/social/hooks/useFriends'
import { getOtherProfile } from '@/features/social/services/socialService'
import { useUserPreferences } from '@/shared/hooks/useUserPreferences'
import { useAuth } from '@/shared/hooks/useAuth'
import { BasicFields } from './BasicFields'
import { SplitSection } from './SplitSection'
import type { Transaction } from '@/shared/types'

const schema = z.object({
  description: z.string().min(1, 'Descrição obrigatória').max(100),
  amount: z.coerce.number().positive('Valor deve ser maior que zero'),
  type: z.enum(['income', 'expense']),
  category: z.string().min(1, 'Categoria obrigatória'),
  payment_method: z.string().nullable(),
  date: z.string().min(1, 'Data obrigatória'),
  installments: z.coerce.number().int().min(1).max(48),
  tags: z.string().optional(),
})

export type TransactionFormValues = z.infer<typeof schema>

export interface SplitEntry {
  userId: string
  displayName: string
  customAmount: string
}

interface Props {
  editing?: Transaction | null
  onClose: () => void
}

export function TransactionForm({ editing, onClose }: Props) {
  const { user } = useAuth()
  const { add, update } = useTransactions()
  const { accepted } = useFriends()
  const { preferences } = useUserPreferences()

  const [splitType, setSplitType] = useState<'equal' | 'custom'>('equal')
  const [selectedFriends, setSelectedFriends] = useState<SplitEntry[]>([])
  const [splitModalOpen, setSplitModalOpen] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)

  const { register, control, handleSubmit, watch, reset, formState: { errors, isSubmitting } } =
    useForm<TransactionFormValues>({
      resolver: zodResolver(schema),
      defaultValues: {
        description: '', amount: undefined, type: 'expense',
        category: '', payment_method: null,
        date: format(new Date(), 'yyyy-MM-dd'),
        installments: 1, tags: '',
      },
    })

  useEffect(() => {
    if (editing) {
      reset({
        description: editing.description,
        amount: Math.abs(editing.amount),
        type: editing.type,
        category: editing.category,
        payment_method: editing.payment_method,
        date: editing.date,
        installments: 1,
        tags: (editing as Transaction & { tags?: string[] }).tags?.join(', ') ?? '',
      })
      setSelectedFriends([])
    }
  }, [editing, reset])

  const type = watch('type')
  const rawAmount = watch('amount')
  const amount = typeof rawAmount === 'number' && !isNaN(rawAmount) && rawAmount > 0 ? rawAmount : 0
  const installments = watch('installments') || 1
  const paymentMethods = type === 'income' ? preferences.credit_payment_methods : preferences.debit_payment_methods
  const installmentAmount = installments > 1 && amount > 0 ? (amount / installments).toFixed(2) : null

  const toggleFriend = (userId: string, displayName: string) => {
    setSelectedFriends((prev) => {
      const exists = prev.find((f) => f.userId === userId)
      if (exists) return prev.filter((f) => f.userId !== userId)
      return [...prev, { userId, displayName, customAmount: '' }]
    })
  }

  const updateCustomAmount = (userId: string, value: string) => {
    setSelectedFriends((prev) => prev.map((f) => f.userId === userId ? { ...f, customAmount: value } : f))
  }

  const buildSharedWith = (validatedAmount: number) => {
    if (!selectedFriends.length) return undefined
    const totalPeople = selectedFriends.length + 1
    return selectedFriends.map((f) => ({
      user_id: f.userId,
      amount: splitType === 'equal'
        ? roundToCents(validatedAmount / totalPeople)
        : parseFloat(f.customAmount) || 0,
    }))
  }

  const onSubmit = async (values: TransactionFormValues) => {
    const tags = values.tags
      ? values.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : undefined

    const input = {
      description: values.description,
      amount: values.amount,
      type: values.type,
      category: values.category,
      payment_method: values.payment_method,
      date: values.date,
      installments: values.installments,
      shared_with: buildSharedWith(values.amount),
      tags,
    }

    if (editing) {
      await update.mutateAsync({ id: editing.id, input })
    } else {
      await add.mutateAsync(input)
    }
    onClose()
  }

  return (
    <div className="space-y-4">
      <BasicFields
        register={register}
        control={control}
        errors={errors}
        type={type}
        categories={preferences.categories}
        preferences={preferences}
        paymentMethods={paymentMethods}
        installmentAmount={installmentAmount}
        installments={installments}
      />

      {/* Split — botão compacto que abre modal separado */}
      {type === 'expense' && !editing && (
        <>
          {selectedFriends.length > 0 ? (
            <button
              type="button"
              onClick={() => setSplitModalOpen(true)}
              className="w-full flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 hover:bg-primary/10 transition-colors"
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <Users className="h-4 w-4 text-primary" />
                Dividindo com {selectedFriends.length} pessoa{selectedFriends.length > 1 ? 's' : ''}
              </div>
              <span className="text-xs text-primary font-semibold">Editar →</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSplitModalOpen(true)}
              className="w-full flex items-center gap-2 px-4 py-3 rounded-lg border border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors text-sm"
            >
              <Users className="h-4 w-4" />
              Dividir com amigos (opcional)
            </button>
          )}

          <Dialog open={splitModalOpen} onOpenChange={(o) => !o && setSplitModalOpen(false)}>
            <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <SplitSquareHorizontal className="h-4 w-4" />
                  Dividir com amigos
                </DialogTitle>
              </DialogHeader>
              <SplitSection
                accepted={accepted}
                userId={user!.id}
                amount={amount}
                selectedFriends={selectedFriends}
                splitType={splitType}
                onToggleFriend={toggleFriend}
                onUpdateCustomAmount={updateCustomAmount}
                onChangeSplitType={setSplitType}
                getOtherProfile={getOtherProfile}
              />
              <Button className="w-full mt-2" onClick={() => setSplitModalOpen(false)}>
                Confirmar
              </Button>
            </DialogContent>
          </Dialog>
        </>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            const { description, amount } = watch()
            const hasData = description || (amount && amount > 0)
            if (hasData && !editing) setConfirmClose(true)
            else onClose()
          }}
        >
          Cancelar
        </Button>
        <Button onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
          {isSubmitting ? 'Salvando...' : editing ? 'Atualizar' : 'Adicionar'}
        </Button>
      </div>
      {/* Confirmação de saída */}
      {confirmClose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border rounded-xl p-6 max-w-xs mx-4 space-y-4 shadow-xl">
            <p className="text-sm font-semibold">Descartar alterações?</p>
            <p className="text-xs text-muted-foreground">Os dados preenchidos serão perdidos.</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmClose(false)}>
                Continuar
              </Button>
              <Button variant="destructive" className="flex-1" onClick={() => { setConfirmClose(false); onClose() }}>
                Descartar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}