import { useState, useMemo } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/shared/components/ui/form-elements'
import { Card, CardContent } from '@/shared/components/ui/display'
import { cn, formatCurrency, formatDate, extractCategoryEmoji } from '@/shared/lib/utils'
import { useTransactions } from '@/features/transactions/hooks/useTransactions'

export default function SearchPage() {
  const { transactions, isLoading } = useTransactions()
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    if (query.trim().length < 2) return []
    const q = query.toLowerCase()
    return transactions.filter(
      (t) =>
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        (t.payment_method?.toLowerCase().includes(q) ?? false)
    )
  }, [transactions, query])

  const totalIncome = results.filter((t) => t.type === 'income').reduce((s, t) => s + Math.abs(t.amount), 0)
  const totalExpense = results.filter((t) => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0)

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Busca</h1>
        <p className="page-subtitle">Pesquise em todas as suas transações</p>
      </div>

      {/* Campo de busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Descrição, categoria, método de pagamento..."
          className="pl-10 h-11 text-base"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Resultados */}
      {query.length >= 2 && (
        <>
          {/* Resumo */}
          {results.length > 0 && (
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{results.length} resultado{results.length !== 1 ? 's' : ''}</span>
              {totalIncome > 0 && (
                <span className="text-[hsl(var(--income))]">+{formatCurrency(totalIncome)}</span>
              )}
              {totalExpense > 0 && (
                <span className="text-[hsl(var(--expense))]">-{formatCurrency(totalExpense)}</span>
              )}
            </div>
          )}

          <Card>
            <CardContent className="pt-4 pb-2">
              {isLoading ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Carregando...</p>
              ) : results.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-2xl mb-2">🔍</p>
                  <p className="text-sm text-muted-foreground">Nenhuma transação encontrada para "{query}"</p>
                </div>
              ) : (
                <ul className="space-y-1">
                  {results.map((tx) => (
                    <li key={tx.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                      <div className={cn(
                        'flex items-center justify-center w-9 h-9 rounded-full text-base shrink-0',
                        tx.type === 'income' ? 'bg-[hsl(var(--income)/0.12)]' : 'bg-[hsl(var(--expense)/0.12)]'
                      )}>
                        {extractCategoryEmoji(tx.category)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {/* Highlight do termo buscado */}
                          {tx.description.split(new RegExp(`(${query})`, 'gi')).map((part, i) =>
                            part.toLowerCase() === query.toLowerCase()
                              ? <mark key={i} className="bg-primary/20 text-primary rounded px-0.5">{part}</mark>
                              : part
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {tx.category.replace(/^\p{Emoji}\s*/u, '')} · {formatDate(tx.date)}
                          {tx.payment_method && ` · ${tx.payment_method}`}
                        </p>
                      </div>
                      <span className={cn(
                        'font-mono text-sm font-semibold shrink-0',
                        tx.type === 'income' ? 'amount-income' : 'amount-expense'
                      )}>
                        {tx.type === 'income' ? '+' : '-'} {formatCurrency(tx.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {query.length < 2 && query.length > 0 && (
        <p className="text-sm text-muted-foreground text-center">Digite pelo menos 2 caracteres</p>
      )}

      {query.length === 0 && (
        <div className="flex flex-col items-center py-16 text-center text-muted-foreground">
          <Search className="h-12 w-12 mb-4 opacity-30" />
          <p className="text-sm">Busque por descrição, categoria ou método de pagamento</p>
          <p className="text-xs mt-1">Abrange todas as suas transações de todos os períodos</p>
        </div>
      )}
    </div>
  )
}