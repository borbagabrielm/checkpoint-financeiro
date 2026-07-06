import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from './useAuth'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

// Converte a chave pública VAPID (base64url) para Uint8Array — formato
// exigido pela PushManager API.
// Retorna ArrayBuffer explícito (não Uint8Array) para evitar conflito de
// tipos entre versões do lib.dom.d.ts (Uint8Array<ArrayBufferLike> vs
// ArrayBufferView<ArrayBuffer> exigido por applicationServerKey).
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i)
  return outputArray.buffer as ArrayBuffer
}

export type PushStatus = 'unsupported' | 'default' | 'granted' | 'denied' | 'subscribed'

export function usePushSubscription() {
  const { user } = useAuth()
  const [status, setStatus] = useState<PushStatus>('default')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    setError(null)

    if (!VAPID_PUBLIC_KEY) {
      const msg = 'Configuração de notificações ausente. Avise o desenvolvedor (VITE_VAPID_PUBLIC_KEY não definida).'
      console.error('[usePushSubscription]', msg)
      setError(msg)
      return false
    }
    if (!user?.id) {
      setError('Você precisa estar logado para ativar notificações.')
      return false
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported')
      return false
    }

    setLoading(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'default')
        if (permission === 'default') {
          setError('Permissão não concedida. Tente novamente.')
        }
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
      const { error: dbError } = await supabase.from('push_subscriptions').upsert(
        {
          user_id: user.id,
          endpoint: subJson.endpoint!,
          p256dh: subJson.keys!.p256dh,
          auth: subJson.keys!.auth,
          user_agent: navigator.userAgent,
        },
        { onConflict: 'endpoint' }
      )

      if (dbError) {
        console.error('[usePushSubscription] erro ao salvar subscription:', dbError.message)
        setError('Erro ao salvar notificação. Tente novamente.')
        return false
      }

      setStatus('subscribed')
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido ao ativar notificações'
      console.error('[usePushSubscription] erro ao subscrever:', err)
      setError(msg)
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

  return { status, loading, error, subscribe, unsubscribe, isSupported: status !== 'unsupported' }
}