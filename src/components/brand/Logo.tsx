export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
      <circle cx="20" cy="20" r="18" stroke="url(#grad)" strokeWidth="3" strokeDasharray="8 4" />
      <text x="20" y="25" textAnchor="middle" fill="var(--sr-brand-primary)" fontSize="14" fontWeight="700" fontFamily="var(--sr-font)">R</text>
      <defs>
        <linearGradient id="grad" x1="0" y1="0" x2="40" y2="40">
          <stop stopColor="var(--sr-brand-primary)" />
          <stop offset="1" stopColor="var(--sr-brand-secondary)" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export function LogoFull({ height = 28 }: { height?: number }) {
  return (
    <div className="flex items-center gap-2" style={{ height }}>
      <LogoMark size={height} />
      <span className="text-lg font-bold tracking-tight">
        <span className="font-normal text-[var(--sr-text-primary)]">Smart</span>
        <span className="sr-gradient-text">Reps</span>
      </span>
    </div>
  )
}
