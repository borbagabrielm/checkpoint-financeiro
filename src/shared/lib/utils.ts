import { format, parseISO, isValid } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// ─── Tailwind helper ──────────────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Currency ─────────────────────────────────────────────────
export function formatCurrency(value: number, currency = 'BRL'): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(Math.abs(value))
}

export function parseCurrencyInput(raw: string): number {
  const cleaned = raw.replace(/[^\d,.-]/g, '').replace(',', '.')
  return parseFloat(cleaned) || 0
}

// ─── Dates ────────────────────────────────────────────────────
export function formatDate(dateStr: string, pattern = 'dd/MM/yyyy'): string {
  try {
    const date = parseISO(dateStr)
    if (!isValid(date)) return dateStr
    return format(date, pattern, { locale: ptBR })
  } catch {
    return dateStr
  }
}

export function formatRelativeDate(dateStr: string): string {
  try {
    const date = parseISO(dateStr)
    if (!isValid(date)) return dateStr
    return format(date, "d 'de' MMMM", { locale: ptBR })
  } catch {
    return dateStr
  }
}

export function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function getCurrentMonthKey(): string {
  return format(new Date(), 'yyyy-MM')
}

export function getMonthLabel(monthKey: string): string {
  try {
    const date = parseISO(`${monthKey}-01`)
    return format(date, 'MMM yyyy', { locale: ptBR })
  } catch {
    return monthKey
  }
}

// Todos os meses (Jan-Dez) do ano informado, ordem cronológica.
export function getYearMonthOptions(year = new Date().getFullYear()): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = []
  for (let month = 1; month <= 12; month++) {
    const key = `${year}-${String(month).padStart(2, '0')}`
    options.push({ value: key, label: getMonthLabel(key) })
  }
  return options
}

// ─── Numbers ──────────────────────────────────────────────────
export function clampPercentage(value: number): number {
  return Math.min(100, Math.max(0, value))
}

export function roundToCents(value: number): number {
  return Math.round(value * 100) / 100
}

// ─── Strings ──────────────────────────────────────────────────
export function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export function truncate(str: string, max = 40): string {
  return str.length > max ? str.slice(0, max - 1) + '…' : str
}

// ─── Category helpers ─────────────────────────────────────────
export const DEFAULT_EXPENSE_CATEGORIES = [
  '🛒 Mercado',
  '🍕 Alimentação',
  '🚗 Transporte',
  '🏠 Moradia',
  '💊 Saúde',
  '📺 Assinaturas',
  '👚 Roupas',
  '💅 Beleza',
  '🎁 Presente',
  '🐾 Pets',
  '✈️ Viagem',
  '📚 Educação',
  '🏖️ Lazer',
  '⚙️ Serviços',
  '⚠️ Outros',
]

export const DEFAULT_INCOME_CATEGORIES = [
  '💰 Salário',
  '💼 Freelance',
  '📈 Investimentos',
  '🏦 Rendimentos',
  '🎯 Bônus',
  '🔄 Reembolso',
  '🎁 Presente recebido',
  '🏠 Aluguel recebido',
  '💡 Outros rendimentos',
]

export const DEFAULT_CATEGORIES = [
  ...DEFAULT_EXPENSE_CATEGORIES,
  ...DEFAULT_INCOME_CATEGORIES,
]

export const DEFAULT_DEBIT_METHODS = [
  'Dinheiro',
  'Pix',
  'Transferência',
  'Cartão de Débito',
  'Cartão de Crédito',
]

export const DEFAULT_INCOME_METHODS = [
  'Conta Corrente',
  'Conta Poupança',
  'Investimento',
  'Pix',
]

export function extractCategoryEmoji(category: string): string {
  const match = category.match(/^\p{Emoji}/u)
  return match ? match[0] : '💰'
}

export function extractCategoryName(category: string): string {
  return category.replace(/^\p{Emoji}\s*/u, '')
}
