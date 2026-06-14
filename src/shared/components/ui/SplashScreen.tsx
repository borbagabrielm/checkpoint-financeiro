export function SplashScreen() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background gap-6">
      {/* Logo animado */}
      <div className="animate-scale-in">
        <svg viewBox="322 194 380 120" height="56" xmlns="http://www.w3.org/2000/svg" aria-label="Raxo">
          <path d="M381.1,306.23h32.17l-22.16-40.68c5.65-2.72,10.11-6.56,13.34-11.57,3.46-5.36,5.19-11.95,5.19-19.76s-1.69-14.38-5.06-19.92c-3.37-5.54-8.1-9.78-14.17-12.73-6.07-2.95-13.16-4.42-21.25-4.42h-47.09v109.09h29.62v-36.01h10.25l19.15,36.01ZM351.7,220.78h10.44c3.48,0,6.45.47,8.92,1.41,2.47.94,4.37,2.4,5.7,4.37,1.33,1.97,2,4.52,2,7.64s-.67,5.59-2,7.51-3.23,3.31-5.7,4.18c-2.47.87-5.44,1.3-8.92,1.3h-10.44v-26.42Z" className="fill-foreground"/>
          <path d="M416.19,284.59c0-15.2,10.74-24.62,30.57-26.11l23.14-1.82v-1.32c0-8.1-4.96-12.39-14.05-12.39-10.74,0-16.53,4.13-16.53,11.57h-21.15c0-18.67,15.37-30.9,39-30.9s37.51,13.39,37.51,37.02v48.26h-22.48l-1.65-10.91c-2.64,7.6-13.55,13.05-25.95,13.05-17.52,0-28.42-10.25-28.42-26.44ZM470.07,277.98v-4.46l-12.89,1.16c-11.07.99-15.04,3.47-15.04,8.76,0,5.95,3.64,8.76,11.4,8.76,9.75,0,16.53-4.79,16.53-14.21Z" className="fill-foreground"/>
          <polygon points="582.48,230.12 530.02,308.99 501.15,308.99 553.61,230.12 582.48,230.12" fill="hsl(var(--logo-accent))"/>
          <circle cx="515.62" cy="244.36" r="14.47" fill="hsl(var(--logo-accent))"/>
          <circle cx="568.01" cy="293.67" r="14.47" fill="hsl(var(--logo-accent))"/>
          <path d="M629.26,223.62c25.68,0,44.42,17.12,44.42,42.64s-18.74,42.48-44.42,42.48-44.58-16.96-44.58-42.48,18.74-42.64,44.58-42.64ZM629.26,286.45c11.47,0,19.38-8.08,19.38-20.35s-7.91-20.19-19.38-20.19-19.54,8.08-19.54,20.19,7.91,20.35,19.54,20.35Z" className="fill-foreground"/>
        </svg>
      </div>

      {/* Dots animados */}
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--logo-accent))]"
            style={{
              animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
              opacity: 0.3,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}