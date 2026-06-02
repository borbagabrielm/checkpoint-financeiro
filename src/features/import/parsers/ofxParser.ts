import { nanoid } from 'nanoid'
import type { ImportedTransaction, ParseResult } from '../types'
import { parseInstallments, toYMD, cleanDescription } from './utils'

// OFX é um formato SGML (parecido com XML mas sem fechamento obrigatório).
// Todos os bancos seguem o mesmo padrão para transações:
//   <STMTTRN>
//     <TRNTYPE>DEBIT
//     <DTPOSTED>20240531120000
//     <TRNAMT>-150.00
//     <FITID>123456
//     <MEMO>AMAZON MARKETPLACE 02/06
//   </STMTTRN>

export function parseOFX(content: string): ParseResult {
  const warnings: string[] = []
  const transactions: ImportedTransaction[] = []

  // Normaliza quebras de linha e remove BOM
  const text = content.replace(/\r\n/g, '\n').replace(/^\uFEFF/, '').trim()

  // Extrai blocos de transação
  const blocks: string[] = text.match(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi) ?? []

  if (!blocks.length) {
    // Tenta formato OFX sem tags de fechamento (SGML puro)
    const sgmlBlocks = extractSGMLBlocks(text)
    blocks.push(...sgmlBlocks)
  }

  if (!blocks.length) {
    warnings.push('Nenhuma transação encontrada. Verifique se o arquivo é um OFX válido.')
    return { transactions, warnings }
  }

  for (const block of blocks) {
    try {
      const type    = extractField(block, 'TRNTYPE') ?? 'DEBIT'
      const dateRaw = extractField(block, 'DTPOSTED') ?? extractField(block, 'DTAVAIL') ?? ''
      const amount  = parseFloat(extractField(block, 'TRNAMT') ?? '0')
      const memo    = extractField(block, 'MEMO') ?? extractField(block, 'NAME') ?? ''

      if (!memo || isNaN(amount) || amount === 0) continue

      const date = toYMD(dateRaw)
      if (!date) { warnings.push(`Data inválida ignorada: ${dateRaw}`); continue }

      const { current, total, cleanedDesc } = parseInstallments(memo)

      // Ignora parcelas que não são a primeira (já foram ou serão criadas)
      if (current !== null && current > 1) continue

      const isIncome = type === 'CREDIT' || amount > 0

      transactions.push({
        id: nanoid(),
        description: cleanDescription(cleanedDesc),
        raw_description: memo,
        amount: Math.abs(amount),
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
      warnings.push('Uma transação não pôde ser lida e foi ignorada.')
    }
  }

  return { transactions, warnings }
}

// ─── Helpers ─────────────────────────────────────────────────

function extractField(block: string, field: string): string | null {
  // Tenta tag com fechamento: <MEMO>valor</MEMO>
  const withClose = new RegExp(`<${field}>([^<]+)<\/${field}>`, 'i').exec(block)
  if (withClose) return withClose[1].trim()
  // Tenta SGML sem fechamento: <MEMO>valor\n
  const sgml = new RegExp(`<${field}>([^\n<]+)`, 'i').exec(block)
  if (sgml) return sgml[1].trim()
  return null
}

function extractSGMLBlocks(text: string): string[] {
  // Para OFX SGML, blocos começam com <STMTTRN> e terminam na próxima tag de mesmo nível
  const blocks: string[] = []
  const starts = [...text.matchAll(/<STMTTRN>/gi)]
  for (const match of starts) {
    const start = match.index! + match[0].length
    const end = text.indexOf('<STMTTRN>', start)
    blocks.push(text.slice(start, end === -1 ? undefined : end))
  }
  return blocks
}