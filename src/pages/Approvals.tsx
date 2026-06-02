import { Check, X, Clock, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/display'
import { Badge, Avatar, AvatarFallback, Skeleton } from '@/shared/components/ui/display'
import { formatCurrency, formatDate, getInitials } from '@/shared/lib/utils'
import { useApprovals } from '@/features/shared-expenses/hooks/useApprovals'

export default function ApprovalsPage() {
  const { pending, history, isLoading, isError, approve, reject } = useApprovals()

  if (isError) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="page-header">
          <h1 className="page-title">Aprovações</h1>
        </div>
        <Card>
          <CardContent className="pt-6 flex flex-col items-center py-12 text-center">
            <p className="text-2xl mb-2">⚠️</p>
            <p className="text-sm text-muted-foreground">Erro ao carregar aprovações. Tente recarregar a página.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Aprovações</h1>
        <p className="page-subtitle">Despesas compartilhadas aguardando sua confirmação</p>
      </div>

      {/* Pending */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            Aguardando aprovação
            {pending.length > 0 && (
              <Badge variant="pending">{pending.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="rounded-lg border p-4 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              ))}
            </div>
          ) : pending.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <CheckCircle2 className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">Tudo em dia! Sem aprovações pendentes.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {pending.map((item) => {
                // Proteção contra transaction null (pode ocorrer se RLS bloquear)
                if (!item.transaction) return null
                return (
                  <li key={item.id} className="rounded-lg border p-4 space-y-3 animate-fade-in">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="text-xs">
                            {getInitials(item.sender_profile?.display_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{item.transaction.description}</p>
                          <p className="text-xs text-muted-foreground">
                            De: {item.sender_profile?.display_name ?? 'Usuário'} ·{' '}
                            {formatDate(item.transaction.date)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono font-semibold text-[hsl(var(--expense))]">
                          {formatCurrency(item.split_amount)}
                        </p>
                        {item.split_percentage && (
                          <p className="text-xs text-muted-foreground">
                            {item.split_percentage.toFixed(0)}% do total
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground flex-1">
                        Total: {formatCurrency(Math.abs(item.transaction.amount))} · {item.transaction.category}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs hover:text-destructive hover:border-destructive"
                        onClick={() => reject.mutate(item.id)}
                        disabled={reject.isPending}
                      >
                        <X className="h-3 w-3" />
                        Recusar
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => approve.mutate(item.id)}
                        disabled={approve.isPending}
                      >
                        <Check className="h-3 w-3" />
                        Aprovar
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* History */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-normal">Histórico</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {history.map((item) => {
                if (!item.transaction) return null
                return (
                  <li key={item.id} className="flex items-center gap-3 py-1.5">
                    {item.status === 'approved' ? (
                      <CheckCircle2 className="h-4 w-4 text-[hsl(var(--income))] shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-[hsl(var(--expense))] shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{item.transaction.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.sender_profile?.display_name} · {formatDate(item.created_at)}
                      </p>
                    </div>
                    <span className="font-mono text-sm text-muted-foreground shrink-0">
                      {formatCurrency(item.split_amount)}
                    </span>
                    <Badge variant={item.status === 'approved' ? 'approved' : 'rejected'}>
                      {item.status === 'approved' ? 'Aprovado' : 'Recusado'}
                    </Badge>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}