import { Skeleton } from '@/shared/components/ui/display'
import { Sparkline } from '@/shared/components/ui/Sparkline'
import { TrendBars } from '@/shared/components/ui/TrendBars'
import { cn, formatCurrency } from '@/shared/lib/utils'

interface StatCardProps {
  label: string
  value: number
  icon: React.ElementType
  accentColor: string   // cor da barra topo
  valueColor: string    // cor do valor
  iconBg: string         // bg do ícone
  loading?: boolean
  isCount?: boolean
  trend?: number[]       // sparkline simples — usado quando não há trendBars
  trendColor?: string
  delta?: number | null  // variação % vs período anterior — badge preto, ex "↑30%"
  caption?: string       // legenda comparativa abaixo da barra (ex: "↘ R$320 a menos que ago 2026")
  barPct?: number        // 0-100 — se definido, mostra a barra de progresso hachurada
  barColor?: string
  trendBars?: { label: string; value: number }[]  // se definido, substitui o sparkline por um mini gráfico de barras
  trendHighlightIndex?: number
  trendHighlightLabel?: string
}

// Stat card com barra de acento no topo — usado em Home, Analytics e Planejamento.
export function StatCard({
  label, value, icon: Icon, accentColor, valueColor, iconBg, loading, isCount = false,
  trend, trendColor, delta, caption, barPct, barColor, trendBars, trendHighlightIndex, trendHighlightLabel,
}: StatCardProps) {
  const showDelta = delta !== undefined && delta !== null && Math.abs(delta) >= 1

  return (
    <div className="stat-card animate-fade-in">
      {/* Barra de acento no topo — usa margem negativa para não quebrar o padding do card */}
      <div className={cn('stat-card-accent-top', accentColor)} />

      {loading ? (
        <>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-24 mt-2" />
        </>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className={cn('text-2xl font-display font-bold tracking-tight', valueColor)}>
                  {isCount ? value : formatCurrency(value)}
                </p>
                {showDelta && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-[#0A0A0A] text-white dark:bg-white dark:text-[#0A0A0A] px-1.5 py-0.5 text-[11px] font-semibold shrink-0">
                    {delta! >= 0 ? '↑' : '↓'} {Math.abs(delta!).toFixed(0)}%
                  </span>
                )}
              </div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-0.5">{label}</p>
            </div>
            <div className={cn('p-2 rounded-full shrink-0', iconBg)}>
              <Icon className="h-4 w-4" />
            </div>
          </div>

          {barPct !== undefined && (
            <div className="aurora-progress-track my-3">
              <div
                className="aurora-progress-fill"
                style={{ width: `${Math.min(100, Math.max(0, barPct))}%`, background: barColor ?? 'currentColor' }}
              />
            </div>
          )}

          {caption && (
            <p className="text-xs text-muted-foreground mb-1">{caption}</p>
          )}

          {trendBars && trendBars.length > 1 ? (
            <div className="mt-3">
              <TrendBars
                data={trendBars}
                color={barColor ?? 'currentColor'}
                highlightIndex={trendHighlightIndex}
                highlightLabel={trendHighlightLabel}
              />
            </div>
          ) : trend && trend.length > 1 ? (
            <div className="flex justify-end mt-1">
              <Sparkline data={trend} color={trendColor ?? 'currentColor'} className={valueColor} />
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
