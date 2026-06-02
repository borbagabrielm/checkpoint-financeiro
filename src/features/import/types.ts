// ─── Bancos suportados ────────────────────────────────────────
export type BankId = 'nubank' | 'itau' | 'bradesco' | 'santander' | 'inter'

export interface BankConfig {
  id: BankId
  name: string
  color: string
  supportsOFX: boolean
  supportsCSV: boolean
}

export const BANKS: BankConfig[] = [
  { id: 'nubank',    name: 'Nubank',    color: '#820AD1', supportsOFX: true,  supportsCSV: true  },
  { id: 'itau',      name: 'Itaú',      color: '#EC7000', supportsOFX: true,  supportsCSV: true  },
  { id: 'bradesco',  name: 'Bradesco',  color: '#CC0000', supportsOFX: true,  supportsCSV: true  },
  { id: 'santander', name: 'Santander', color: '#EC0000', supportsOFX: true,  supportsCSV: false },
  { id: 'inter',     name: 'Inter',     color: '#FF7A00', supportsOFX: true,  supportsCSV: true  },
]

export type ImportFormat = 'ofx' | 'csv'

// ─── Transação importada (antes da revisão) ───────────────────
export interface ImportedTransaction {
  id: string               // gerado localmente para controle da UI
  description: string
  amount: number           // sempre positivo — tipo define o sinal
  type: 'income' | 'expense'
  date: string             // YYYY-MM-DD
  installment_current: number | null
  installment_total: number | null
  raw_description: string  // original sem tratamento
  // Preenchido pelo usuário na tela de revisão
  category: string
  payment_method: string
  skip: boolean            // usuário marcou para ignorar
  shared_with: { userId: string; displayName: string; amount: string }[]
}

// ─── Resultado do parse ───────────────────────────────────────
export interface ParseResult {
  transactions: ImportedTransaction[]
  warnings: string[]  // avisos não fatais (ex: "2 linhas ignoradas")
}