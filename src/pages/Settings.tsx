import { useState } from 'react'
import {
  Moon, Sun, Monitor, LogOut, Palette, Tag, CreditCard, Bell,
  Plus, X, RefreshCw, Trash2, ToggleLeft, ToggleRight, DollarSign,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { Button } from '@/shared/components/ui/button'
import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/form-elements'
import { Card, CardContent, CardHeader, CardTitle, Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/display'
import { Separator } from '@/shared/components/ui/display'
import { ConfirmDialog } from '@/shared/components/ui/feedback'
import { useAuth } from '@/shared/hooks/useAuth'
import { useTheme } from '@/shared/hooks/useTheme'
import { useUserPreferences } from '@/shared/hooks/useUserPreferences'
import { PushNotificationToggle } from '@/shared/components/ui/PushNotificationToggle'
import { useBudgets } from '@/features/budgets/hooks/useBudgets'
import { useRecurring, useSharedRecurring } from '@/features/recurring/hooks/useRecurring'
import { useFriends } from '@/features/social/hooks/useFriends'
import { getOtherProfile } from '@/features/social/services/socialService'
import { SplitSection } from '@/features/transactions/components/SplitSection'
import type { SplitEntry } from '@/features/transactions/components/TransactionForm'
import { cn, formatCurrency, getInitials, roundToCents, DEFAULT_INCOME_CATEGORIES } from '@/shared/lib/utils'
import type { RecurringTransaction } from '@/shared/types'

const THEMES = [
  { value: 'light',  label: 'Claro',   icon: Sun },
  { value: 'dark',   label: 'Escuro',  icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
] as const

type Tab = 'aparencia' | 'orcamentos' | 'categorias' | 'recorrentes' | 'pagamentos'

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const { preferences, save } = useUserPreferences()
  const { budgets, upsert: upsertBudget, remove: removeBudget } = useBudgets()
  const { recurring, create: createRecurring, activate: activateRecurring, deactivate: deactivateRecurring, remove: removeRecurring } = useRecurring()
  const { sharedRecurring } = useSharedRecurring()
  const { accepted: acceptedFriends } = useFriends()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<Tab>('aparencia')
  const [signingOut, setSigningOut]           = useState(false)
  const [newCategory, setNewCategory]         = useState('')
  const [newIncomeCategory, setNewIncomeCategory] = useState('')
  const [newDebit, setNewDebit]               = useState('')
  const [newCredit, setNewCredit]             = useState('')
  const [budgetCategory, setBudgetCategory]   = useState('')
  const [budgetAmount, setBudgetAmount]       = useState('')
  const [showRecurringForm, setShowRecurringForm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string; label: string; type: 'budget' | 'recurring'
  } | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<{ id: string; label: string } | null>(null)
  const [splitType, setSplitType] = useState<'equal' | 'custom'>('equal')
  const [selectedFriends, setSelectedFriends] = useState<SplitEntry[]>([])

  const recurringForm = useForm<Omit<RecurringTransaction, 'id' | 'user_id' | 'created_at' | 'last_created_at' | 'generated_until'>>({
    defaultValues: { description: '', amount: 0, type: 'expense', category: '', payment_method: null, day_of_month: 1, active: true },
  })
  const recurringAmount = recurringForm.watch('amount') || 0

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

  const buildRecurringShares = (amount: number) => {
    if (!selectedFriends.length) return undefined
    const totalPeople = selectedFriends.length + 1
    return selectedFriends.map((f) => ({
      user_id: f.userId,
      amount: splitType === 'equal'
        ? roundToCents(amount / totalPeople)
        : parseFloat(f.customAmount) || 0,
    }))
  }

  const handleSignOut = async () => { setSigningOut(true); await signOut(); navigate('/auth') }
  const kd = (e: React.KeyboardEvent, fn: () => void) => { if (e.key === 'Enter') { e.preventDefault(); fn() } }

  const addCategory = () => {
    const t = newCategory.trim()
    if (!t || preferences.categories.includes(t)) return
    save.mutate({ categories: [...preferences.categories, t] }, { onSuccess: () => setNewCategory('') })
  }

  const addIncomeCategory = () => {
    const t = newIncomeCategory.trim()
    const current = preferences.income_categories ?? DEFAULT_INCOME_CATEGORIES
    if (!t || current.includes(t)) return
    save.mutate({ income_categories: [...current, t] }, { onSuccess: () => setNewIncomeCategory('') })
  }

  const addDebit = () => {
    const t = newDebit.trim()
    if (!t || preferences.debit_payment_methods.includes(t)) return
    save.mutate({ debit_payment_methods: [...preferences.debit_payment_methods, t] }, { onSuccess: () => setNewDebit('') })
  }

  const addCredit = () => {
    const t = newCredit.trim()
    if (!t || preferences.credit_payment_methods.includes(t)) return
    save.mutate({ credit_payment_methods: [...preferences.credit_payment_methods, t] }, { onSuccess: () => setNewCredit('') })
  }

  const addBudget = () => {
    const amt = parseFloat(budgetAmount.replace(',', '.'))
    if (!budgetCategory || !amt || amt <= 0) return
    upsertBudget.mutate({ category: budgetCategory, amount: amt }, {
      onSuccess: () => { setBudgetCategory(''); setBudgetAmount('') },
    })
  }

  const onCreateRecurring = (data: Omit<RecurringTransaction, 'id' | 'user_id' | 'created_at' | 'last_created_at' | 'generated_until'>) => {
    createRecurring.mutate({ input: data, shares: buildRecurringShares(data.amount) }, {
      onSuccess: () => {
        setShowRecurringForm(false)
        recurringForm.reset()
        setSelectedFriends([])
        setSplitType('equal')
      },
    })
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    if (deleteTarget.type === 'budget') removeBudget.mutate(deleteTarget.id)
    else removeRecurring.mutate(deleteTarget.id)
    setDeleteTarget(null)
  }

  const confirmDeactivate = () => {
    if (!deactivateTarget) return
    deactivateRecurring.mutate(deactivateTarget.id)
    setDeactivateTarget(null)
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'aparencia',   label: 'Aparência' },
    { id: 'orcamentos',  label: 'Orçamentos' },
    { id: 'categorias',  label: 'Categorias' },
    { id: 'recorrentes', label: 'Recorrentes' },
    { id: 'pagamentos',  label: 'Pagamentos' },
  ]

  const incomeCategories = preferences.income_categories ?? DEFAULT_INCOME_CATEGORIES

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div className="page-header">
        <h1 className="page-title">Configurações</h1>
        <p className="page-subtitle">Personalize sua experiência</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-thin pb-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── APARÊNCIA ─────────────────────────────────── */}
      {activeTab === 'aparencia' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-4 w-4" />Aparência
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                {THEMES.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className={cn(
                      'flex flex-col items-center gap-2 p-3 rounded-lg border transition-all',
                      theme === value
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border hover:bg-secondary text-muted-foreground'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-4 w-4" />Notificações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PushNotificationToggle />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <Separator className="mb-4" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{user?.user_metadata?.full_name ?? 'Usuário'}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <Button
                  variant="outline"
                  className="text-destructive border-destructive/30 hover:bg-destructive/5"
                  onClick={handleSignOut}
                  disabled={signingOut}
                >
                  <LogOut className="h-4 w-4" />
                  {signingOut ? 'Saindo...' : 'Sair'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── ORÇAMENTOS ────────────────────────────────── */}
      {activeTab === 'orcamentos' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />Orçamentos mensais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {budgets.length > 0 && (
              <ul className="space-y-2">
                {budgets.map((b) => (
                  <li key={b.id} className="flex items-center gap-3 py-1.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="text-sm font-medium truncate">{b.category}</span>
                        <span className="text-xs font-mono text-muted-foreground">
                          {formatCurrency(b.spent ?? 0)} / {formatCurrency(b.amount)}
                        </span>
                      </div>
                      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all',
                            (b.percentage ?? 0) >= 100 ? 'bg-destructive'
                            : (b.percentage ?? 0) >= 90 ? 'bg-destructive'
                            : (b.percentage ?? 0) >= 70 ? 'bg-[hsl(var(--income-fill))]'
                            : 'bg-primary'
                          )}
                          style={{ width: `${Math.min(100, b.percentage ?? 0)}%` }}
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => setDeleteTarget({ id: b.id, label: b.category, type: 'budget' })}
                      className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2 pt-2 border-t border-border">
              <Select value={budgetCategory} onValueChange={setBudgetCategory}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Categoria" /></SelectTrigger>
                <SelectContent>
                  {preferences.categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Limite (R$)"
                value={budgetAmount}
                onChange={(e) => setBudgetAmount(e.target.value)}
                onKeyDown={(e) => kd(e, addBudget)}
                className="w-32 font-mono"
              />
              <Button size="sm" onClick={addBudget} disabled={!budgetCategory || !budgetAmount}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── CATEGORIAS ────────────────────────────────── */}
      {activeTab === 'categorias' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-4 w-4" />Categorias de despesa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {preferences.categories.map((cat) => (
                  <span key={cat} className="inline-flex items-center gap-1 bg-secondary text-sm px-2.5 py-1 rounded-full">
                    {cat}
                    <button
                      onClick={() => save.mutate({ categories: preferences.categories.filter((c) => c !== cat) })}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Ex: 🎮 Games"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => kd(e, addCategory)}
                  className="flex-1"
                />
                <Button size="sm" onClick={addCategory} disabled={!newCategory.trim()}>
                  <Plus className="h-4 w-4" />Adicionar
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-[hsl(var(--income))]" />Categorias de receita
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {incomeCategories.map((cat: string) => (
                  <span key={cat} className="inline-flex items-center gap-1 bg-[hsl(var(--income-fill)/0.12)] text-[hsl(var(--income))] text-sm px-2.5 py-1 rounded-full">
                    {cat}
                    <button
                      onClick={() => save.mutate({ income_categories: incomeCategories.filter((c: string) => c !== cat) })}
                      className="opacity-60 hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Ex: 💡 Outros rendimentos"
                  value={newIncomeCategory}
                  onChange={(e) => setNewIncomeCategory(e.target.value)}
                  onKeyDown={(e) => kd(e, addIncomeCategory)}
                  className="flex-1"
                />
                <Button size="sm" onClick={addIncomeCategory} disabled={!newIncomeCategory.trim()}>
                  <Plus className="h-4 w-4" />Adicionar
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── RECORRENTES ───────────────────────────────── */}
      {activeTab === 'recorrentes' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />Transações recorrentes
              </span>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowRecurringForm((v) => !v)}>
                <Plus className="h-3 w-3" />Nova
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {showRecurringForm && (
              <form onSubmit={recurringForm.handleSubmit(onCreateRecurring)} className="space-y-3 p-3 bg-secondary/40 rounded-lg">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Descrição</Label>
                    <Input {...recurringForm.register('description', { required: true })} placeholder="Ex: Netflix" className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Valor (R$)</Label>
                    <Input {...recurringForm.register('amount', { valueAsNumber: true, required: true })} type="number" step="0.01" placeholder="0,00" className="h-8 text-xs font-mono" />
                  </div>
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
                            {preferences.categories.map((c) => (
                              <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Dia do mês</Label>
                    <Input {...recurringForm.register('day_of_month', { valueAsNumber: true })} type="number" min="1" max="31" className="h-8 text-xs" />
                  </div>
                </div>

                <SplitSection
                  accepted={acceptedFriends}
                  userId={user!.id}
                  amount={recurringAmount}
                  selectedFriends={selectedFriends}
                  splitType={splitType}
                  onToggleFriend={toggleFriend}
                  onUpdateCustomAmount={updateCustomAmount}
                  onChangeSplitType={setSplitType}
                  getOtherProfile={getOtherProfile}
                />

                <div className="flex gap-2">
                  <Button type="submit" size="sm" className="h-8" disabled={createRecurring.isPending}>Salvar</Button>
                  <Button type="button" variant="outline" size="sm" className="h-8"
                    onClick={() => {
                      setShowRecurringForm(false)
                      recurringForm.reset()
                      setSelectedFriends([])
                      setSplitType('equal')
                    }}>
                    Cancelar
                  </Button>
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
                    <div className={cn('w-2 h-2 rounded-full shrink-0',
                      r.type === 'income' ? 'bg-[hsl(var(--income))]' : 'bg-[hsl(var(--expense))]'
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.description}</p>
                      <p className="text-xs text-muted-foreground">Dia {r.day_of_month} · {r.category}</p>
                    </div>
                    <span className={cn('font-mono text-sm shrink-0',
                      r.type === 'income' ? 'amount-income' : 'amount-expense'
                    )}>
                      {r.type === 'income' ? '+' : '-'} {formatCurrency(r.amount)}
                    </span>
                    <button
                      onClick={() => {
                        if (r.active) setDeactivateTarget({ id: r.id, label: r.description })
                        else activateRecurring.mutate(r.id)
                      }}
                      className={cn('shrink-0 transition-colors', r.active ? 'text-primary' : 'text-muted-foreground')}
                    >
                      {r.active ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                    </button>
                    <button
                      onClick={() => setDeleteTarget({ id: r.id, label: r.description, type: 'recurring' })}
                      className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'recorrentes' && sharedRecurring.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />Compartilhadas comigo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {sharedRecurring.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-1.5">
                  <Avatar className="h-7 w-7 shrink-0">
                    {r.owner_profile?.avatar_url && <AvatarImage src={r.owner_profile.avatar_url} />}
                    <AvatarFallback className="text-xs">{getInitials(r.owner_profile?.display_name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.description}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      Compartilhado por {r.owner_profile?.display_name ?? r.owner_profile?.username ?? 'um amigo'} · Dia {r.day_of_month}
                    </p>
                  </div>
                  <span className="font-mono text-sm shrink-0 amount-expense">
                    - {formatCurrency(r.split_amount)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* ── PAGAMENTOS ────────────────────────────────── */}
      {activeTab === 'pagamentos' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />Métodos de despesa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {preferences.debit_payment_methods.map((m) => (
                  <span key={m} className="inline-flex items-center gap-1 bg-secondary text-sm px-2.5 py-1 rounded-full">
                    {m}
                    <button
                      onClick={() => save.mutate({ debit_payment_methods: preferences.debit_payment_methods.filter((x) => x !== m) })}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input placeholder="Ex: Nubank Débito" value={newDebit}
                  onChange={(e) => setNewDebit(e.target.value)}
                  onKeyDown={(e) => kd(e, addDebit)} className="flex-1" />
                <Button size="sm" onClick={addDebit} disabled={!newDebit.trim()}>
                  <Plus className="h-4 w-4" />Adicionar
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-[hsl(var(--income))]" />Métodos de receita
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {preferences.credit_payment_methods.map((m) => (
                  <span key={m} className="inline-flex items-center gap-1 bg-secondary text-sm px-2.5 py-1 rounded-full">
                    {m}
                    <button
                      onClick={() => save.mutate({ credit_payment_methods: preferences.credit_payment_methods.filter((x) => x !== m) })}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input placeholder="Ex: Conta Corrente" value={newCredit}
                  onChange={(e) => setNewCredit(e.target.value)}
                  onKeyDown={(e) => kd(e, addCredit)} className="flex-1" />
                <Button size="sm" onClick={addCredit} disabled={!newCredit.trim()}>
                  <Plus className="h-4 w-4" />Adicionar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget?.type === 'budget' ? 'Remover orçamento' : 'Remover recorrente'}
        description={
          deleteTarget?.type === 'budget'
            ? `Tem certeza que deseja remover "${deleteTarget?.label}"?`
            : `Isso remove "${deleteTarget?.label}" e apaga os lançamentos futuros (a partir do mês seguinte). O mês atual e os anteriores continuam no histórico.`
        }
        confirmLabel="Remover"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={!!deactivateTarget}
        title="Desativar recorrência"
        description={`Isso mantém o lançamento de "${deactivateTarget?.label}" do mês atual e apaga os lançamentos dos meses seguintes (inclusive os compartilhados com amigos, se houver). Deseja continuar?`}
        confirmLabel="Desativar"
        destructive
        onConfirm={confirmDeactivate}
        onCancel={() => setDeactivateTarget(null)}
      />
    </div>
  )
}