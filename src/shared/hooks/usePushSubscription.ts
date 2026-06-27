import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from './useAuth'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

// Converte a chave pública VAPID (base64url) para Uint8Array — formato
// exigido pela PushManager API
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export type PushStatus = 'unsupported' | 'default' | 'granted' | 'denied' | 'subscribed'

export function usePushSubscription() {
  const { user } = useAuth()
  const [status, setStatus] = useState<PushStatus>('default')
  const [loading, setLoading] = useState(false)

  const checkStatus = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported')
      return
    }
    if (Notification.permission === 'denied') { setStatus('denied'); return }

    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    setStatus(sub ? 'subscribed' : Notification.permission === 'granted' ? 'granted' : 'default')
  }, [])

  useEffect(() => { checkStatus() }, [checkStatus])

  // Pede permissão, cria a subscription e salva no Supabase
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!VAPID_PUBLIC_KEY) {
      console.error('[usePushSubscription] VITE_VAPID_PUBLIC_KEY não configurada')
      return false
    }
    if (!user?.id) return false
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported')
      return false
    }

    setLoading(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'default')
        return false
      }

      const reg = await navigator.serviceWorker.ready
      let sub = await reg.pushManager.getSubscription()

      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        })
      }

      const subJson = sub.toJSON()
      const { error } = await supabase.from('push_subscriptions').upsert(
        {
          user_id: user.id,
          endpoint: subJson.endpoint!,
          p256dh: subJson.keys!.p256dh,
          auth: subJson.keys!.auth,
          user_agent: navigator.userAgent,
        },
        { onConflict: 'endpoint' }
      )

      if (error) {
        console.error('[usePushSubscription] erro ao salvar subscription:', error.message)
        return false
      }

      setStatus('subscribed')
      return true
    } catch (err) {
      console.error('[usePushSubscription] erro ao subscrever:', err)
      return false
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  // Cancela notificações — remove subscription local e do Supabase
  const unsubscribe = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        await sub.unsubscribe()
      }
      setStatus('granted')
    } finally {
      setLoading(false)
    }
  }, [])

  return { status, loading, subscribe, unsubscribe, isSupported: status !== 'unsupported' }
}