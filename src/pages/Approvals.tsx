import { useState } from 'react'
import { Check, X, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/display'
import { Badge, Avatar, AvatarFallback, AvatarImage, Skeleton } from '@/shared/components/ui/display'
import { cn, formatCurrency, formatDate, getInitials } from '@/shared/lib/utils'
import { useApprovals } from '@/features/shared-expenses/hooks/useApprovals'
import { approveSharedTransaction } from '@/features/shared-expenses/services/sharedExpensesService'
import { useAuth } from '@/shared/hooks/useAuth'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/shared/lib/queryKeys'
import { supabase } from '@/shared/lib/supabase'

export default function ApprovalsPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const { pending, history, isLoading, isError, approve, reject } = useApprovals()

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.sharedExpenses.pending(user?.id ?? '') })
    qc.invalidateQueries({ queryKey: queryKeys.sharedExpenses.history(user?.id ?? '') })
    qc.invalidateQueries({ queryKey: queryKeys.transactions.all(user?.id ?? '') })
  }

  const handleBulkApprove = async () => {
    if (!user?.id || !selectedIds.size) return
    setBulkLoading(true)
    try {
      await Promise.all([...selectedIds].map((id) =>
        approveSharedTransaction(id, user.id)
      ))
      toast.success(`${selectedIds.size} transaç${selectedIds.size > 1 ? 'ões aprovadas' : 'ão aprovada'}!`)
      setSelectedIds(new Set())
      invalidate()
    } catch {
      toast.error('Erro ao aprovar em lote')
    } finally {
      setBulkLoading(false)
    }
  }

  const handleBulkReject = async () => {
    if (!selectedIds.size) return
    setBulkLoading(true)
    try {
      await Promise.all([...selectedIds].map((id) =>
        supabase.from('shared_transactions').update({ status: 'rejected' }).eq('id', id)
      ))
      toast.success(`${selectedIds.size} transaç${selectedIds.size > 1 ? 'ões recusadas' : 'ão recusada'}`)
      setSelectedIds(new Set())
      invalidate()
    } catch {
      toast.error('Erro ao recusar em lote')
    } finally {
      setBulkLoading(false)
    }
  }

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

      {/* Toolbar de seleção em lote */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-[#AAFF47]/40 bg-[#AAFF47]/5 p-3">
          <span className="text-sm font-semibold flex-1 text-foreground">
            {selectedIds.size} selecionada{selectedIds.size > 1 ? 's' : ''}
          </span>
          <Button
            size="sm"
            className="h-8 text-xs font-bold bg-[#AAFF47] text-[#0A0A0A] hover:bg-[#AAFF47]/85"
            onClick={handleBulkApprove}
            disabled={bulkLoading}
          >
            {bulkLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Aprovar todas
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs hover:border-destructive hover:text-destructive"
            onClick={handleBulkReject}
            disabled={bulkLoading}
          >
            <X className="h-3 w-3" />
            Recusar todas
          </Button>
          <button onClick={() => setSelectedIds(new Set())} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Pendentes */}
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
                if (!item.transaction) return null
                const isSelected = selectedIds.has(item.id)
                return (
                  <li
                    key={item.id}
                    className={cn(
                      'rounded-xl border p-4 space-y-3 animate-fade-in transition-colors',
                      isSelected ? 'border-primary/40 bg-primary/5' : 'hover:bg-secondary/30'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox de seleção */}
                      <button
                        onClick={() => toggleSelect(item.id)}
                        className={cn(
                          'shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors mt-0.5',
                          isSelected ? 'bg-primary border-primary' : 'border-border hover:border-primary/50'
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3 text-white" />}
                      </button>

                      {/* Avatar do remetente */}
                      <Avatar className="h-9 w-9 shrink-0">
                        {item.sender_profile?.avatar_url && (
                          <AvatarImage src={item.sender_profile.avatar_url} />
                        )}
                        <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                          {getInitials(item.sender_profile?.display_name)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{item.transaction.description}</p>
                        <p className="text-xs text-muted-foreground">
                          De: <span className="text-foreground/80">{item.sender_profile?.display_name ?? 'Usuário'}</span>
                          {' · '}{formatDate(item.transaction.date)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Total: {formatCurrency(Math.abs(item.transaction.amount))} · {item.transaction.category}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="font-mono font-bold text-[hsl(var(--expense))]">
                          {formatCurrency(item.split_amount)}
                        </p>
                        {item.split_percentage && (
                          <p className="text-xs text-muted-foreground">
                            {item.split_percentage.toFixed(0)}% do total
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Botões */}
                    <div className="flex items-center gap-2 pl-8">
                      <Button
                        size="sm"
                        className="flex-1 h-8 text-xs font-bold bg-[#AAFF47] text-[#0A0A0A] hover:bg-[#AAFF47]/85"
                        onClick={() => approve.mutate(item.id)}
                        disabled={approve.isPending}
                      >
                        <Check className="h-3 w-3" />
                        Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-8 text-xs hover:border-destructive hover:text-destructive"
                        onClick={() => reject.mutate(item.id)}
                        disabled={reject.isPending}
                      >
                        <X className="h-3 w-3" />
                        Recusar
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Histórico */}
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
                    <Avatar className="h-7 w-7 shrink-0">
                      {item.sender_profile?.avatar_url && (
                        <AvatarImage src={item.sender_profile.avatar_url} />
                      )}
                      <AvatarFallback className="text-[10px] bg-secondary">
                        {getInitials(item.sender_profile?.display_name)}
                      </AvatarFallback>
                    </Avatar>
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