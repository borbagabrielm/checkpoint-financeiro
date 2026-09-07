interface OrganicWaveProps {
  className?: string
  height?: number
}

// Onda orgânica decorativa — assinatura visual do "Raxo Aurora", usa o
// gradiente de marca (--gradient-wave: lime → verde-azulado → azul).
// Só decorativa, nunca codifica dado real (RAXO-DESIGN-SYSTEM-V2.md §2.5).
export function OrganicWave({ className, height = 140 }: OrganicWaveProps) {
  return (
    <svg
      viewBox="0 0 900 200"
      preserveAspectRatio="none"
      width="100%"
      height={height}
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="raxo-wave-gradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#AAFF47" />
          <stop offset="35%" stopColor="#6FE0A8" />
          <stop offset="65%" stopColor="#4FB8D9" />
          <stop offset="100%" stopColor="#3B3BFF" />
        </linearGradient>
      </defs>
      <path
        fill="url(#raxo-wave-gradient)"
        opacity={0.85}
        d="M0,60 C150,20 300,100 450,60 C600,20 750,100 900,60
           L900,160 C750,200 600,120 450,160 C300,200 150,120 0,160 Z"
      />
    </svg>
  )
}
