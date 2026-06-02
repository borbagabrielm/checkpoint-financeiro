import { nanoid } from 'nanoid'
import type { BankId, ImportedTransaction, ParseResult } from '../types'
import { parseInstallments, toYMD, cleanDescription, parseAmount } from './utils'

interface CSVTemplate {
  separator: 'auto' | ',' | ';'
  skipLines: number
  dateCol: number
  descriptionCol: number
  amountCol: number
  detectIncome?: (amount: number, rawAmount: string, cols: string[]) => boolean
  // Linhas a ignorar pelo conteúdo (ex: pagamentos de fatura)
  skipDescriptions?: RegExp[]
}

const TEMPLATES: Record<BankId, CSVTemplate | null> = {
  nubank: {
    // date,title,amount
    // 2024-05-31,"Amazon Marketplace",-150.00
    separator: ',',
    skipLines: 1,
    dateCol: 0,
    descriptionCol: 1,
    amountCol: 2,
    detectIncome: (_, raw) => raw.trim().startsWith('-') ? false : true,
    // No Nubank, valores positivos no CSV = despesa no cartão
    skipDescriptions: [/pagamento efetuado/i, /pagamento da fatura/i, /estorno/i],
  },
  itau: {
    // Itaú e cartões parceiros (Magalu, etc.) exportam:
    // data,lançamento,valor   OU   Data;Lançamento;Débito;Crédito
    // O separador é auto-detectado
    separator: 'auto',
    skipLines: 1,
    dateCol: 0,
    descriptionCol: 1,
    amountCol: 2,
    detectIncome: (amount, raw) => {
      // Valor negativo no CSV = pagamento da fatura (receita/crédito)
      // Valor positivo = compra (despesa)
      return raw.trim().startsWith('-') || amount < 0
    },
    skipDescriptions: [/pagamento efetuado/i, /pagamento recebido/i, /estorno/i],
  },
  bradesco: {
    // Data;Histórico;Descrição;Valor;Saldo
    separator: 'auto',
    skipLines: 2,
    dateCol: 0,
    descriptionCol: 2,
    amountCol: 3,
    detectIncome: (amount) => amount > 0,
    skipDescriptions: [/pagamento/i, /saldo anterior/i],
  },
  santander: null,
  inter: {
    // Data;Descrição;Valor
    separator: 'auto',
    skipLines: 1,
    dateCol: 0,
    descriptionCol: 1,
    amountCol: 2,
    detectIncome: (amount) => amount > 0,
    skipDescriptions: [/pagamento/i],
  },
}

export function parseCSV(content: string, bankId: BankId): ParseResult {
  const warnings: string[] = []
  const transactions: ImportedTransaction[] = []

  const template = TEMPLATES[bankId]
  if (!template) {
    return {
      transactions: [],
      warnings: [`${bankId} não suporta importação por CSV. Use o formato OFX.`],
    }
  }

  const text = content.replace(/\r\n/g, '\n').replace(/^\uFEFF/, '').trim()
  const lines = text.split('\n').filter((l) => l.trim())

  if (!lines.length) {
    return { transactions, warnings: ['Arquivo CSV vazio.'] }
  }

  // Auto-detecta separador analisando o cabeçalho
  const sep = template.separator === 'auto'
    ? detectSeparator(lines[0])
    : template.separator

  const dataLines = lines.slice(template.skipLines)

  if (!dataLines.length) {
    warnings.push('Arquivo CSV sem dados após o cabeçalho.')
    return { transactions, warnings }
  }

  for (const line of dataLines) {
    try {
      const cols = splitCSVLine(line, sep)
      const minCols = Math.max(template.dateCol, template.descriptionCol, template.amountCol) + 1
      if (cols.length < minCols) continue

      const dateRaw = cols[template.dateCol]?.trim() ?? ''
      const descRaw = cols[template.descriptionCol]?.trim().replace(/^"|"$/g, '') ?? ''
      const amtRaw  = cols[template.amountCol]?.trim() ?? ''

      // Tenta coluna alternativa se a principal estiver vazia (padrão Itaú com Débito/Crédito)
      const amtFinal = amtRaw || cols[template.amountCol + 1]?.trim() || ''

      if (!dateRaw || !descRaw || !amtFinal) continue

      const date = toYMD(dateRaw)
      if (!date) { warnings.push(`Data inválida ignorada: "${dateRaw}"`); continue }

      // Ignora linhas de pagamento/estorno conforme template
      if (template.skipDescriptions?.some((re) => re.test(descRaw))) continue

      const amount = parseAmount(amtFinal)
      if (amount === 0) continue

      const isIncome = template.detectIncome
        ? template.detectIncome(parseFloat(amtFinal.replace(',', '.')), amtFinal, cols)
        : amount > 0

      const { current, total, cleanedDesc } = parseInstallments(descRaw)

      // Ignora parcelas que não são a primeira
      if (current !== null && current > 1) continue

      transactions.push({
        id: nanoid(),
        description: cleanDescription(cleanedDesc),
        raw_description: descRaw,
        amount,
        type: isIncome ? 'income' : 'expense',
        date,
        installment_current: current,
        installment_total: total,
        category: '',
        payment_method: '',
        skip: false,
        shared_with: [],
      })
    } catch {
      warnings.push('Uma linha do CSV não pôde ser lida e foi ignorada.')
    }
  }

  if (!transactions.length && !warnings.length) {
    warnings.push('Nenhuma transação válida encontrada. Verifique se o banco correto foi selecionado.')
  }

  return { transactions, warnings }
}

// ─── Helpers ──────────────────────────────────────────────────

function detectSeparator(headerLine: string): ',' | ';' {
  const commas     = (headerLine.match(/,/g) ?? []).length
  const semicolons = (headerLine.match(/;/g) ?? []).length
  return semicolons > commas ? ';' : ','
}

function splitCSVLine(line: string, separator: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === separator && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}