import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'
import { RaxoPercentIcon } from '@/shared/components/ui/RaxoIcon'

interface EmptyStateProps {
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

// Estado vazio padrão do Raxo — card claro Aurora como "respiro" dentro do
// Core (dark ou light), ícone % em pílula lime. Ver raxo-design-system-v2.md §8.
export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('aurora-card-light flex flex-col items-center justify-center text-center gap-3 py-12 px-6', className)}>
      <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-[#AAFF47]/15">
        <RaxoPercentIcon size={26} fill="#3B3BFF" />
      </div>
      <div>
        <p className="text-sm font-semibold text-[#0A0A0A]">{title}</p>
        {description && <p className="text-xs text-black/50 mt-1 max-w-xs">{description}</p>}
      </div>
      {action}
    </div>
  )
}
