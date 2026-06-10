import { useState, useEffect } from 'react'
import { WifiOff } from 'lucide-react'

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const on  = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  return isOnline
}

export function OfflineBanner() {
  const isOnline = useOnlineStatus()
  if (isOnline) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-center gap-2 bg-amber-500 text-white text-sm font-medium py-2 px-4 animate-slide-in">
      <WifiOff className="h-4 w-4 shrink-0" />
      Você está offline. Algumas funções podem não estar disponíveis.
    </div>
  )
}