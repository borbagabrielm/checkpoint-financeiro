import { cn } from '@/shared/lib/utils'

export interface ContextRailItem {
  id: string
  icon: React.ElementType
  label: string
}

interface ContextRailProps {
  items: ContextRailItem[]
  active: string
  onSelect: (id: string) => void
  className?: string
}

// Trilha lateral fina, ícone-only — sub-navegação contextual de uma página
// específica (não é navegação global, cada página que tem sub-seções reais
// a renderiza ela mesma). Ver RAXO-DESIGN-SYSTEM-V2.md.
export function ContextRail({ items, active, onSelect, className }: ContextRailProps) {
  return (
    <nav className={cn('flex md:flex-col gap-1.5 shrink-0', className)}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          title={item.label}
          onClick={() => onSelect(item.id)}
          className={cn(
            'flex md:flex-col items-center justify-center gap-1 md:gap-0.5 h-11 md:h-14 w-11 md:w-14 rounded-full md:rounded-lg shrink-0 transition-colors',
            active === item.id
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
          )}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span className="hidden md:block text-[9px] font-medium leading-none">{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
