import { useState, useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Search, Pencil, Trash2, SplitSquareHorizontal, Check, X, Tag, Users, Loader2 } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/form-elements'
import { Badge, Skeleton, Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/display'
import { ConfirmDialog, Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/feedback'
import { useFriends } from '@/features/social/hooks/useFriends'
import { getOtherProfile } from '@/features/social/services/socialService'
import { useAuth } from '@/shared/hooks/useAuth'
import { createSharedExpense, updateTransaction } from '../services/transactionService'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/shared/lib/queryKeys'
import { toast } from 'sonner'
import { cn, formatCurrency, formatDate, extractCategoryEmoji, getInitials, roundToCents } from '@/shared/lib/utils'
import { useTransactions } from '../hooks/useTransactions'
import { useUserPreferences } from '@/shared/hooks/useUserPreferences'
import type { Transaction } from '@/shared/types'
import { EmptyState } from '@/shared/components/ui/EmptyState'

const PAGE_SIZE = 20

interface Props {
  onEdit: (tx: Transaction) => void
  monthFilter?: string
}

export function TransactionList({ onEdit, monthFilter = 'all' }: Props) {
  const { user } = useAuth()
  const { transactions, isLoading, remove, update } = useTransactions()
  const { preferences } = useUserPreferences()

  const [search, setSearch]             = useState('')
  const [typeFilter, setTypeFilter]     = useState<'all' | 'income' | 'expense'>('all')
  const [sortBy, setSortBy]             = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>('date_desc')
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null)
  const [splitTarget, setSplitTarget]   = useState<Transaction | null>(null)
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set())
  const [bulkCategory, setBulkCategory] = useState('')
  const [bulkLoading, setBulkLoading]   = useState(false)

  const filtered = useMemo(() => {
    const list = transactions.filter((t) => {
      const matchesMonth  = monthFilter === 'all' || t.date.startsWith(monthFilter)
      const matchesType   = typeFilter === 'all' || t.type === typeFilter
      const matchesSearch = !search ||
        t.description.toLowerCase().includes(search.toLowerCase()) ||
        t.category.toLowerCase().includes(search.toLowerCase())
      return matchesMonth && matchesType && matchesSearch
    })
    return list.sort((a, b) => {
      switch (sortBy) {
        case 'date_asc':    return a.date.localeCompare(b.date)
        case 'amount_desc': return Math.abs(b.amount) - Math.abs(a.amount)
        case 'amount_asc':  return Math.abs(a.amount) - Math.abs(b.amount)
        default:            return b.date.localeCompare(a.date)
      }
    })
  }, [transactions, monthFilter, typeFilter, search, sortBy])

  const selectedExpenses = useMemo(
    () => [...selectedIds].filter((id) => transactions.find((t) => t.id === id)?.type === 'expense'),
    [selectedIds, transactions]
  )

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Bulk: atualizar categoria
  const applyBulkCategory = () => {
    if (!bulkCategory || !selectedIds.size) return
    ;[...selectedIds].forEach((id) => {
      const tx = transactions.find((t) => t.id === id)
      if (tx) update.mutate({ id, input: { ...tx, category: bulkCategory } })
    })
    toast.success(`${selectedIds.size} transaç${selectedIds.size > 1 ? 'ões' : 'ão'} atualizadas`)
    setSelectedIds(new Set())
    setBulkCategory('')
  }

  // Bulk: excluir selecionadas
  const handleBulkDelete = async () => {
    if (!selectedIds.size) return
    setBulkLoading(true)
    const ids = [...selectedIds]
    setSelectedIds(new Set())
    toast(`${ids.length} transaç${ids.length > 1 ? 'ões' : 'ão'} removida${ids.length > 1 ? 's' : ''}`, {
      duration: 4000,
      action: {
        label: 'Desfazer',
        onClick: () => toast.success('Remoção cancelada'),
      },
      onAutoClose: async () => {
        for (const id of ids) remove.mutate(id)
        setBulkLoading(false)
      },
    })
    setBulkLoading(false)
  }

  // Undo individual
  const handleDelete = () => {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteTarget(null)
    toast(`"${target.description}" removida`, {
      duration: 4000,
      action: {
        label: 'Desfazer',
        onClick: () => toast.success('Remoção cancelada'),
      },
      onAutoClose: () => remove.mutate(target.id),
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filtros + Selecionar todos */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar transações..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex rounded-lg border border-border overflow-hidden text-xs">
          {(['all', 'income', 'expense'] as const).map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={cn('px-3 py-2 font-medium transition-colors',
                typeFilter === t ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-secondary')}>
              {t === 'all' ? 'Todos' : t === 'income' ? 'Receitas' : 'Despesas'}
            </button>
          ))}
        </div>
        {/* Ordenação */}
        <div className="flex rounded-lg border border-border overflow-hidden text-xs shrink-0">
          {([
            { value: 'date_desc', label: '↓ Data' },
            { value: 'date_asc',  label: '↑ Data' },
            { value: 'amount_desc', label: '↓ R$' },
            { value: 'amount_asc',  label: '↑ R$' },
          ] as const).map(({ value, label }) => (
            <button key={value} onClick={() => setSortBy(value)}
              className={cn('px-2.5 py-2 font-medium transition-colors border-l border-border first:border-l-0',
                sortBy === value ? 'bg-secondary text-foreground' : 'bg-background text-muted-foreground hover:bg-secondary/50')}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Toolbar de seleção em lote */}
      {selectedIds.size === 0 && filtered.length > 0 && (
        <div className="flex items-center gap-2 px-1">
          <button
            onClick={() => setSelectedIds(new Set(filtered.map((t) => t.id)))}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors group"
          >
            <div className="w-4 h-4 rounded border border-border bg-background group-hover:border-primary group-hover:bg-primary/5 flex items-center justify-center transition-all">
              <Check className="h-2.5 w-2.5 text-transparent group-hover:text-primary transition-colors" />
            </div>
            Selecionar todos ({filtered.length})
          </button>
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => {
                  if (selectedIds.size === filtered.length) setSelectedIds(new Set())
                  else setSelectedIds(new Set(filtered.map((t) => t.id)))
                }}
                className={cn(
                  'w-5 h-5 rounded border-2 flex items-center justify-center transition-all shrink-0',
                  selectedIds.size === filtered.length
                    ? 'bg-primary border-primary'
                    : 'border-primary bg-white dark:bg-transparent'
                )}
              >
                <Check className="h-3 w-3 text-white" />
              </button>
              <span className="text-sm font-semibold text-primary">
                {selectedIds.size} selecionada{selectedIds.size !== 1 ? 's' : ''}
                <span className="font-normal text-primary/60 ml-1">de {filtered.length}</span>
              </span>
            </div>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded hover:bg-secondary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <Select value={bulkCategory} onValueChange={setBulkCategory}>
                <SelectTrigger className="h-8 text-xs flex-1 min-w-28">
                  <SelectValue placeholder="Mudar categoria..." />
                </SelectTrigger>
                <SelectContent>
                  {preferences.categories.map((c) => (
                    <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" className="h-8 text-xs shrink-0" onClick={applyBulkCategory} disabled={!bulkCategory}>
                <Tag className="h-3 w-3" />
                Aplicar
              </Button>
            </div>

            <div className="flex gap-1.5 shrink-0">
              {selectedExpenses.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => {
                    const firstExpense = transactions.find((t) => t.id === selectedExpenses[0])
                    if (firstExpense) setSplitTarget({ ...firstExpense, _bulkIds: selectedExpenses } as any)
                  }}
                >
                  <SplitSquareHorizontal className="h-3 w-3" />
                  Dividir{selectedExpenses.length > 1 ? ` (${selectedExpenses.length})` : ''}
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs hover:text-destructive hover:border-destructive"
                onClick={handleBulkDelete}
                disabled={bulkLoading}
              >
                <Trash2 className="h-3 w-3" />
                Excluir{selectedIds.size > 1 ? ` (${selectedIds.size})` : ''}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Lista virtualizada */}
      {filtered.length === 0 ? (
        <EmptyState
          title={search ? 'Nenhuma transação encontrada' : 'Nenhuma transação ainda'}
          description={search ? `Sem resultados para "${search}"` : 'Adicione sua primeira transação acima'}
        />
      ) : (
        <VirtualList
          items={filtered}
          selectedIds={selectedIds}
          onEdit={onEdit}
          onDelete={(tx) => setDeleteTarget(tx)}
          onSplit={(tx) => setSplitTarget(tx)}
          onToggleSelect={toggleSelect}
        />
      )}

      {/* Split dialog */}
      {splitTarget && (
        <SplitDialog
          transaction={splitTarget}
          bulkIds={(splitTarget as any)._bulkIds as string[] | undefined}
          allTransactions={transactions}
          onClose={() => setSplitTarget(null)}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Excluir transação"
        description={`Tem certeza que deseja excluir "${deleteTarget?.description}"?`}
        confirmLabel="Excluir"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

// ─── Virtual List ────────────────────────────────────────────
function VirtualList({
  items, selectedIds, onEdit, onDelete, onSplit, onToggleSelect,
}: {
  items: import('@/shared/types').Transaction[]
  selectedIds: Set<string>
  onEdit: (tx: import('@/shared/types').Transaction) => void
  onDelete: (tx: import('@/shared/types').Transaction) => void
  onSplit: (tx: import('@/shared/types').Transaction) => void
  onToggleSelect: (id: string) => void
}) {
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 10,
  })

  return (
    <div ref={parentRef} style={{ maxHeight: '600px', overflowY: 'auto' }} className="scrollbar-thin">
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((vItem) => {
          const tx = items[vItem.index]
          return (
            <div
              key={tx.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${vItem.start}px)`,
              }}
            >
              <TransactionItem
                transaction={tx}
                selected={selectedIds.has(tx.id)}
                onEdit={() => onEdit(tx)}
                onDelete={() => onDelete(tx)}
                onSplit={() => onSplit(tx)}
                onToggleSelect={() => onToggleSelect(tx.id)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Mapa de cores por categoria — pastel harmonioso
const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  'Mercado':       { bg: '#DCFCE7', text: '#166534' },
  'Alimentação':   { bg: '#FEF3C7', text: '#92400E' },
  'Transporte':    { bg: '#DBEAFE', text: '#1E40AF' },
  'Moradia':       { bg: '#F3E8FF', text: '#6B21A8' },
  'Saúde':         { bg: '#FFE4E6', text: '#9F1239' },
  'Assinaturas':   { bg: '#E0E7FF', text: '#3730A3' },
  'Roupas':        { bg: '#FCE7F3', text: '#9D174D' },
  'Beleza':        { bg: '#FDF2F8', text: '#BE185D' },
  'Presente':      { bg: '#FEF9C3', text: '#854D0E' },
  'Pets':          { bg: '#ECFDF5', text: '#065F46' },
  'Viagem':        { bg: '#E0F2FE', text: '#0369A1' },
  'Educação':      { bg: '#EFF6FF', text: '#1D4ED8' },
  'Lazer':         { bg: '#FFF7ED', text: '#C2410C' },
  'Serviços':      { bg: '#F1F5F9', text: '#334155' },
  'Salário':       { bg: '#DCFCE7', text: '#15803D' },
  'Freelance':     { bg: '#D1FAE5', text: '#065F46' },
  'Investimentos': { bg: '#ECFDF5', text: '#047857' },
  'Rendimentos':   { bg: '#F0FDF4', text: '#166534' },
  'Bônus':         { bg: '#FEF9C3', text: '#713F12' },
  'Reembolso':     { bg: '#E0F2FE', text: '#075985' },
}

function getCategoryColor(category: string): { bg: string; text: string } {
  const clean = category.replace(/^\p{Emoji}\s*/u, '').trim()
  for (const [key, colors] of Object.entries(CATEGORY_COLORS)) {
    if (clean.toLowerCase().includes(key.toLowerCase())) return colors
  }
  return { bg: '#F1F5F9', text: '#475569' }
}

// ─── Transaction item ─────────────────────────────────────────
function TransactionItem({
  transaction: tx, selected, onEdit, onDelete, onSplit, onToggleSelect,
}: {
  transaction: Transaction
  selected: boolean
  onEdit: () => void
  onDelete: () => void
  onSplit: () => void
  onToggleSelect: () => void
}) {
  const isIncome = tx.type === 'income'
  const catColors = getCategoryColor(tx.category)
  const emoji = extractCategoryEmoji(tx.category)
  const catName = tx.category.replace(/^\p{Emoji}\s*/u, '').trim()

  return (
    <li className={cn(
      'group flex items-center gap-2.5 p-3 rounded-lg transition-colors',
      selected ? 'bg-primary/5 border border-primary/20' : 'hover:bg-secondary/50'
    )}>
      <button
        onClick={onToggleSelect}
        className={cn(
          'shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-all',
          'opacity-0 group-hover:opacity-100',
          selected && 'opacity-100 bg-primary border-primary',
          !selected && 'border-border bg-background'
        )}
      >
        {selected && <Check className="h-2.5 w-2.5 text-white" />}
      </button>

      {/* Ícone com cor da categoria */}
      <div
        className="flex items-center justify-center w-9 h-9 rounded-full text-base shrink-0"
        style={{ background: catColors.bg }}
      >
        {emoji}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{tx.description}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {/* Pill de categoria com cor própria */}
          <span
            className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
            style={{ background: catColors.bg, color: catColors.text }}
          >
            {catName}
          </span>
          <span className="text-xs text-muted-foreground truncate">
            {formatDate(tx.date)}
            {tx.payment_method && ` · ${tx.payment_method}`}
          </span>
        </div>
      </div>

      <span className={cn('font-mono text-sm font-semibold shrink-0', isIncome ? 'amount-income' : 'amount-expense')}>
        {isIncome ? '+' : '-'} {formatCurrency(Math.abs(tx.amount))}
      </span>

      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit} title="Editar">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        {tx.type === 'expense' && (
          <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-primary" onClick={onSplit} title="Dividir">
            <SplitSquareHorizontal className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={onDelete} title="Excluir">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </li>
  )
}

// ─── Split Dialog ─────────────────────────────────────────────
// Funciona tanto para transação individual quanto para lote (bulkIds)
function SplitDialog({
  transaction,
  bulkIds,
  allTransactions,
  onClose,
}: {
  transaction: Transaction
  bulkIds?: string[]
  allTransactions: Transaction[]
  onClose: () => void
}) {
  const { user } = useAuth()
  const { accepted } = useFriends()
  const qc = useQueryClient()
  const [selectedFriend, setSelectedFriend] = useState('')
  const [splitAmount, setSplitAmount] = useState(
    (Math.abs(transaction.amount) / 2).toFixed(2)
  )
  const [saving, setSaving] = useState(false)

  const isBulk = bulkIds && bulkIds.length > 1
  const txsToSplit = isBulk
    ? allTransactions.filter((t) => bulkIds.includes(t.id) && t.type === 'expense')
    : [transaction]

  const totalAmount = txsToSplit.reduce((s, t) => s + Math.abs(t.amount), 0)

  const handleSplit = async () => {
    if (!selectedFriend) return
    setSaving(true)
    try {
      for (const tx of txsToSplit) {
        // Para lote: divide 50/50 cada transação
        // Para individual: usa o valor digitado
        const friendAmount = isBulk
          ? roundToCents(Math.abs(tx.amount) / 2)
          : roundToCents(parseFloat(splitAmount))

        // 1. Criar shared_transaction (notificação para o amigo)
        await createSharedExpense(tx.id, [{
          user_id: selectedFriend,
          amount: friendAmount,
        }])

        // 2. Atualizar o valor da transação original
        //    descontando a parte do amigo do criador
        const newCreatorAmount = roundToCents(Math.abs(tx.amount) - friendAmount)
        await updateTransaction(tx.id, {
          amount: newCreatorAmount,
          type: tx.type,
          description: tx.description,
          category: tx.category,
          payment_method: tx.payment_method,
          date: tx.date,
        }, user!.id)
      }

      qc.invalidateQueries({ queryKey: queryKeys.transactions.all(user?.id ?? '') })
      qc.invalidateQueries({ queryKey: queryKeys.sharedExpenses.pending(user?.id ?? '') })
      qc.invalidateQueries({ queryKey: queryKeys.analytics.monthly(user?.id ?? '') })
      toast.success(isBulk
        ? `${txsToSplit.length} despesas divididas com sucesso!`
        : 'Despesa dividida com sucesso!'
      )
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao compartilhar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SplitSquareHorizontal className="h-4 w-4" />
            {isBulk ? `Dividir ${txsToSplit.length} despesas` : 'Dividir despesa'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Resumo */}
          <div className="rounded-lg bg-secondary/50 p-3 text-sm space-y-1">
            {isBulk ? (
              <>
                <p className="font-medium">{txsToSplit.length} despesas selecionadas</p>
                <p className="text-muted-foreground font-mono">Total: {formatCurrency(totalAmount)}</p>
                <p className="text-xs text-muted-foreground">Cada despesa será dividida 50/50</p>
              </>
            ) : (
              <>
                <p className="font-medium truncate">{transaction.description}</p>
                <p className="text-muted-foreground font-mono">{formatCurrency(Math.abs(transaction.amount))}</p>
              </>
            )}
          </div>

          {/* Amigo */}
          <div className="space-y-1.5">
            <Label>Com quem dividir</Label>
            <Select value={selectedFriend} onValueChange={setSelectedFriend}>
              <SelectTrigger><SelectValue placeholder="Selecione um amigo" /></SelectTrigger>
              <SelectContent>
                {accepted.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum amigo adicionado</div>
                ) : accepted.map((f) => {
                  const profile = getOtherProfile(f, user!.id)
                  if (!profile) return null
                  return (
                    <SelectItem key={f.id} value={profile.user_id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          {profile.avatar_url && <AvatarImage src={profile.avatar_url} />}
                          <AvatarFallback className="text-[10px]">{getInitials(profile.display_name)}</AvatarFallback>
                        </Avatar>
                        {profile.display_name ?? profile.username}
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Valor — só para individual */}
          {!isBulk && (
            <div className="space-y-1.5">
              <Label>Valor a cobrar do amigo (R$)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={Math.abs(transaction.amount) - 0.01}
                  value={splitAmount}
                  onChange={(e) => setSplitAmount(e.target.value)}
                  className="pl-9 font-mono"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Você ficará com {formatCurrency(Math.max(0, Math.abs(transaction.amount) - parseFloat(splitAmount || '0')))}
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button
              onClick={handleSplit}
              disabled={!selectedFriend || saving}
              className="flex-1 bg-[#AAFF47] text-[#0A0A0A] hover:bg-[#AAFF47]/85 font-bold"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Dividir'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}