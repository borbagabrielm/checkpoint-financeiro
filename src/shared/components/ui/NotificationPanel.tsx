import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Bell, UserPlus, SplitSquareHorizontal, Check, X, Loader2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/shared/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/display'
import { cn, formatCurrency, formatDate, getInitials } from '@/shared/lib/utils'
import { useNotifications } from '@/shared/hooks/useNotifications'
import type { NotificationItem } from '@/shared/hooks/useNotifications'

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const { count } = useNotifications()

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        aria-label="Notificações"
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white leading-none">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      <NotificationDrawer open={open} onClose={() => setOpen(false)} />
    </>
  )
}

function NotificationDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { all, count, isLoading, acceptFriend, rejectFriend, approveExpense, rejectExpense } =
    useNotifications()

  const handleAcceptFriend = async (id: string, name: string) => {
    await acceptFriend.mutateAsync(id)
    toast.success(`Você e ${name} agora são amigos!`)
  }
  const handleRejectFriend = async (id: string) => {
    await rejectFriend.mutateAsync(id)
    toast.info('Solicitação recusada')
  }
  const handleApprove = async (id: string, desc: string) => {
    await approveExpense.mutateAsync(id)
    toast.success(`"${desc}" aprovado e adicionado às suas transações`)
  }
  const handleReject = async (id: string) => {
    await rejectExpense.mutateAsync(id)
    toast.info('Despesa recusada')
  }

  // Usar portal para renderizar FORA da árvore do componente,
  // evitando que qualquer stacking context pai limite o z-index
  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 bg-black/30 backdrop-blur-[2px] transition-opacity duration-300',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        style={{ zIndex: 9998 }}
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        className={cn(
          'fixed top-0 right-0 h-full w-full max-w-sm bg-card border-l border-border shadow-2xl flex flex-col transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
        style={{ zIndex: 9999 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-display font-semibold text-sm">Notificações</h2>
            {count > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white px-1">
                {count}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center h-7 w-7 rounded-lg text-muted-foreground hover:bg-secondary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : all.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-3">
                <Bell className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">Tudo em dia!</p>
              <p className="text-xs text-muted-foreground mt-1">
                Novas solicitações e despesas aparecem aqui.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {all.map((notif) =>
                notif.kind === 'friend_request' ? (
                  <FriendRequestItem
                    key={notif.friendshipId}
                    notif={notif}
                    onAccept={() => handleAcceptFriend(notif.friendshipId, notif.fromName)}
                    onReject={() => handleRejectFriend(notif.friendshipId)}
                    loading={acceptFriend.isPending || rejectFriend.isPending}
                  />
                ) : notif.kind === 'budget_alert' ? (
                  <BudgetAlertItem
                    key={`budget-${notif.category}`}
                    notif={notif}
                  />
                ) : (
                  <SharedExpenseItem
                    key={notif.sharedTxId}
                    notif={notif}
                    onApprove={() => handleApprove(notif.sharedTxId, notif.description)}
                    onReject={() => handleReject(notif.sharedTxId)}
                    loading={approveExpense.isPending || rejectExpense.isPending}
                  />
                )
              )}
            </ul>
          )}
        </div>
      </aside>
    </>,
    document.body
  )
}

function FriendRequestItem({
  notif, onAccept, onReject, loading,
}: {
  notif: Extract<NotificationItem, { kind: 'friend_request' }>
  onAccept: () => void
  onReject: () => void
  loading: boolean
}) {
  return (
    <li className="px-5 py-4 space-y-3 hover:bg-secondary/30 transition-colors">
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <Avatar className="h-10 w-10">
            {notif.fromAvatar && <AvatarImage src={notif.fromAvatar} />}
            <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
              {getInitials(notif.fromName)}
            </AvatarFallback>
          </Avatar>
          <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 border-2 border-card">
            <UserPlus className="h-2.5 w-2.5 text-white" />
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-snug">
            <span className="text-foreground">{notif.fromName}</span>
            <span className="text-muted-foreground"> quer ser seu amigo</span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{formatDate(notif.at)}</p>
        </div>
      </div>
      <div className="flex gap-2 ml-12">
        <Button size="sm" className="flex-1 h-7 text-xs" onClick={onAccept} disabled={loading}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          Aceitar
        </Button>
        <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={onReject} disabled={loading}>
          <X className="h-3 w-3" />
          Recusar
        </Button>
      </div>
    </li>
  )
}

function SharedExpenseItem({
  notif, onApprove, onReject, loading,
}: {
  notif: Extract<NotificationItem, { kind: 'shared_expense' }>
  onApprove: () => void
  onReject: () => void
  loading: boolean
}) {
  return (
    <li className="px-4 py-3">
      <div className="rounded-xl overflow-hidden border border-primary/20">
        {/* Header azul estilo card */}
        <div className="bg-primary px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar className="h-7 w-7 shrink-0 ring-1 ring-white/20">
              {notif.fromAvatar && <AvatarImage src={notif.fromAvatar} />}
              <AvatarFallback className="text-[10px] bg-white/20 text-white font-bold">
                {getInitials(notif.fromName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-[11px] text-white/60 leading-none mb-0.5">Divisão pendente</p>
              <p className="text-sm font-semibold text-white truncate">{notif.fromName}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-lg font-bold text-[#AAFF47] font-mono leading-none">
              {formatCurrency(notif.amount)}
            </p>
            <p className="text-[10px] text-white/50 mt-0.5">sua parte</p>
          </div>
        </div>
        {/* Body */}
        <div className="bg-card px-4 py-3 space-y-2.5">
          <div>
            <p className="text-sm font-medium truncate">{notif.description}</p>
            <p className="text-xs text-muted-foreground">{formatDate(notif.at)}</p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 h-8 text-xs font-bold bg-[#AAFF47] text-[#0A0A0A] hover:bg-[#AAFF47]/85"
              onClick={onApprove}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Aprovar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs hover:border-destructive hover:text-destructive"
              onClick={onReject}
              disabled={loading}
            >
              <X className="h-3 w-3" />
              Recusar
            </Button>
          </div>
        </div>
      </div>
    </li>
  )
}

// ── Budget alert item ─────────────────────────────────────────
function BudgetAlertItem({
  notif,
}: {
  notif: Extract<NotificationItem, { kind: 'budget_alert' }>
}) {
  return (
    <li className="px-5 py-4 hover:bg-secondary/30 transition-colors">
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <div className="flex items-center justify-center h-9 w-9 rounded-full bg-amber-100 dark:bg-amber-900/40">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-snug">
            Orçamento{' '}
            <span className={notif.percentage >= 100 ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'}>
              {notif.percentage >= 100 ? 'estourado' : `${notif.percentage}% usado`}
            </span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {notif.category} · {formatCurrency(notif.spent)} de {formatCurrency(notif.limit)}
          </p>
          <div className="mt-1.5 h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${notif.percentage >= 100 ? 'bg-destructive' : 'bg-amber-500'}`}
              style={{ width: `${Math.min(100, notif.percentage)}%` }}
            />
          </div>
        </div>
      </div>
    </li>
  )
}