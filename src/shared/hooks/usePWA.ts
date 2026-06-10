import { useEffect, useState } from 'react'

export function usePWA() {
  const [canInstall, setCanInstall] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<Event & { prompt: () => void } | null>(null)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default')

  useEffect(() => {
    // Registrar service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    // Captura evento de instalação PWA
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as Event & { prompt: () => void })
      setCanInstall(true)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // Status de notificações
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission)
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const install = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    setCanInstall(false)
    setDeferredPrompt(null)
  }

  const requestNotifications = async (): Promise<boolean> => {
    if (!('Notification' in window)) return false
    const permission = await Notification.requestPermission()
    setNotificationPermission(permission)
    return permission === 'granted'
  }

  const sendLocalNotification = (title: string, body: string, url = '/') => {
    if (notificationPermission !== 'granted') return
    navigator.serviceWorker.ready.then((reg) => {
      reg.showNotification(title, { body, icon: '/icon-192.png', data: { url } })
    })
  }

  return { canInstall, install, notificationPermission, requestNotifications, sendLocalNotification }
}