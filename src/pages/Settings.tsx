import { useState } from 'react'
import {
  Moon, Sun, Monitor, LogOut, Palette, Tag, CreditCard,
  Plus, X, RefreshCw, Trash2, ToggleLeft, ToggleRight, DollarSign, AlertTriangle
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useForm, Controller } from 'react-hook-form'
import { Button } from '@/shared/components/ui/button'
import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/form-elements'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/display'
import { Separator, Badge } from '@/shared/components/ui/display'
import { ConfirmDialog } from '@/shared/components/ui/feedback'
import { useAuth } from '@/shared/hooks/useAuth'
import { useTheme } from '@/shared/hooks/useTheme'
import { useUserPreferences } from '@/shared/hooks/useUserPreferences'
import { useBudgets } from '@/features/budgets/hooks/useBudgets'
import { useRecurring } from '@/features/recurring/hooks/useRecurring'
import { cn, formatCurrency, DEFAULT_CATEGORIES } from '@/shared/lib/utils'
import type { RecurringTransaction } from '@/shared/types'

const THEMES = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Escuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
] as const

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const { preferences, save } = useUserPreferences()
  const { budgets, upsert: upsertBudget, remove: removeBudget } = useBudgets()
  const { recurring, create: createRecurring, toggle: toggleRecurring, remove: removeRecurring } = useRecurring()
  const navigate = useNavigate()

  const [signingOut, setSigningOut] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [newDebit, setNewDebit] = useState('')
  const [newCredit, setNewCredit] = useState('')
  const [budgetCategory, setBudgetCategory] = useState('')
  const [budgetAmount, setBudgetAmount] = useState('')
  const [showRecurringForm, setShowRecurringForm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string; type: 'budget' | 'recurring' } | null>(null)

  const recurringForm = useForm<Omit<RecurringTransaction, 'id' | 'user_id' | 'created_at' | 'last_created_at'>>({
    defaultValues: { description: '', amount: 0, type: 'expense', category: '', payment_method: null, day_of_month: 1, active: true },
  })

  const handleSignOut = async () => { setSigningOut(true); await signOut(); navigate('/auth') }

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') { e.preventDefault(); action() }
  }

  const addCategory = () => {
    const t = newCategory.trim()
    if (!t || preferences.categories.includes(t)) return
    save.mutate({ categories: [...preferences.categories, t] }, {
      onSuccess: () => setNewCategory(''),
    })
  }

  const addDebit = () => {
    const t = newDebit.trim()
    if (!t || preferences.debit_payment_methods.includes(t)) return
    save.mutate({ debit_payment_methods: [...preferences.debit_payment_methods, t] }, {
      onSuccess: () => setNewDebit(''),
    })
  }

  const addCredit = () => {
    const t = newCredit.trim()
    if (!t || preferences.credit_payment_methods.includes(t)) return
    save.mutate({ credit_payment_methods: [...preferences.credit_payment_methods, t] }, {
      onSuccess: () => setNewCredit(''),
    })
  }

  const addBudget = () => {
    const amt = parseFloat(budgetAmount.replace(',', '.'))
    if (!budgetCategory || !amt || amt <= 0) return
    upsertBudget.mutate({ category: budgetCategory, amount: amt }, {
      onSuccess: () => { setBudgetCategory(''); setBudgetAmount('') },
    })
  }

  const onCreateRecurring = (data: Omit<RecurringTransaction, 'id' | 'user_id' | 'created_at' | 'last_created_at'>) => {
    createRecurring.mutate(data, {
      onSuccess: () => { setShowRecurringForm(false); recurringForm.reset() },
    })
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    if (deleteTarget.type === 'budget') removeBudget.mutate(deleteTarget.id)
    else removeRecurring.mutate(deleteTarget.id)
    setDeleteTarget(null)
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div className="page-header">
        <h1 className="page-title">Configurações</h1>
        <p className="page-subtitle">Personalize sua experiência</p>
      </div>

      {/* Aparência */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Palette className="h-4 w-4" />Aparência</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map(({ value, label, icon: Icon }) => (
              <button key={value} onClick={() => setTheme(value)}
                className={cn('flex flex-col items-center gap-2 p-3 rounded-lg border transition-all',
                  theme === value ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-secondary text-muted-foreground'
                )}>
                <Icon className="h-5 w-5" />
                <span className="text-xs font-medium">{label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Orçamentos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Orçamentos mensais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {budgets.length > 0 && (
            <ul className="space-y-2">
              {budgets.map((b) => (
                <li key={b.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{b.category}</span>
                    <div className="flex items-center gap-2">
                      <span className={cn('font-mono text-xs', (b.percentage ?? 0) >= 90 ? 'text-destructive' : 'text-muted-foreground')}>
                        {formatCurrency(b.spent ?? 0)} / {formatCurrency(b.amount)}
                      </span>
                      {(b.percentage ?? 0) >= 90 && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                      <button onClick={() => setDeleteTarget({ id: b.id, label: b.category, type: 'budget' })}
                        className="text-muted-foreground hover:text-destructive transition-colors">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all', (b.percentage ?? 0) >= 90 ? 'bg-destructive' : (b.percentage ?? 0) >= 70 ? 'bg-amber-500' : 'bg-[hsl(var(--income))]')}
                      style={{ width: `${b.percentage ?? 0}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Select value={budgetCategory} onValueChange={setBudgetCategory}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                {preferences.categories.map((c) => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input placeholder="Limite (R$)" value={budgetAmount} onChange={(e) => setBudgetAmount(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, addBudget)} className="h-8 text-xs font-mono" />
              <Button size="sm" className="h-8 shrink-0" onClick={addBudget} disabled={!budgetCategory || !budgetAmount}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recorrentes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Transações recorrentes
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => setShowRecurringForm((v) => !v)}>
              <Plus className="h-3.5 w-3.5" />
              Adicionar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {showRecurringForm && (
            <form onSubmit={recurringForm.handleSubmit(onCreateRecurring)}
              className="rounded-lg border border-border p-3 space-y-3 bg-secondary/30">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Descrição</Label>
                  <Input {...recurringForm.register('description')} placeholder="Netflix, Aluguel..." className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Valor (R$)</Label>
                  <Input {...recurringForm.register('amount', { valueAsNumber: true })} type="number" step="0.01" className="h-8 text-xs font-mono" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Tipo</Label>
                  <Controller name="type" control={recurringForm.control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="expense" className="text-xs">Despesa</SelectItem>
                          <SelectItem value="income" className="text-xs">Receita</SelectItem>
                        </SelectContent>
                      </Select>
                    )} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Categoria</Label>
                  <Controller name="category" control={recurringForm.control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger>
                        <SelectContent>
                          {preferences.categories.map((c) => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Dia do mês</Label>
                  <Input {...recurringForm.register('day_of_month', { valueAsNumber: true })}
                    type="number" min="1" max="31" className="h-8 text-xs" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" className="h-8" disabled={createRecurring.isPending}>Salvar</Button>
                <Button type="button" variant="outline" size="sm" className="h-8"
                  onClick={() => { setShowRecurringForm(false); recurringForm.reset() }}>Cancelar</Button>
              </div>
            </form>
          )}

          {recurring.length === 0 && !showRecurringForm ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma transação recorrente. Adicione assinaturas, aluguel, salário...
            </p>
          ) : (
            <ul className="space-y-2">
              {recurring.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-1.5">
                  <div className={cn('w-2 h-2 rounded-full shrink-0', r.type === 'income' ? 'bg-[hsl(var(--income))]' : 'bg-[hsl(var(--expense))]')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.description}</p>
                    <p className="text-xs text-muted-foreground">Dia {r.day_of_month} · {r.category}</p>
                  </div>
                  <span className={cn('font-mono text-sm shrink-0', r.type === 'income' ? 'amount-income' : 'amount-expense')}>
                    {r.type === 'income' ? '+' : '-'} {formatCurrency(r.amount)}
                  </span>
                  <button onClick={() => toggleRecurring.mutate({ id: r.id, active: !r.active })}
                    className={cn('shrink-0 transition-colors', r.active ? 'text-primary' : 'text-muted-foreground')}>
                    {r.active ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                  </button>
                  <button onClick={() => setDeleteTarget({ id: r.id, label: r.description, type: 'recurring' })}
                    className="shrink-0 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Categorias */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Tag className="h-4 w-4" />Categorias</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {preferences.categories.map((cat) => (
              <span key={cat} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary text-sm">
                {cat}
                <button onClick={() => save.mutate({ categories: preferences.categories.filter((c) => c !== cat) })}
                  className="text-muted-foreground hover:text-destructive transition-colors">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input placeholder="Ex: 🎮 Games" value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, addCategory)} className="flex-1" />
            <Button size="sm" onClick={addCategory} disabled={!newCategory.trim()}>
              <Plus className="h-4 w-4" />Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Métodos de pagamento */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="h-4 w-4" />Métodos de pagamento</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-3">
            <Label className="text-muted-foreground">Para despesas</Label>
            <div className="flex flex-wrap gap-2">
              {preferences.debit_payment_methods.map((m) => (
                <span key={m} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary text-sm">
                  {m}
                  <button onClick={() => save.mutate({ debit_payment_methods: preferences.debit_payment_methods.filter((x) => x !== m) })}
                    className="text-muted-foreground hover:text-destructive transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input placeholder="Ex: Nubank" value={newDebit} onChange={(e) => setNewDebit(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, addDebit)} className="flex-1" />
              <Button size="sm" onClick={addDebit} disabled={!newDebit.trim()}>
                <Plus className="h-4 w-4" />Adicionar
              </Button>
            </div>
          </div>
          <Separator />
          <div className="space-y-3">
            <Label className="text-muted-foreground">Para receitas</Label>
            <div className="flex flex-wrap gap-2">
              {preferences.credit_payment_methods.map((m) => (
                <span key={m} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary text-sm">
                  {m}
                  <button onClick={() => save.mutate({ credit_payment_methods: preferences.credit_payment_methods.filter((x) => x !== m) })}
                    className="text-muted-foreground hover:text-destructive transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input placeholder="Ex: Conta Corrente" value={newCredit} onChange={(e) => setNewCredit(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, addCredit)} className="flex-1" />
              <Button size="sm" onClick={addCredit} disabled={!newCredit.trim()}>
                <Plus className="h-4 w-4" />Adicionar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sair */}
      <Card>
        <CardContent className="pt-5">
          <Separator className="mb-4" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{user?.user_metadata?.full_name ?? 'Usuário'}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/5"
              onClick={handleSignOut} disabled={signingOut}>
              <LogOut className="h-4 w-4" />
              {signingOut ? 'Saindo...' : 'Sair'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget?.type === 'budget' ? 'Remover orçamento' : 'Remover recorrente'}
        description={`Tem certeza que deseja remover "${deleteTarget?.label}"?`}
        confirmLabel="Remover" destructive
        onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}