import { useRef, useState, useMemo } from 'react'
import { Upload, Check, X, ChevronDown, Users, AlertCircle, Loader2, Search, Tag, History, Trash2, AlertTriangle } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/shared/components/ui/button'
import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/form-elements'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/display'
import { Badge, Skeleton } from '@/shared/components/ui/display'
import { ConfirmDialog } from '@/shared/components/ui/feedback'
import { cn, formatCurrency, formatDate } from '@/shared/lib/utils'
import { useImport } from '../hooks/useImport'
import { useUserPreferences } from '@/shared/hooks/useUserPreferences'
import { useFriends } from '@/features/social/hooks/useFriends'
import { getOtherProfile } from '@/features/social/services/socialService'
import { useAuth } from '@/shared/hooks/useAuth'
import { fetchImportHistory, deleteImportSession } from '../services/importSessionService'
import { BANKS } from '../types'
import type { BankId, ImportedTransaction } from '../types'

export default function ImportPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const {
    step, parseResult, transactions, importing, importedCount, failedItems,
    error, duplicateSession, importName, setImportName,
    toImportCount, skippedCount,
    handleFile, confirmName, updateTransaction, toggleSkip, toggleSkipAll, bulkCategorize,
    confirmImport, reset,
  } = useImport()

  const [selectedBank, setSelectedBank] = useState<BankId | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [reviewSearch, setReviewSearch] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [bulkCategory, setBulkCategory] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const { preferences } = useUserPreferences()

  const historyQuery = useQuery({
    queryKey: ['import-history', user?.id],
    queryFn: () => fetchImportHistory(user!.id),
    enabled: !!user?.id && showHistory,
    staleTime: 30_000,
  })

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedBank) return
    await handleFile(file, selectedBank)
    e.target.value = ''
  }

  const filteredTransactions = useMemo(() => {
    if (!reviewSearch) return transactions
    return transactions.filter((t) =>
      t.description.toLowerCase().includes(reviewSearch.toLowerCase()) ||
      t.raw_description.toLowerCase().includes(reviewSearch.toLowerCase())
    )
  }, [transactions, reviewSearch])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const applyBulkCategory = () => {
    if (!bulkCategory || !selectedIds.size) return
    bulkCategorize([...selectedIds], bulkCategory)
    toast.success(`${selectedIds.size} transações categorizadas como ${bulkCategory}`)
    setSelectedIds(new Set())
    setBulkCategory('')
  }

  // ── Step: selecionar banco ────────────────────────────────
  if (step === 'select') {
    return (
      <div className="space-y-5 animate-fade-in max-w-xl">
        <div className="flex items-center justify-between">
          <div className="page-header">
            <h1 className="page-title">Importar transações</h1>
            <p className="page-subtitle">Importe sua fatura ou extrato bancário</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowHistory((v) => !v)}>
            <History className="h-4 w-4" />
            Histórico
          </Button>
        </div>

        {/* Histórico */}
        {showHistory && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Importações anteriores</CardTitle></CardHeader>
            <CardContent>
              {historyQuery.isLoading ? (
                <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : (historyQuery.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma importação ainda.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {(historyQuery.data ?? []).map((s) => (
                    <li key={s.id} className="flex items-center gap-3 py-2.5">
                      <div className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: BANKS.find(b => b.id === s.bank_id)?.color ?? '#888' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{s.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(s.created_at)} · {s.transaction_count} transações
                          {s.failed_count > 0 && <span className="text-destructive"> · {s.failed_count} falhas</span>}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xs shrink-0">{s.format.toUpperCase()}</Badge>
                      <button onClick={() => setDeleteTarget(s.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="pt-6 space-y-5">
            <div className="space-y-3">
              <Label>Selecione o banco ou cartão</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {BANKS.map((bank) => (
                  <button key={bank.id} onClick={() => setSelectedBank(bank.id)}
                    className={cn('flex items-center gap-2.5 p-3 rounded-lg border-2 transition-all text-left',
                      selectedBank === bank.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40')}>
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: bank.color }} />
                    <span className="text-sm font-medium">{bank.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {selectedBank && (
              <div className="rounded-lg bg-secondary/50 p-3 space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  Formatos aceitos para {BANKS.find(b => b.id === selectedBank)?.name}:
                </p>
                <div className="flex gap-2">
                  {BANKS.find(b => b.id === selectedBank)?.supportsOFX && <Badge variant="secondary">.ofx / .qfx</Badge>}
                  {BANKS.find(b => b.id === selectedBank)?.supportsCSV && <Badge variant="secondary">.csv</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">Parcelas já iniciadas (2ª em diante) são ignoradas automaticamente.</p>
              </div>
            )}

            <input ref={fileInputRef} type="file" accept=".ofx,.qfx,.csv" className="hidden"
              onChange={handleFileChange} disabled={!selectedBank} />
            <button onClick={() => fileInputRef.current?.click()} disabled={!selectedBank}
              className={cn('w-full flex flex-col items-center gap-3 p-8 rounded-xl border-2 border-dashed transition-all',
                selectedBank ? 'border-primary/40 hover:border-primary hover:bg-primary/5 cursor-pointer' : 'border-border opacity-50 cursor-not-allowed')}>
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">Clique para selecionar o arquivo</p>
                <p className="text-xs text-muted-foreground mt-1">OFX, QFX ou CSV</p>
              </div>
            </button>

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />{error}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Como exportar do seu banco</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p><strong className="text-foreground">Nubank:</strong> App → Ajustes → Exportar fatura → CSV ou OFX</p>
            <p><strong className="text-foreground">Itaú:</strong> Internet Banking → Extrato → Exportar → OFX</p>
            <p><strong className="text-foreground">Bradesco:</strong> Internet Banking → Extrato → Salvar como OFX</p>
            <p><strong className="text-foreground">Santander:</strong> Internet Banking → Extrato → Exportar OFX</p>
            <p><strong className="text-foreground">Inter:</strong> App → Extrato → Exportar → CSV ou OFX</p>
          </CardContent>
        </Card>

        <ConfirmDialog
          open={!!deleteTarget}
          title="Excluir registro de importação"
          description="Isso remove apenas o registro do histórico. As transações já importadas não serão afetadas."
          confirmLabel="Excluir" destructive
          onConfirm={async () => {
            if (deleteTarget) {
              await deleteImportSession(deleteTarget)
              qc.invalidateQueries({ queryKey: ['import-history', user?.id] })
              toast.success('Registro removido')
            }
            setDeleteTarget(null)
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      </div>
    )
  }

  // ── Step: nomear importação ───────────────────────────────
  if (step === 'naming') {
    return (
      <div className="space-y-5 animate-fade-in max-w-md">
        <div className="page-header">
          <h1 className="page-title">Nomear importação</h1>
          <p className="page-subtitle">{parseResult?.transactions.length} transações encontradas</p>
        </div>

        {duplicateSession && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 p-3 text-amber-700 dark:text-amber-400 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Arquivo já importado anteriormente</p>
              <p className="text-xs mt-0.5">
                "{duplicateSession.name}" em {formatDate(duplicateSession.date)}.
                Você pode continuar, mas corre o risco de duplicar transações.
              </p>
            </div>
          </div>
        )}

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-1.5">
              <Label>Nome da importação</Label>
              <Input
                value={importName}
                onChange={(e) => setImportName(e.target.value)}
                placeholder="Ex: Nubank — Maio 2026"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && confirmName()}
              />
              <p className="text-xs text-muted-foreground">
                Use um nome que ajude a identificar esta importação no histórico.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={reset}>Cancelar</Button>
              <Button onClick={confirmName} disabled={!importName.trim()}>
                Continuar para revisão
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Step: revisão ─────────────────────────────────────────
  if (step === 'review') {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-start justify-between gap-4">
          <div className="page-header">
            <h1 className="page-title">Revisar importação</h1>
            <p className="page-subtitle">
              {transactions.length} encontradas · {toImportCount} para importar · {skippedCount} ignoradas
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={reset}>Cancelar</Button>
        </div>

        {parseResult?.warnings.map((w, i) => (
          <div key={i} className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 p-3 text-amber-700 dark:text-amber-400 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />{w}
          </div>
        ))}

        {/* Controles */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar transações..." value={reviewSearch}
              onChange={(e) => setReviewSearch(e.target.value)} className="pl-9 h-8 text-sm" />
          </div>
          <Button size="sm" variant="outline" className="h-8" onClick={() => toggleSkipAll(false)}>Selecionar todos</Button>
          <Button size="sm" variant="outline" className="h-8" onClick={() => toggleSkipAll(true)}>Desmarcar todos</Button>
        </div>

        {/* Edição em lote */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/20 p-3">
            <Tag className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-medium text-primary">{selectedIds.size} selecionadas</span>
            <Select value={bulkCategory} onValueChange={setBulkCategory}>
              <SelectTrigger className="h-8 text-xs flex-1 max-w-48">
                <SelectValue placeholder="Categoria para todas" />
              </SelectTrigger>
              <SelectContent>
                {preferences.categories.map((c) => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" className="h-8" onClick={applyBulkCategory} disabled={!bulkCategory}>
              Aplicar
            </Button>
            <button onClick={() => setSelectedIds(new Set())} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="space-y-2">
          {filteredTransactions.map((tx) => (
            <TransactionReviewCard key={tx.id} tx={tx}
              selected={selectedIds.has(tx.id)}
              onToggleSelect={() => toggleSelect(tx.id)}
              onUpdate={(u) => updateTransaction(tx.id, u)}
              onToggleSkip={() => toggleSkip(tx.id)}
            />
          ))}
        </div>

        <div className="sticky bottom-4 flex justify-end">
          <Button size="lg" onClick={confirmImport} disabled={toImportCount === 0} className="shadow-lg">
            <Check className="h-4 w-4" />
            Importar {toImportCount} transaç{toImportCount === 1 ? 'ão' : 'ões'}
          </Button>
        </div>
      </div>
    )
  }

  // ── Step: importando ──────────────────────────────────────
  if (step === 'importing') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 animate-fade-in">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-lg font-display font-semibold">Importando transações...</p>
        <p className="text-muted-foreground text-sm">{importedCount} de {toImportCount} concluídas</p>
        <div className="w-48 h-1.5 bg-secondary rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${toImportCount > 0 ? (importedCount / toImportCount) * 100 : 0}%` }} />
        </div>
      </div>
    )
  }

  // ── Step: concluído ───────────────────────────────────────
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 animate-fade-in">
      <div className={cn('flex items-center justify-center w-16 h-16 rounded-full',
        failedItems.length > 0 ? 'bg-amber-100 dark:bg-amber-900/20' : 'bg-[hsl(var(--income)/0.15)]')}>
        {failedItems.length > 0
          ? <AlertTriangle className="h-8 w-8 text-amber-600" />
          : <Check className="h-8 w-8 text-[hsl(var(--income))]" />}
      </div>
      <div className="text-center">
        <h2 className="text-2xl font-display font-semibold">
          {failedItems.length > 0 ? 'Importação concluída com avisos' : 'Importação concluída!'}
        </h2>
        <p className="text-muted-foreground mt-1">
          {importedCount} transaç{importedCount === 1 ? 'ão importada' : 'ões importadas'} com sucesso.
          {failedItems.length > 0 && ` ${failedItems.length} falharam.`}
        </p>
      </div>

      {failedItems.length > 0 && (
        <div className="w-full max-w-sm rounded-lg bg-amber-50 dark:bg-amber-900/20 p-3 space-y-1.5">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Transações que falharam:</p>
          {failedItems.map((f, i) => (
            <p key={i} className="text-xs text-amber-600 dark:text-amber-500 truncate">• {f.description}</p>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={reset}>Importar outro arquivo</Button>
        <Button onClick={() => window.location.href = '/'}>Ver no Dashboard</Button>
      </div>
    </div>
  )
}

// ─── Card de revisão individual ───────────────────────────────
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
        {/* Checkbox skip */}
        <button onClick={onToggleSkip}
          className={cn('shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
            !tx.skip ? 'bg-primary border-primary' : 'border-border bg-background')}>
          {!tx.skip && <Check className="h-3 w-3 text-white" />}
        </button>

        {/* Checkbox seleção para edição em lote */}
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