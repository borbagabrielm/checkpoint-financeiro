import { useEffect, useState } from 'react'

export function usePWA() {
  const [canInstall, setCanInstall] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<Event & { prompt: () => void } | null>(null)

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

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const install = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    setCanInstall(false)
    setDeferredPrompt(null)
  }

  return { canInstall, install }
}

// Nota: gerenciamento de permissão e subscription de push notifications
// foi movido para usePushSubscription.ts — hook dedicado e mais completo,
// que já salva a subscription no Supabase automaticamente.