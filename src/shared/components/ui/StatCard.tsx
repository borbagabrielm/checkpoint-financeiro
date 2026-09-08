import { Skeleton } from '@/shared/components/ui/display'
import { Sparkline } from '@/shared/components/ui/Sparkline'
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
  trend?: number[]       // série pra sparkline opcional (ex: últimos 7 dias)
  trendColor?: string
  delta?: number | null  // variação % vs período anterior — badge neutro, só mostra direção
  deltaCaption?: string  // legenda abaixo do valor (ex: "vs. mês passado")
}

// Stat card com barra de acento no topo — usado em Home, Analytics e Planejamento.
export function StatCard({
  label, value, icon: Icon, accentColor, valueColor, iconBg, loading, isCount = false,
  trend, trendColor, delta, deltaCaption,
}: StatCardProps) {
  const showDelta = delta !== undefined && delta !== null && Math.abs(delta) >= 1

  return (
    <div className="stat-card animate-fade-in">
      {/* Barra de acento no topo — usa margem negativa para não quebrar o padding do card */}
      <div className={cn('stat-card-accent-top', accentColor)} />
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <div className={cn('p-2 rounded-lg', iconBg)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      {loading ? <Skeleton className="h-8 w-32" /> : (
        <>
          <div className="flex items-end justify-between gap-2">
            <div className="flex items-center gap-2">
              <p className={cn('text-2xl font-display font-bold tracking-tight', valueColor)}>
                {isCount ? value : formatCurrency(value)}
              </p>
              {showDelta && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-foreground/10 px-1.5 py-0.5 text-[11px] font-semibold text-foreground">
                  {delta! >= 0 ? '↑' : '↓'} {Math.abs(delta!).toFixed(0)}%
                </span>
              )}
            </div>
            {trend && trend.length > 1 && (
              <Sparkline data={trend} color={trendColor ?? 'currentColor'} className={cn('mb-1', valueColor)} />
            )}
          </div>
          {deltaCaption && (
            <p className="text-xs text-muted-foreground mt-0.5">{deltaCaption}</p>
          )}
        </>
      )}
    </div>
  )
}
