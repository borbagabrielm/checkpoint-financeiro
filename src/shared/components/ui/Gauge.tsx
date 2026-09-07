interface GaugeProps {
  value: number          // 0-100
  size?: number
  strokeWidth?: number
  color?: string          // cor do arco preenchido
  trackColor?: string     // cor da textura do trilho vazio
  label?: React.ReactNode
  className?: string
}

// Gauge semicircular — arco preenchido + trilho "hachurado" (tracejado, já
// que hachura diagonal não se aplica a um stroke curvo). Ver
// RAXO-DESIGN-SYSTEM-V2.md §4 (linguagem de forma Aurora trazida pro Core).
export function Gauge({
  value, size = 140, strokeWidth = 10, color = '#3B3BFF', trackColor = 'currentColor', label, className,
}: GaugeProps) {
  const clamped = Math.min(100, Math.max(0, value))
  const r = (size - strokeWidth) / 2
  const cx = size / 2
  const cy = size / 2
  const height = size / 2 + strokeWidth / 2
  const path = `M ${strokeWidth / 2} ${cy} A ${r} ${r} 0 0 1 ${size - strokeWidth / 2} ${cy}`

  return (
    <div className={className} style={{ width: size, height, position: 'relative' }}>
      <svg width={size} height={height} viewBox={`0 0 ${size} ${height}`}>
        {/* Trilho — tracejado, evoca a textura de hachura do resto do sistema */}
        <path
          d={path}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray="1 6"
          opacity={0.25}
        />
        {/* Preenchimento — normalizado em 100 unidades via pathLength */}
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={100}
          strokeDashoffset={100 - clamped}
          style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
        />
      </svg>
      {label && (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-center">
          {label}
        </div>
      )}
    </div>
  )
}
