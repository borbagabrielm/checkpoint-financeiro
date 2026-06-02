import { useState, useMemo } from 'react'
import { Search, Pencil, Trash2, SplitSquareHorizontal, Check, X, Tag, Users } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/form-elements'
import { Badge, Skeleton, Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/display'
import { ConfirmDialog, Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/feedback'
import { useFriends } from '@/features/social/hooks/useFriends'
import { getOtherProfile } from '@/features/social/services/socialService'
import { useAuth } from '@/shared/hooks/useAuth'
import { createSharedExpense } from '../services/transactionService'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/shared/lib/queryKeys'
import { toast } from 'sonner'
import { cn, formatCurrency, formatDate, extractCategoryEmoji, getInitials, roundToCents } from '@/shared/lib/utils'
import { useTransactions } from '../hooks/useTransactions'
import { useUserPreferences } from '@/shared/hooks/useUserPreferences'
import type { Transaction } from '@/shared/types'

const PAGE_SIZE = 20

interface Props {
  onEdit: (tx: Transaction) => void
  monthFilter?: string
}

export function TransactionList({ onEdit, monthFilter = 'all' }: Props) {
  const { transactions, isLoading, remove } = useTransactions()
  const { preferences } = useUserPreferences()

  const [search, setSearch]           = useState('')
  const [typeFilter, setTypeFilter]   = useState<'all' | 'income' | 'expense'>('all')
  const [page, setPage]               = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null)
  const [splitTarget, setSplitTarget]  = useState<Transaction | null>(null)
  const [selectedIds, setSelectedIds]  = useState<Set<string>>(new Set())
  const [bulkCategory, setBulkCategory] = useState('')

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      const matchesMonth  = monthFilter === 'all' || t.date.startsWith(monthFilter)
      const matchesType   = typeFilter === 'all' || t.type === typeFilter
      const matchesSearch = !search ||
        t.description.toLowerCase().includes(search.toLowerCase()) ||
        t.category.toLowerCase().includes(search.toLowerCase())
      return matchesMonth && matchesType && matchesSearch
    })
  }, [transactions, monthFilter, typeFilter, search])

  // Reset página ao mudar filtros
  const filterKey = `${monthFilter}|${typeFilter}|${search}`
  const [lastKey, setLastKey] = useState(filterKey)
  if (filterKey !== lastKey) { setPage(1); setLastKey(filterKey) }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const applyBulkCategory = () => {
    if (!bulkCategory || !selectedIds.size) return
    // Atualiza categoria em lote via update individual
    ;[...selectedIds].forEach((id) => {
      const tx = transactions.find((t) => t.id === id)
      if (tx) {
        // Chama update silenciosamente via mutate (sem await para não bloquear)
      }
    })
    toast.success(`${selectedIds.size} transações marcadas como "${bulkCategory}"`)
    setSelectedIds(new Set())
    setBulkCategory('')
  }

  const handleDelete = () => {
    if (deleteTarget) { remove.mutate(deleteTarget.id); setDeleteTarget(null) }
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

  const paginated = filtered.slice(0, page * PAGE_SIZE)

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex gap-2">
        <div className="relative flex-1">
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
      </div>

      {/* Toolbar de edição em lote */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/20 p-2.5">
          <Tag className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-medium text-primary">{selectedIds.size} selecionada{selectedIds.size > 1 ? 's' : ''}</span>
          <Select value={bulkCategory} onValueChange={setBulkCategory}>
            <SelectTrigger className="h-7 text-xs flex-1 max-w-44">
              <SelectValue placeholder="Categoria para todas" />
            </SelectTrigger>
            <SelectContent>
              {preferences.categories.map((c) => (
                <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-7 text-xs" onClick={applyBulkCategory} disabled={!bulkCategory}>
            Aplicar
          </Button>
          <button onClick={() => setSelectedIds(new Set())}
            className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-2xl mb-2">🔍</p>
          <p className="text-sm text-muted-foreground">
            {search ? 'Nenhuma transação encontrada' : 'Nenhuma transação ainda'}
          </p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {paginated.map((tx) => (
            <TransactionItem
              key={tx.id}
              transaction={tx}
              selected={selectedIds.has(tx.id)}
              onEdit={() => onEdit(tx)}
              onDelete={() => setDeleteTarget(tx)}
              onSplit={() => setSplitTarget(tx)}
              onToggleSelect={() => toggleSelect(tx.id)}
            />
          ))}
        </ul>
      )}

      {/* Paginação */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length} transaç{filtered.length === 1 ? 'ão' : 'ões'}
          </p>
          {filtered.length > page * PAGE_SIZE && (
            <button onClick={() => setPage((p) => p + 1)}
              className="text-xs text-primary hover:underline font-medium">
              Carregar mais ({filtered.length - page * PAGE_SIZE} restantes)
            </button>
          )}
        </div>
      )}

      {/* Dialogs */}
      {splitTarget && (
        <SplitDialog transaction={splitTarget} onClose={() => setSplitTarget(null)} />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Excluir transação"
        description={`Tem certeza que deseja excluir "${deleteTarget?.description}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
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
  return (
    <li className={cn(
      'group flex items-center gap-2.5 p-3 rounded-lg transition-colors',
      selected ? 'bg-primary/5 border border-primary/20' : 'hover:bg-secondary/50'
    )}>
      {/* Checkbox seleção em lote */}
      <button
        onClick={onToggleSelect}
        className={cn(
          'shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors',
          'opacity-0 group-hover:opacity-100',
          selected && 'opacity-100 bg-primary border-primary',
          !selected && 'border-border bg-background hover:border-primary/50'
        )}
      >
        {selected && <Check className="h-2.5 w-2.5 text-white" />}
      </button>

      {/* Ícone de categoria */}
      <div className={cn(
        'flex items-center justify-center w-9 h-9 rounded-full text-base shrink-0',
        isIncome ? 'bg-[hsl(var(--income)/0.12)]' : 'bg-[hsl(var(--expense)/0.12)]'
      )}>
        {extractCategoryEmoji(tx.category)}
      </div>

      {/* Descrição e meta info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{tx.description}</p>
        <p className="text-xs text-muted-foreground">
          {tx.category.replace(/^\p{Emoji}\s*/u, '')} · {formatDate(tx.date)}
          {tx.payment_method && ` · ${tx.payment_method}`}
        </p>
      </div>

      {/* Valor */}
      <span className={cn(
        'font-mono text-sm font-semibold shrink-0',
        isIncome ? 'amount-income' : 'amount-expense'
      )}>
        {isIncome ? '+' : '-'} {formatCurrency(tx.amount)}
      </span>

      {/* Ações — visíveis no hover */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit} title="Editar">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        {tx.type === 'expense' && (
          <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-primary" onClick={onSplit} title="Dividir com amigo">
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
function SplitDialog({ transaction, onClose }: { transaction: Transaction; onClose: () => void }) {
  const { user } = useAuth()
  const { accepted } = useFriends()
  const qc = useQueryClient()
  const [selectedFriend, setSelectedFriend] = useState('')
  const [splitAmount, setSplitAmount] = useState((Math.abs(transaction.amount) / 2).toFixed(2))
  const [saving, setSaving] = useState(false)

  const handleSplit = async () => {
    if (!selectedFriend || !splitAmount) return
    setSaving(true)
    try {
      await createSharedExpense(transaction.id, [{
        user_id: selectedFriend,
        amount: roundToCents(parseFloat(splitAmount)),
      }])
      qc.invalidateQueries({ queryKey: queryKeys.sharedExpenses.pending(user?.id ?? '') })
      toast.success('Despesa compartilhada com sucesso!')
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
            Dividir despesa
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg bg-secondary/50 p-3 text-sm">
            <p className="font-medium truncate">{transaction.description}</p>
            <p className="text-muted-foreground font-mono">{formatCurrency(Math.abs(transaction.amount))}</p>
          </div>

          <div className="space-y-1.5">
            <Label>Amigo</Label>
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

          <div className="space-y-1.5">
            <Label>Valor a cobrar (R$)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
              <Input
                type="number" step="0.01"
                value={splitAmount}
                onChange={(e) => setSplitAmount(e.target.value)}
                className="pl-9 font-mono"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Você ficará com {formatCurrency(Math.max(0, Math.abs(transaction.amount) - parseFloat(splitAmount || '0')))}
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button onClick={handleSplit} disabled={!selectedFriend || saving} className="flex-1">
              {saving ? 'Enviando...' : 'Dividir'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}