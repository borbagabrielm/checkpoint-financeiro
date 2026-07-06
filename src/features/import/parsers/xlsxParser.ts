// Parser para planilhas XLSX do Itaú (e outros bancos que migrem para esse formato)
// Usa SheetJS (xlsx) que já está disponível no bundle do Vite como import
import { nanoid } from 'nanoid'
import * as XLSX from 'xlsx'
import type { BankId, ImportedTransaction, ParseResult } from '../types'
import { cleanDescription, parseInstallments } from './utils'

interface XLSXTemplate {
  headerRows: number      // linhas a pular antes do cabeçalho de colunas
  dateCol: number         // índice da coluna de data
  descriptionCol: number  // índice da coluna de descrição
  amountCol: number       // índice da coluna de valor
  installmentCol?: number // índice da coluna de parcelamento (opcional)
  skipDescriptions?: RegExp[]
}

const TEMPLATES: Partial<Record<BankId, XLSXTemplate>> = {
  itau: {
    // Estrutura do Itaú XLSX:
    // Col 0: None | Col 1: Data | Col 2: Lançamento | Col 3: Parcelamento |
    // Col 4: Valor | Col 5: None | Col 6: Titularidade | ...
    headerRows: 14,    // 13 linhas de cabeçalho + 1 linha com nomes das colunas
    dateCol: 1,
    descriptionCol: 2,
    amountCol: 4,
    installmentCol: 3,
    skipDescriptions: [
      /multa por atraso/i,
      /juros de financiamento/i,
      /encargos de atraso/i,
      /juros de mora/i,
      /pagto ficha compensacao/i,
      /pagamento efetuado/i,
      /pagamento da fatura/i,
    ],
  },
}

export function parseXLSX(buffer: ArrayBuffer, bankId: BankId): ParseResult {
  const warnings: string[] = []
  const transactions: ImportedTransaction[] = []

  const template = TEMPLATES[bankId]
  if (!template) {
    return {
      transactions: [],
      warnings: [`${bankId} não suporta importação por XLSX ainda.`],
    }
  }

  let wb: XLSX.WorkBook
  try {
    wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  } catch {
    return { transactions: [], warnings: ['Não foi possível ler o arquivo XLSX.'] }
  }

  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return { transactions: [], warnings: ['Planilha vazia ou inválida.'] }

  // raw: true mantém valores originais (datas como número serial ou string)
  // sem conversão automática que pode variar por locale da planilha
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: true,
    defval: null,
  }) as unknown[][]

  const dataRows = rows.slice(template.headerRows)

  for (const row of dataRows) {
    try {
      if (!Array.isArray(row) || row.length < template.amountCol + 1) continue

      const dateRaw   = row[template.dateCol]
      const descRaw   = String(row[template.descriptionCol] ?? '').trim()
      const amtRaw    = row[template.amountCol]
      const installRaw = template.installmentCol != null
        ? String(row[template.installmentCol] ?? '').trim()
        : ''

      if (!dateRaw || !descRaw || amtRaw === null || amtRaw === undefined) continue

      // Processar data — SheetJS pode retornar vários formatos dependendo
      // do locale da planilha e da versão:
      // - "2026-06-24"  (yyyy-mm-dd, quando dateNF funciona)
      // - "24/06/2026"  (dd/mm/yyyy, formato brasileiro do Itaú)
      // - número serial do Excel (ex: 46196)
      let dateStr = ''
      if (typeof dateRaw === 'number') {
        // Serial do Excel: converter para data
        const jsDate = XLSX.SSF.parse_date_code(dateRaw)
        dateStr = `${jsDate.y}-${String(jsDate.m).padStart(2, '0')}-${String(jsDate.d).padStart(2, '0')}`
      } else {
        const s = String(dateRaw).trim()
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
          // Já está em YYYY-MM-DD
          dateStr = s.substring(0, 10)
        } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
          // DD/MM/YYYY → YYYY-MM-DD
          const [d, m, y] = s.split('/')
          dateStr = `${y}-${m}-${d}`
        } else {
          warnings.push(`Data inválida ignorada: "${dateRaw}"`)
          continue
        }
      }

      // Processar valor
      const amount = parseFloat(String(amtRaw).replace(',', '.'))
      if (isNaN(amount) || amount === 0) continue

      // Pular encargos, juros e pagamentos de fatura
      if (template.skipDescriptions?.some((re) => re.test(descRaw))) continue

      // Valores negativos = estornos/cashback — pular
      if (amount < 0) continue

      // Parcelas: no Itaú XLSX ficam na coluna "Parcelamento" como "Parcela 2 de 10"
      let current: number | null = null
      let total: number | null = null
      let cleanedDesc = cleanDescription(descRaw)

      if (installRaw) {
        const match = /[Pp]arcela\s+(\d+)\s+de\s+(\d+)/.exec(installRaw)
        if (match) {
          current = parseInt(match[1])
          total   = parseInt(match[2])
        }
      } else {
        // Fallback: tentar extrair da descrição (outros formatos)
        const parsed = parseInstallments(descRaw)
        current = parsed.current
        total   = parsed.total
        cleanedDesc = parsed.cleanedDesc
      }

      // Pular parcelas que não são a primeira
      if (current !== null && current > 1) continue

      transactions.push({
        id: nanoid(),
        description: cleanedDesc,
        raw_description: descRaw,
        amount,
        type: 'expense',
        date: dateStr,
        installment_current: current,
        installment_total: total,
        category: '',
        payment_method: '',
        skip: false,
        shared_with: [],
      })
    } catch {
      warnings.push('Uma linha da planilha não pôde ser lida e foi ignorada.')
    }
  }

  if (!transactions.length) {
    warnings.push('Nenhuma transação válida encontrada. Verifique se o banco correto foi selecionado.')
  }

  return { transactions, warnings }
}