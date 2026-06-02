import { useEffect } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'light' | 'dark' | 'system'

interface ThemeStore {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: 'light' | 'dark'
}

const getSystemTheme = (): 'light' | 'dark' =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: 'system',
      resolvedTheme: getSystemTheme(),
      setTheme: (theme) => {
        const resolved = theme === 'system' ? getSystemTheme() : theme
        set({ theme, resolvedTheme: resolved })
        document.documentElement.classList.toggle('dark', resolved === 'dark')
      },
    }),
    { name: 'pocket-compass-theme' }
  )
)

export function useTheme() {
  const { theme, setTheme, resolvedTheme } = useThemeStore()

  useEffect(() => {
    // Apply resolved theme on mount
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')

    // Listen for system preference changes
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if (theme === 'system') {
        const resolved = media.matches ? 'dark' : 'light'
        useThemeStore.setState({ resolvedTheme: resolved })
        document.documentElement.classList.toggle('dark', resolved === 'dark')
      }
    }
    media.addEventListener('change', handler)
    return () => media.removeEventListener('change', handler)
  }, [theme, resolvedTheme])

  return { theme, setTheme, resolvedTheme, isDark: resolvedTheme === 'dark' }
}
