import { Component, type ReactNode, type ErrorInfo } from 'react'
import { RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

// Ícone % do Raxo — usado no lugar do antigo Compass
function RaxoErrorIcon() {
  return (
    <svg viewBox="492 221 90 88" width="32" height="32" xmlns="http://www.w3.org/2000/svg">
      <polygon points="582.48,230.12 530.02,308.99 501.15,308.99 553.61,230.12 582.48,230.12" fill="hsl(var(--expense))"/>
      <circle cx="515.62" cy="244.36" r="14.47" fill="hsl(var(--expense))"/>
      <circle cx="568.01" cy="293.67" r="14.47" fill="hsl(var(--expense))"/>
    </svg>
  )
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-sm w-full text-center space-y-6">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-[hsl(var(--expense)/0.1)] mx-auto">
              <RaxoErrorIcon />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Algo deu errado</h1>
              <p className="text-sm text-muted-foreground mt-2">
                Ocorreu um erro inesperado. Tente recarregar a página.
              </p>
              {this.state.error && (
                <p className="text-xs text-muted-foreground/60 mt-2 font-mono bg-muted rounded p-2 text-left break-all">
                  {this.state.error.message}
                </p>
              )}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 mx-auto px-5 py-2.5 rounded-full bg-[#AAFF47] text-[#0A0A0A] text-sm font-bold hover:bg-[#AAFF47]/85 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Recarregar
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// Versão funcional para páginas individuais (fallback menor)
export function PageErrorFallback({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <svg viewBox="492 221 90 88" width="40" height="40" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.5 }}>
        <polygon points="582.48,230.12 530.02,308.99 501.15,308.99 553.61,230.12 582.48,230.12" fill="hsl(var(--expense))"/>
        <circle cx="515.62" cy="244.36" r="14.47" fill="hsl(var(--expense))"/>
        <circle cx="568.01" cy="293.67" r="14.47" fill="hsl(var(--expense))"/>
      </svg>
      <p className="text-sm font-medium">Erro ao carregar esta página</p>
      <p className="text-xs text-muted-foreground">Verifique sua conexão e tente novamente.</p>
      {onRetry && (
        <button onClick={onRetry} className="text-xs text-primary hover:underline flex items-center gap-1">
          <RefreshCw className="h-3 w-3" />
          Tentar novamente
        </button>
      )}
    </div>
  )
}