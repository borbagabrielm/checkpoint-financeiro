import { cn } from '@/shared/lib/utils'

interface TrendBarsProps {
  data: { label: string; value: number }[]
  color: string
  height?: number
  highlightIndex?: number
  highlightLabel?: string
}

// Mini gráfico de barras em pílula — trilho claro atrás, preenchimento em
// degradê na frente, com um selo flutuante opcional no mês em destaque.
// Inspirado na referência visual trazida pelo usuário (cartão de vendas).
export function TrendBars({ data, color, height = 64, highlightIndex, highlightLabel }: TrendBarsProps) {
  if (!data.length) return null

  const max = Math.max(...data.map((d) => Math.abs(d.value)), 1)
  const trackHeight = height - 16

  return (
    <div className="flex items-end gap-1.5">
      {data.map((d, i) => {
        const pct = Math.max(6, (Math.abs(d.value) / max) * 100)
        const isHighlight = i === highlightIndex
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <div className="relative w-full flex justify-center">
              {isHighlight && highlightLabel && (
                <span className="absolute -top-6 whitespace-nowrap rounded-full bg-[#0A0A0A] text-white dark:bg-white dark:text-[#0A0A0A] text-[10px] font-semibold px-2 py-0.5 shadow-sm z-10">
                  {highlightLabel}
                </span>
              )}
              <div className="relative w-3 rounded-full bg-secondary overflow-hidden" style={{ height: trackHeight }}>
                <div
                  className="absolute bottom-0 left-0 right-0 rounded-full"
                  style={{ height: `${pct}%`, background: `linear-gradient(to top, ${color}, ${color}66)` }}
                />
              </div>
            </div>
            <span className={cn('text-[9px] uppercase tracking-wide', isHighlight ? 'text-foreground font-semibold' : 'text-muted-foreground')}>
              {d.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
