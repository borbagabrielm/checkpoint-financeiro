import { nanoid } from 'nanoid'
import type { BankId, ImportedTransaction, ParseResult } from '../types'
import { parseInstallments, toYMD, cleanDescription, parseAmount } from './utils'

interface CSVTemplate {
  separator: 'auto' | ',' | ';'
  skipLines: number
  dateCol: number
  descriptionCol: number
  amountCol: number
  typeCol?: number          // Inter: coluna "Tipo" que contém "Parcela N/M"
  detectIncome?: (amount: number, rawAmount: string, cols: string[]) => boolean
  skipDescriptions?: RegExp[]
}

const TEMPLATES: Record<BankId, CSVTemplate | null> = {
  nubank: {
    separator: ',',
    skipLines: 1,
    dateCol: 0,
    descriptionCol: 1,
    amountCol: 2,
    detectIncome: (_, raw) => !raw.trim().startsWith('-'),
    skipDescriptions: [/pagamento efetuado/i, /pagamento da fatura/i, /estorno/i],
  },
  itau: {
    separator: 'auto',
    skipLines: 1,
    dateCol: 0,
    descriptionCol: 1,
    amountCol: 2,
    detectIncome: (amount, raw) => raw.trim().startsWith('-') || amount < 0,
    skipDescriptions: [/pagamento efetuado/i, /pagamento recebido/i, /estorno/i],
  },
  bradesco: {
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
    // "Data","Lançamento","Categoria","Tipo","Valor"
    // "23/05/2026","CLAUDE AI","COMPRAS","Compra à vista","R$ 110,00"
    // "07/03/2026","BOURBON IPIRANGA","SUPERMERCADO","Parcela 3/5","R$ 59,77"
    separator: ',',
    skipLines: 1,
    dateCol: 0,
    descriptionCol: 1,
    amountCol: 4,   // "Valor" está na coluna 4
    typeCol: 3,     // "Tipo" está na coluna 3 — contém info de parcela
    detectIncome: () => false, // fatura do Inter = só despesas
    skipDescriptions: [
      /pagamento efetuado/i,
      /pagamento da fatura/i,
      /pagamento recebido/i,
      /encargos rotativo/i,
      /juros projetados/i,
      /juros de mora/i,
      /iof/i,
      /multa por atraso/i,
      /projecao de mora/i,
      /rotativo saldo/i,
    ],
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

  if (!lines.length) return { transactions, warnings: ['Arquivo CSV vazio.'] }

  const sep = template.separator === 'auto' ? detectSeparator(lines[0]) : template.separator
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

      const dateRaw = cols[template.dateCol]?.trim().replace(/^"|"$/g, '') ?? ''
      const descRaw = cols[template.descriptionCol]?.trim().replace(/^"|"$/g, '') ?? ''
      const amtRaw  = cols[template.amountCol]?.trim().replace(/^"|"$/g, '') ?? ''
      const typeRaw = template.typeCol !== undefined
        ? cols[template.typeCol]?.trim().replace(/^"|"$/g, '') ?? ''
        : ''

      const amtFinal = amtRaw || cols[template.amountCol + 1]?.trim().replace(/^"|"$/g, '') || ''
      if (!dateRaw || !descRaw || !amtFinal) continue

      const date = toYMD(dateRaw)
      if (!date) { warnings.push(`Data inválida ignorada: "${dateRaw}"`); continue }

      if (template.skipDescriptions?.some((re) => re.test(descRaw))) continue

      const amount = parseAmount(amtFinal)
      if (amount === 0) continue

      const isIncome = template.detectIncome
        ? template.detectIncome(parseFloat(amtFinal.replace(',', '.')), amtFinal, cols)
        : amount > 0

      // Para o Inter, as parcelas ficam no campo Tipo: "Parcela 3/5"
      // Para outros bancos, ficam na descrição
      let current: number | null = null
      let total: number | null = null
      let cleanedDesc = descRaw

      if (bankId === 'inter' && typeRaw) {
        const interInstallMatch = /[Pp]arcela\s+(\d+)\/(\d+)/.exec(typeRaw)
        if (interInstallMatch) {
          current = parseInt(interInstallMatch[1])
          total   = parseInt(interInstallMatch[2])
        }
        // Descrição do Inter já vem limpa no campo Lançamento
        cleanedDesc = descRaw
      } else {
        const parsed = parseInstallments(descRaw)
        current = parsed.current
        total   = parsed.total
        cleanedDesc = parsed.cleanedDesc
      }

      // Pula parcelas que não são a primeira (importamos só a 1ª e criamos as demais)
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