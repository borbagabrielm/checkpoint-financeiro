import { useState } from 'react'
import { useTransactions } from '@/features/transactions/hooks/useTransactions'
import { useUserPreferences } from '@/shared/hooks/useUserPreferences'
import { useAuth } from '@/shared/hooks/useAuth'
import { supabase } from '@/shared/lib/supabase'
import { detectFormat, parseFile, parseFileBuffer, readFileAsText, readFileAsTextLatin, readFileAsBuffer } from '../parsers'
import {
  hashFile, checkDuplicate, saveImportSession,
} from '../services/importSessionService'
import type { BankId, ImportFormat, ImportedTransaction, ParseResult } from '../types'
import {
  categorizeWithAI, loadUserMappings, learnFromCorrection,
} from '../services/aiCategorizationService'

type ImportStep = 'select' | 'naming' | 'review' | 'importing' | 'done'

export interface FailedImport {
  description: string
  error: string
  reason?: string
}

export function useImport() {
  const { user } = useAuth()
  const { add } = useTransactions()
  const { preferences } = useUserPreferences()

  const [step, setStep] = useState<ImportStep>('select')
  const [bankId, setBankId] = useState<BankId | null>(null)
  const [format, setFormat] = useState<ImportFormat | null>(null)
  const [importName, setImportName] = useState('')
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [transactions, setTransactions] = useState<ImportedTransaction[]>([])
  const [fileContent, setFileContent] = useState('')
  const [fileHash, setFileHash] = useState('')
  const [importing, setImporting] = useState(false)
  const [importedCount, setImportedCount] = useState(0)
  const [failedItems, setFailedItems] = useState<FailedImport[]>([])
  const [error, setError] = useState<string | null>(null)
  const [duplicateSession, setDuplicateSession] = useState<{ name: string; date: string } | null>(null)
  const [isCategorizingAI, setIsCategorizingAI] = useState(false)
  const [aiCategorized, setAiCategorized] = useState(false)

  // ── Parse do arquivo ──────────────────────────────────────
  const handleFile = async (file: File, selectedBankId: BankId) => {
    setError(null)
    setDuplicateSession(null)

    const detectedFormat = detectFormat(file.name)
    if (!detectedFormat) {
      setError('Formato não suportado. Use arquivos .ofx, .qfx, .csv ou .xlsx')
      return
    }

    try {
      let result: ParseResult
      let content = ''

      if (detectedFormat === 'xlsx') {
        // XLSX é binário — lê como ArrayBuffer e usa parser dedicado
        const buffer = await readFileAsBuffer(file)
        result = parseFileBuffer(buffer, detectedFormat, selectedBankId)
        // Hash simplificado para XLSX (usa nome + tamanho, sem ler como texto)
        content = `${file.name}-${file.size}-${file.lastModified}`
      } else {
        // OFX e CSV são texto
        content = await readFileAsText(file)
        if (content.includes('â€') || content.includes('Ã£')) {
          content = await readFileAsTextLatin(file)
        }
        result = parseFile(content, detectedFormat, selectedBankId)
      }

      // Verificar duplicata
      const hash = await hashFile(content)
      if (user?.id) {
        const existing = await checkDuplicate(user.id, hash)
        if (existing) {
          setDuplicateSession({ name: existing.name, date: existing.created_at })
        }
      }
      if (!result.transactions.length && !result.warnings.length) {
        setError('Nenhuma transação encontrada no arquivo.')
        return
      }

      const bankNames: Record<BankId, string> = {
        nubank: 'Nubank', itau: 'Itaú', bradesco: 'Bradesco',
        santander: 'Santander', inter: 'Inter',
      }

      // Sugerir nome automático: "Nubank — Maio 2026"
      const now = new Date()
      const monthLabel = now.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
      const suggestedName = `${bankNames[selectedBankId]} — ${monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}`

      const txs = result.transactions.map((t) => ({
        ...t,
        payment_method: bankNames[selectedBankId],
        category: preferences.categories[0] ?? '⚠️ Outros',
      }))

      setBankId(selectedBankId)
      setFormat(detectedFormat)
      setParseResult(result)
      setTransactions(txs)
      setFileContent(content)
      setFileHash(hash)
      setImportName(suggestedName)
      setStep('naming')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar arquivo')
    }
  }

  // ── Confirmar nome e ir para revisão ──────────────────────
  const confirmName = (billingMonth?: string) => {
    if (!importName.trim()) return

    // Ajusta transações fora do mês da fatura para dia 1 DO MÊS DA FATURA
    if (billingMonth) {
      // Ajusta para dia 1 do mês da fatura selecionado
      const targetDate = `${billingMonth}-01`
      setTransactions((prev) => prev.map((tx) => {
        if (!tx.date.startsWith(billingMonth)) {
          return { ...tx, date: targetDate }
        }
        return tx
      }))
    }

    setStep('review')
  }

  // ── Categorizar com IA ───────────────────────────────────
  const categorizeWithAIAction = async () => {
    if (!user?.id || !transactions.length) return
    setIsCategorizingAI(true)
    try {
      const userMappings = loadUserMappings(user.id)
      const toCateg = transactions
        .filter((t) => t.type === 'expense' && !t.skip)
        .map((t) => ({ id: t.id, description: t.description }))

      const results = await categorizeWithAI(toCateg, preferences.categories, userMappings)
      const resultMap = new Map(results.map((r) => [r.id, r]))

      setTransactions((prev) => prev.map((t) => {
        const r = resultMap.get(t.id)
        if (r?.category) return { ...t, category: r.category }
        return t
      }))
      setAiCategorized(true)
    } catch (e) {
      console.error('AI categorization failed:', e)
    } finally {
      setIsCategorizingAI(false)
    }
  }

  // ── Atualizar transação na revisão ────────────────────────
  const updateTransaction = (id: string, updates: Partial<ImportedTransaction>) => {
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)))
  }

  const toggleSkip = (id: string) => {
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, skip: !t.skip } : t)))
  }

  const toggleSkipAll = (skip: boolean) => {
    setTransactions((prev) => prev.map((t) => ({ ...t, skip })))
  }

  // ── Categorizar em lote ───────────────────────────────────
  const bulkCategorize = (ids: string[], category: string) => {
    setTransactions((prev) =>
      prev.map((t) => (ids.includes(t.id) ? { ...t, category } : t))
    )
  }

  // ── Importar ──────────────────────────────────────────────
  const confirmImport = async () => {
    const toImport = transactions.filter((t) => !t.skip)
    if (!toImport.length) return

    setImporting(true)
    setStep('importing')
    let count = 0
    const failed: FailedImport[] = []

    for (const tx of toImport) {
      try {
        const installments = tx.installment_total ?? 1
        const totalAmount = tx.amount * installments

        const sharedWith = tx.shared_with.length
          ? tx.shared_with.map((s) => ({
              user_id: s.userId,
              amount: (parseFloat(s.amount) || 0) * installments,
            }))
          : undefined

        // Guard anti-duplicata: verifica se já existe transação idêntica no banco
      // (mesmo user + description + date + amount) — criada em qualquer momento
      // Diferente do SQL de limpeza, aqui não usamos janela de tempo pois
      // estamos impedindo o insert antes de acontecer
      const { count: existingCount } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('description', tx.description)
        .eq('date', tx.date)
        .eq('amount', totalAmount)

      if (existingCount && existingCount > 0) {
        failed.push({
          description: tx.description,
          error: 'Duplicata ignorada — transação já existe no banco',
          reason: 'Duplicata ignorada — transação já existe no banco',
        })
        continue
      }

      await add.mutateAsync({
          description: tx.description,
          amount: totalAmount,
          type: tx.type,
          category: tx.category,
          payment_method: tx.payment_method,
          date: tx.date,
          installments,
          shared_with: sharedWith,
        })
        count++
        setImportedCount(count)
      } catch (err) {
        failed.push({
          description: tx.description,
          error: err instanceof Error ? err.message : 'Erro desconhecido',
        })
      }
    }

    // Aprender com as categorias finais (salva mapeamentos para uso futuro)
    if (user?.id) {
      for (const tx of toImport) {
        if (tx.category) {
          learnFromCorrection(user.id, tx.description, tx.category)
        }
      }
    }

    // Salvar sessão no histórico
    if (user?.id) {
      await saveImportSession({
        userId: user.id,
        name: importName.trim(),
        bankId: bankId!,
        format: format!,
        fileHash,
        transactionCount: count,
        failedCount: failed.length,
      })
    }

    setFailedItems(failed)
    setImporting(false)
    setStep('done')
  }

  const reset = () => {
    setStep('select')
    setBankId(null); setFormat(null); setImportName(''); setParseResult(null)
    setTransactions([]); setFileContent(''); setFileHash('')
    setImporting(false); setImportedCount(0); setFailedItems([])
    setError(null); setDuplicateSession(null)
  }

  const toImportCount = transactions.filter((t) => !t.skip).length
  const skippedCount  = transactions.filter((t) => t.skip).length

  return {
    step, bankId, format, importName, setImportName,
    isCategorizingAI, aiCategorized, categorizeWithAIAction,
    parseResult, transactions, importing, importedCount,
    failedItems, error, duplicateSession,
    toImportCount, skippedCount,
    handleFile, confirmName, updateTransaction,
    toggleSkip, toggleSkipAll, bulkCategorize,
    confirmImport, reset,
  }
}