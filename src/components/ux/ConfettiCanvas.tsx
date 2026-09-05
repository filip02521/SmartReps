import { useEffect, useRef } from 'react'

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  rotation: number
  rotationSpeed: number
  size: number
  color: string
  shape: 'rect' | 'circle'
  life: number
  maxLife: number
}

const CONFETTI_COLORS = [
  'var(--sr-brand-primary)',
  'var(--sr-success)',
  'var(--sr-warning)',
  'var(--sr-pushups-accent)',
  'var(--sr-brand-primary-muted)',
]

/**
 * Canvas-based confetti burst — lightweight, GPU-accelerated.
 * Respects prefers-reduced-motion (renders nothing).
 * Auto-cleans up after particles expire.
 */
export function ConfettiCanvas({
  active,
  durationMs = 2500,
  particleCount = 80,
  origin = { x: 0.5, y: 0.3 },
}: {
  active: boolean
  durationMs?: number
  particleCount?: number
  origin?: { x: number; y: number }
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | undefined>(undefined)
  const particlesRef = useRef<Particle[]>([])
  const startTimeRef = useRef<number>(0)

  useEffect(() => {
    if (!active) return

    // Respect reduced motion — no confetti
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      ctx.scale(dpr, dpr)
    }
    resize()
    window.addEventListener('resize', resize)

    // Resolve CSS color variables to actual colors
    const style = getComputedStyle(document.documentElement)
    const resolveColor = (cssVar: string): string => {
      const value = style.getPropertyValue(cssVar.replace('var(', '').replace(')', '').trim()).trim()
      return value || cssVar
    }
    const colors = CONFETTI_COLORS.map(resolveColor)

    // Initialize particles
    const originX = window.innerWidth * origin.x
    const originY = window.innerHeight * origin.y
    particlesRef.current = Array.from({ length: particleCount }, () => {
      const angle = Math.random() * Math.PI * 2
      const speed = 3 + Math.random() * 6
      return {
        x: originX + (Math.random() - 0.5) * 40,
        y: originY + (Math.random() - 0.5) * 40,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 4, // bias upward
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.3,
        size: 6 + Math.random() * 8,
        color: colors[Math.floor(Math.random() * colors.length)] ?? colors[0]!,
        shape: Math.random() > 0.5 ? 'rect' : 'circle',
        life: 0,
        maxLife: 60 + Math.random() * 40,
      }
    })

    startTimeRef.current = performance.now()

    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const particles = particlesRef.current
      let alive = 0

      for (const p of particles) {
        if (p.life >= p.maxLife) continue
        alive++

        // Physics
        p.vy += 0.15 // gravity
        p.vx *= 0.99 // air resistance
        p.x += p.vx
        p.y += p.vy
        p.rotation += p.rotationSpeed
        p.life += 1

        // Fade out in last 30% of life
        const lifeRatio = p.life / p.maxLife
        const alpha = lifeRatio > 0.7 ? 1 - (lifeRatio - 0.7) / 0.3 : 1

        ctx.save()
        ctx.globalAlpha = alpha
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.fillStyle = p.color

        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
        } else {
          ctx.beginPath()
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2)
          ctx.fill()
        }

        ctx.restore()
      }

      if (alive > 0 && elapsed < durationMs) {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        // Clear canvas when done
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current)
          animationRef.current = undefined
        }
      }
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('resize', resize)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = undefined
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [active, durationMs, particleCount, origin.x, origin.y])

  if (!active) return null

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[100]"
      style={{ width: '100vw', height: '100vh' }}
    />
  )
}
