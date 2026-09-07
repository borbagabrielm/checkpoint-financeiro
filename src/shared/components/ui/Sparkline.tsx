interface SparklineProps {
  data: number[]
  color?: string
  width?: number
  height?: number
  className?: string
}

// Mini gráfico de tendência inline — sem eixos/tooltip, só a forma da série.
export function Sparkline({ data, color = 'currentColor', width = 56, height = 24, className }: SparklineProps) {
  if (data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const step = width / (data.length - 1)

  const points = data
    .map((v, i) => `${i * step},${height - ((v - min) / range) * height}`)
    .join(' ')

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} fill="none">
      <polyline points={points} stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />
    </svg>
  )
}
