import { cn } from '@/shared/lib/utils'

interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

// Toggle pill — trilho arredondado, preenche em lime quando ativo (mesma
// linguagem do progress bar Aurora, ver RAXO-DESIGN-SYSTEM-V2.md §4).
export function Switch({ checked, onCheckedChange, disabled, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors duration-200 disabled:opacity-50 disabled:pointer-events-none',
        checked ? 'bg-[hsl(var(--income-fill))]' : 'bg-secondary',
        className
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200',
          checked ? 'translate-x-5' : 'translate-x-0'
        )}
      />
    </button>
  )
}
