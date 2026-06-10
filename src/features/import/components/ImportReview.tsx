import { useState, useMemo } from 'react'
import { Check, X, ChevronDown, Users, AlertCircle, Search, Tag, Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/form-elements'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/display'
import { cn, formatCurrency, formatDate, getInitials } from '@/shared/lib/utils'
import { useUserPreferences } from '@/shared/hooks/useUserPreferences'
import { useFriends } from '@/features/social/hooks/useFriends'
import { getOtherProfile } from '@/features/social/services/socialService'
import { useAuth } from '@/shared/hooks/useAuth'
import type { ImportedTransaction, ParseResult } from '../types'

interface Props {
  transactions: ImportedTransaction[]
  parseResult: ParseResult | null
  toImportCount: number
  skippedCount: number
  isCategorizingAI: boolean
  aiCategorized: boolean
  onUpdate: (id: string, u: Partial<ImportedTransaction>) => void
  onToggleSkip: (id: string) => void
  onToggleSkipAll: (skip: boolean) => void
  onBulkCategorize: (ids: string[], category: string) => void
  onCategorizeAI: () => void
  onConfirm: () => void
  onCancel: () => void
}

export function ImportReview({
  transactions, parseResult, toImportCount, skippedCount,
  isCategorizingAI, aiCategorized,
  onUpdate, onToggleSkip, onToggleSkipAll, onBulkCategorize,
  onCategorizeAI, onConfirm, onCancel,
}: Props) {
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkCategory, setBulkCategory] = useState('')
  const { preferences } = useUserPreferences()

  const filtered = useMemo(() => {
    if (!search) return transactions
    return transactions.filter((t) =>
      t.description.toLowerCase().includes(search.toLowerCase())
    )
  }, [transactions, search])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const applyBulk = () => {
    if (!bulkCategory || !selectedIds.size) return
    onBulkCategorize([...selectedIds], bulkCategory)
    setSelectedIds(new Set())
    setBulkCategory('')
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div className="page-header">
          <h1 className="page-title">Revisar importação</h1>
          <p className="page-subtitle">
            {transactions.length} encontradas · {toImportCount} para importar · {skippedCount} ignoradas
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>
      </div>

      {/* Avisos do parser */}
      {parseResult?.warnings.map((w, i) => (
        <div key={i} className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 p-3 text-amber-700 dark:text-amber-400 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />{w}
        </div>
      ))}

      {/* Barra de ações */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-8 text-sm" />
        </div>
        <Button size="sm" variant="outline" className="h-8" onClick={() => onToggleSkipAll(false)}>Selecionar todos</Button>
        <Button size="sm" variant="outline" className="h-8" onClick={() => onToggleSkipAll(true)}>Desmarcar todos</Button>
        {/* Botão de IA */}
        <Button
          size="sm"
          variant={aiCategorized ? 'secondary' : 'outline'}
          className={cn('h-8 gap-1.5', !aiCategorized && 'border-primary/40 text-primary hover:bg-primary/5')}
          onClick={onCategorizeAI}
          disabled={isCategorizingAI}
        >
          {isCategorizingAI
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Categorizando...</>
            : aiCategorized
              ? <><Check className="h-3.5 w-3.5" />IA aplicada</>
              : <><Sparkles className="h-3.5 w-3.5" />Categorizar com IA</>
          }
        </Button>
      </div>

      {/* Edição em lote */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/20 p-2.5">
          <Tag className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-medium text-primary">{selectedIds.size} selecionadas</span>
          <Select value={bulkCategory} onValueChange={setBulkCategory}>
            <SelectTrigger className="h-7 text-xs flex-1 max-w-48"><SelectValue placeholder="Categoria para todas" /></SelectTrigger>
            <SelectContent>
              {preferences.categories.map((c) => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-7 text-xs" onClick={applyBulk} disabled={!bulkCategory}>Aplicar</Button>
          <button onClick={() => setSelectedIds(new Set())} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Lista */}
      <div className="space-y-2">
        {filtered.map((tx) => (
          <TransactionReviewCard
            key={tx.id}
            tx={tx}
            selected={selectedIds.has(tx.id)}
            onToggleSelect={() => toggleSelect(tx.id)}
            onUpdate={(u) => onUpdate(tx.id, u)}
            onToggleSkip={() => onToggleSkip(tx.id)}
          />
        ))}
      </div>

      {/* Confirmar fixo no rodapé */}
      <div className="sticky bottom-4 flex justify-end">
        <Button size="lg" onClick={onConfirm} disabled={toImportCount === 0} className="shadow-lg">
          <Check className="h-4 w-4" />
          Importar {toImportCount} transaç{toImportCount === 1 ? 'ão' : 'ões'}
        </Button>
      </div>
    </div>
  )
}

// ─── Card individual ──────────────────────────────────────────
function TransactionReviewCard({
  tx, selected, onToggleSelect, onUpdate, onToggleSkip,
}: {
  tx: ImportedTransaction
  selected: boolean
  onToggleSelect: () => void
  onUpdate: (u: Partial<ImportedTransaction>) => void
  onToggleSkip: () => void
}) {
  const { user } = useAuth()
  const { preferences } = useUserPreferences()
  const { accepted } = useFriends()
  const [expanded, setExpanded] = useState(false)
  const [showSplit, setShowSplit] = useState(false)

  return (
    <div className={cn('rounded-xl border transition-all', tx.skip ? 'opacity-40 bg-secondary/30' : selected ? 'border-primary/50 bg-primary/5' : 'bg-card')}>
      <div className="flex items-center gap-2 p-3">
        <button onClick={onToggleSkip}
          className={cn('shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
            !tx.skip ? 'bg-primary border-primary' : 'border-border bg-background')}>
          {!tx.skip && <Check className="h-3 w-3 text-white" />}
        </button>

        {!tx.skip && (
          <button onClick={onToggleSelect}
            className={cn('shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors',
              selected ? 'bg-primary/20 border-primary' : 'border-border bg-background hover:border-primary/50')}>
            {selected && <Check className="h-2.5 w-2.5 text-primary" />}
          </button>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{tx.description}</p>
          <p className="text-xs text-muted-foreground">
            {formatDate(tx.date)}
            {tx.category && <span className="ml-1.5 text-foreground/70">{tx.category}</span>}
          </p>
        </div>

        <div className="text-right shrink-0">
          <span className={cn('font-mono text-sm font-semibold', tx.type === 'income' ? 'amount-income' : 'amount-expense')}>
            {tx.type === 'income' ? '+' : '-'} {formatCurrency(tx.amount)}
          </span>
          {tx.installment_total && tx.installment_total > 1 && (
            <p className="text-xs text-muted-foreground">{tx.installment_total}× = {formatCurrency(tx.amount * tx.installment_total)}</p>
          )}
        </div>

        <button onClick={() => setExpanded((v) => !v)} disabled={tx.skip}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
          <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} />
        </button>
      </div>

      {expanded && !tx.skip && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Categoria</Label>
              <Select value={tx.category} onValueChange={(v) => onUpdate({ category: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {preferences.categories.map((c) => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descrição</Label>
              <Input value={tx.description} onChange={(e) => onUpdate({ description: e.target.value })} className="h-8 text-xs" />
            </div>
          </div>

          {tx.type === 'expense' && (
            <div>
              <button type="button" onClick={() => setShowSplit((v) => !v)}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <Users className="h-3.5 w-3.5" />
                {tx.shared_with.length > 0 ? `Dividindo com ${tx.shared_with.length} pessoa(s)` : 'Dividir com amigo'}
                <ChevronDown className={cn('h-3 w-3 transition-transform', showSplit && 'rotate-180')} />
              </button>

              {showSplit && (
                <div className="mt-2 space-y-2 pl-5">
                  {accepted.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Adicione amigos para dividir despesas.</p>
                  ) : accepted.map((friendship) => {
                    const profile = getOtherProfile(friendship, user!.id)
                    if (!profile) return null
                    const existing = tx.shared_with.find((s) => s.userId === profile.user_id)
                    return (
                      <div key={friendship.id} className="flex items-center gap-2">
                        <button type="button"
                          onClick={() => {
                            if (existing) {
                              onUpdate({ shared_with: tx.shared_with.filter((s) => s.userId !== profile.user_id) })
                            } else {
                              onUpdate({ shared_with: [...tx.shared_with, { userId: profile.user_id, displayName: profile.display_name ?? profile.username ?? 'Amigo', amount: (tx.amount / 2).toFixed(2) }] })
                            }
                          }}
                          className={cn('w-4 h-4 rounded border-2 flex items-center justify-center transition-colors shrink-0', existing ? 'bg-primary border-primary' : 'border-border')}>
                          {existing && <Check className="h-2.5 w-2.5 text-white" />}
                        </button>
                        <Avatar className="h-5 w-5">
                          {profile.avatar_url && <AvatarImage src={profile.avatar_url} />}
                          <AvatarFallback className="text-[10px]">{getInitials(profile.display_name)}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs flex-1">{profile.display_name ?? profile.username}</span>
                        {existing && (
                          <div className="relative w-24">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                            <Input type="number" value={existing.amount}
                              onChange={(e) => onUpdate({ shared_with: tx.shared_with.map((s) => s.userId === profile.user_id ? { ...s, amount: e.target.value } : s) })}
                              className="h-7 pl-7 text-xs font-mono" />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}