interface RaxoPercentIconProps {
  size?: number
  fill?: string
  className?: string
}

// Ícone % do Raxo — mantém o path original em todo lugar que precisar dele
// (empty states, onboarding, error boundary, splash screen)
export function RaxoPercentIcon({ size = 32, fill = '#AAFF47', className }: RaxoPercentIconProps) {
  return (
    <svg viewBox="492 221 90 88" width={size} height={size} xmlns="http://www.w3.org/2000/svg" className={className}>
      <polygon points="582.48,230.12 530.02,308.99 501.15,308.99 553.61,230.12 582.48,230.12" fill={fill} />
      <circle cx="515.62" cy="244.36" r="14.47" fill={fill} />
      <circle cx="568.01" cy="293.67" r="14.47" fill={fill} />
    </svg>
  )
}
