import { Bell, BellOff, BellRing, Loader2 } from 'lucide-react'
import { usePushSubscription } from '@/shared/hooks/usePushSubscription'

// Componente para a página de Settings — toggle de notificações push.
// Cole dentro da tab "Aparência" do Settings.tsx, ou crie uma seção própria.
export function PushNotificationToggle() {
  const { status, loading, error, subscribe, unsubscribe, isSupported } = usePushSubscription()

  if (!isSupported) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/40 text-sm text-muted-foreground">
        <BellOff className="h-4 w-4 shrink-0" />
        Notificações push não são suportadas neste navegador/dispositivo.
      </div>
    )
  }

  if (status === 'denied') {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-[hsl(var(--expense)/0.08)] text-sm text-[hsl(var(--expense))]">
        <BellOff className="h-4 w-4 shrink-0" />
        Notificações bloqueadas. Ative manualmente nas configurações do navegador/dispositivo.
      </div>
    )
  }

  const isOn = status === 'subscribed'

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border">
        <div className="flex items-center gap-3">
          <div className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${isOn ? 'bg-[hsl(var(--income-fill)/0.15)]' : 'bg-secondary'}`}>
            {isOn ? <BellRing className="h-4 w-4 text-[hsl(var(--income))]" /> : <Bell className="h-4 w-4 text-muted-foreground" />}
          </div>
          <div>
            <p className="text-sm font-medium">Notificações push</p>
            <p className="text-xs text-muted-foreground">
              {isOn ? 'Ativadas — você será avisado mesmo com o app fechado' : 'Receba avisos de divisões e aprovações em tempo real'}
            </p>
          </div>
        </div>
        <button
          onClick={() => (isOn ? unsubscribe() : subscribe())}
          disabled={loading}
          className={`shrink-0 relative w-11 h-6 rounded-full transition-colors overflow-hidden ${isOn ? 'bg-[#AAFF47]' : 'bg-secondary'}`}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-foreground" />
          ) : (
            <span
              className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200"
              style={{ transform: isOn ? 'translateX(20px)' : 'translateX(0)' }}
            />
          )}
        </button>
      </div>
      {error && (
        <p className="text-xs text-[hsl(var(--expense))] px-1">{error}</p>
      )}
    </div>
  )
}