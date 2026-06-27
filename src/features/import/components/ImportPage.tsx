import { useRef, useState } from 'react'
import { Upload, AlertCircle, Loader2, Check, History, Trash2, AlertTriangle, Search } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/shared/components/ui/button'
import { Input, Label } from '@/shared/components/ui/form-elements'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/display'
import { Badge, Skeleton } from '@/shared/components/ui/display'
import { ConfirmDialog } from '@/shared/components/ui/feedback'
import { cn, formatDate } from '@/shared/lib/utils'
import { useImport } from '../hooks/useImport'
import { fetchImportHistory, deleteImportSession } from '../services/importSessionService'
import { useAuth } from '@/shared/hooks/useAuth'
import { ImportReview } from './ImportReview'
import { BANKS } from '../types'
import type { BankId } from '../types'

export default function ImportPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const {
    step, parseResult, transactions, importing, importedCount, failedItems,
    error, duplicateSession, importName, setImportName,
    toImportCount, skippedCount,
    isCategorizingAI, aiCategorized, categorizeWithAIAction,
    handleFile, confirmName, updateTransaction, toggleSkip, toggleSkipAll, bulkCategorize,
    confirmImport, reset,
  } = useImport()

  const [selectedBank, setSelectedBank] = useState<BankId | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [historySearch, setHistorySearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [billingMonth, setBillingMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  const historyQuery = useQuery({
    queryKey: ['import-history', user?.id],
    queryFn: () => fetchImportHistory(user!.id),
    enabled: !!user?.id && showHistory,
    staleTime: 30_000,
  })

  // ── Step: selecionar banco ──────────────────────────────
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
            <CardHeader>
              <CardTitle className="text-sm flex items-center justify-between">
                Importações anteriores
                <span className="text-xs font-normal text-muted-foreground">
                  {(historyQuery.data ?? []).length} no total
                </span>
              </CardTitle>
              <div className="relative mt-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou banco..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>
            </CardHeader>
            <CardContent>
              {historyQuery.isLoading ? (
                <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : (historyQuery.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma importação ainda.</p>
              ) : (() => {
                const filtered = (historyQuery.data ?? []).filter((s) =>
                  !historySearch ||
                  s.name.toLowerCase().includes(historySearch.toLowerCase()) ||
                  s.bank_id.toLowerCase().includes(historySearch.toLowerCase())
                )
                return filtered.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum resultado para "{historySearch}"
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {filtered.map((s) => (
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
                )
              })()}
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
              </div>
            )}

            <input ref={fileInputRef} type="file" accept=".ofx,.qfx,.csv" className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file || !selectedBank) return
                await handleFile(file, selectedBank)
                e.target.value = ''
              }}
              disabled={!selectedBank} />

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

        <ConfirmDialog open={!!deleteTarget} title="Excluir registro"
          description="Remove apenas o registro do histórico. As transações já importadas não são afetadas."
          confirmLabel="Excluir" destructive
          onConfirm={async () => {
            if (deleteTarget) {
              await deleteImportSession(deleteTarget)
              qc.invalidateQueries({ queryKey: ['import-history', user?.id] })
              toast.success('Registro removido')
            }
            setDeleteTarget(null)
          }}
          onCancel={() => setDeleteTarget(null)} />
      </div>
    )
  }

  // ── Step: nomear ────────────────────────────────────────
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
              <p className="text-xs mt-0.5">"{duplicateSession.name}" em {formatDate(duplicateSession.date)}. Você pode continuar, mas pode duplicar transações.</p>
            </div>
          </div>
        )}

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-1.5">
              <Label>Nome da importação</Label>
              <Input value={importName} onChange={(e) => setImportName(e.target.value)}
                placeholder="Ex: Nubank — Maio 2026" autoFocus
                onKeyDown={(e) => e.key === 'Enter' && confirmName()} />
            </div>

            <div className="space-y-1.5">
              <Label>Mês da fatura</Label>
              <Input
                type="month"
                value={billingMonth}
                onChange={(e) => setBillingMonth(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Transações fora deste mês serão movidas para o dia 1 do mês selecionado.
              </p>
            </div>

            {/* Alerta de transações fora do mês */}
            {billingMonth && (() => {
              const outsideCount = (parseResult?.transactions ?? []).filter((t) => {
                return !t.date.startsWith(billingMonth)
              }).length
              return outsideCount > 0 ? (
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 p-3 text-amber-700 dark:text-amber-400 text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">{outsideCount} transaç{outsideCount > 1 ? 'ões estão' : 'ão está'} fora do mês selecionado</p>
                    <p className="text-xs mt-0.5">
                      Serão ajustadas para o dia 1 de {(() => { const [y, m] = billingMonth.split('-'); return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) })()}.
                      Você poderá corrigir individualmente na próxima etapa.
                    </p>
                  </div>
                </div>
              ) : null
            })()}

            <div className="flex gap-2">
              <Button variant="outline" onClick={reset}>Cancelar</Button>
              <Button onClick={() => confirmName(billingMonth)} disabled={!importName.trim()}>Continuar para revisão</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Step: revisão (componente separado) ─────────────────
  if (step === 'review') {
    return (
      <ImportReview
        transactions={transactions}
        parseResult={parseResult}
        toImportCount={toImportCount}
        skippedCount={skippedCount}
        isCategorizingAI={isCategorizingAI}
        aiCategorized={aiCategorized}
        onUpdate={updateTransaction}
        onToggleSkip={toggleSkip}
        onToggleSkipAll={toggleSkipAll}
        onBulkCategorize={bulkCategorize}
        onCategorizeAI={categorizeWithAIAction}
        onConfirm={confirmImport}
        onCancel={reset}
      />
    )
  }

  // ── Step: importando com progresso real ─────────────────
  if (step === 'importing') {
    const pct = toImportCount > 0 ? Math.round((importedCount / toImportCount) * 100) : 0
    const current = transactions.filter((t) => !t.skip)[importedCount]

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 animate-fade-in">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <div className="text-center">
          <p className="text-lg font-display font-semibold">Importando transações...</p>
          {current && (
            <p className="text-sm text-muted-foreground mt-1 truncate max-w-xs">{current.description}</p>
          )}
        </div>
        <div className="w-64 space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{importedCount} de {toImportCount}</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    )
  }

  // ── Step: concluído ─────────────────────────────────────
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
          {failedItems.length > 0 ? 'Importação com avisos' : 'Importação concluída!'}
        </h2>
        <p className="text-muted-foreground mt-1">
          {importedCount} transaç{importedCount === 1 ? 'ão importada' : 'ões importadas'}.
          {failedItems.length > 0 && ` ${failedItems.length} falharam.`}
        </p>
      </div>
      {failedItems.length > 0 && (
        <div className="w-full max-w-sm rounded-lg bg-amber-50 dark:bg-amber-900/20 p-3 space-y-1">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Falhas:</p>
          {failedItems.map((f, i) => <p key={i} className="text-xs text-amber-600 truncate">• {f.description}</p>)}
        </div>
      )}
      <div className="flex gap-3">
        <Button variant="outline" onClick={reset}>Importar outro arquivo</Button>
        <Button onClick={() => window.location.href = '/'}>Ver no Dashboard</Button>
      </div>
    </div>
  )
}