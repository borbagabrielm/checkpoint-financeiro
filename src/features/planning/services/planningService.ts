import type { Transaction, DailyBalance } from '@/shared/types'

// Saldo corrido dia a dia dentro do mês: cada dia soma a receita e desconta
// a despesa lançadas naquele dia específico (não o total do mês) — o saldo
// reseta a 0 no início de cada mês (não carrega o saldo real acumulado de
// meses anteriores, é uma projeção isolada do mês selecionado).
export function computeDailyBalances(transactions: Transaction[], monthKey: string): DailyBalance[] {
  const [yearStr, monthStr] = monthKey.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  const daysInMonth = new Date(year, month, 0).getDate()

  const byDay = new Map<number, { income: number; expense: number }>()
  for (const t of transactions) {
    if (!t.date.startsWith(monthKey)) continue
    const day = Number(t.date.slice(8, 10))
    const entry = byDay.get(day) ?? { income: 0, expense: 0 }
    if (t.type === 'income') entry.income += Math.abs(t.amount)
    else entry.expense += Math.abs(t.amount)
    byDay.set(day, entry)
  }

  let running = 0
  const result: DailyBalance[] = []
  for (let day = 1; day <= daysInMonth; day++) {
    const entry = byDay.get(day) ?? { income: 0, expense: 0 }
    running += entry.income - entry.expense
    result.push({
      day,
      date: `${monthKey}-${String(day).padStart(2, '0')}`,
      label: String(day),
      income: entry.income,
      expense: entry.expense,
      balance: running,
    })
  }
  return result
}
