/**
 * ExerciseFigure — animated exercise demonstration using MP4 video.
 *
 * Uses video from free-exercise-db-with-videos (MIT License, © 2026 Arham Wani).
 * https://github.com/harshvishu/free-exercise-db-with-videos
 *
 * Falls back to 3-frame PNG crossfade (bryllim/Everkinetic, CC BY-SA 4.0)
 * when no video is available for the exercise.
 *
 * Video: autoplay, loop, muted, playsInline — plays continuously.
 * Respects prefers-reduced-motion (shows static PNG frame instead).
 */
import { memo, useState, useEffect, useRef } from 'react'
import type { DemoAnimationKey } from '@/lib/exercise-demo'

function getVideoUrl(slug: string): string {
  return `${import.meta.env.BASE_URL}exercises/${slug}/demo.mp4`
}

function getFrameUrl(slug: string, frame: number): string {
  return `${import.meta.env.BASE_URL}exercises/${slug}/frame-${frame}.png`
}

/**
 * Slugs that have MP4 video available.
 * If a slug is NOT in this set, we skip video entirely and use PNG fallback.
 */
const SLUGS_WITH_VIDEO = new Set([
  'arnold-press', 'barbell-row', 'barbell-shrug', 'bench-press', 'bicep-curl',
  'burpee', 'clean-and-press', 'close-grip-bench-press', 'concentration-curl',
  'crunch', 'cycling', 'deadlift', 'decline-bench-press', 'dip',
  'dumbbell-fly', 'dumbbell-row', 'dumbbell-skull-crusher', 'elliptical',
  'ez-bar-curl', 'front-raise', 'front-squat', 'goblet-squat', 'hammer-curl',
  'hanging-leg-raise', 'hip-thrust', 'incline-bench-press',
  'incline-dumbbell-curl', 'jump-rope', 'jumping-jack', 'lat-pulldown',
  'lateral-raise', 'leg-extension', 'leg-press', 'lying-leg-raise',
  'lying-leg-curl', 'overhead-press', 'overhead-tricep-extension', 'pec-deck-fly',
  'plank', 'preacher-curl', 'pull-up', 'push-up', 'rear-delt-fly',
  'reverse-crunch', 'romanian-deadlift', 'running', 'russian-twist',
  'seated-row', 'side-plank', 'squat', 'standing-calf-raise', 'step-up',
  'straight-arm-pulldown', 'tbar-row', 'tricep-kickback', 'tricep-pushdown',
  'upright-row', 'walking-lunge', 'wide-push-up',
])

/** Ease-in-out (cubic) */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

const FRAME_SEQUENCE = [1, 2, 3, 2]
const TRANSITION_MS = 900
const HOLD_MS = 200
const STEP_MS = TRANSITION_MS + HOLD_MS
const TOTAL_MS = STEP_MS * FRAME_SEQUENCE.length

export const ExerciseFigure = memo(function ExerciseFigure({
  demoKey,
  paused = false,
}: {
  demoKey: DemoAnimationKey
  paused?: boolean
}) {
  const hasVideoAsset = SLUGS_WITH_VIDEO.has(demoKey)
  const [videoError, setVideoError] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const rafRef = useRef<number>(0)
  const startTimeRef = useRef<number>(0)
  const [frameState, setFrameState] = useState({
    fromFrame: 1,
    toFrame: 2,
    progress: 0,
  })

  // Respect prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Reset error state when demoKey changes
  useEffect(() => {
    setVideoError(false)
  }, [demoKey])

  // Video play/pause control
  useEffect(() => {
    const video = videoRef.current
    if (!video || videoError || !hasVideoAsset) return

    if (paused || reducedMotion) {
      video.pause()
    } else {
      video.play().catch(() => {
        setVideoError(true)
      })
    }
  }, [paused, reducedMotion, videoError, demoKey, hasVideoAsset])

  // PNG crossfade animation loop (fallback only)
  useEffect(() => {
    if (hasVideoAsset && !videoError) return // Video mode — no PNG animation needed
    if (reducedMotion || paused) {
      setFrameState({ fromFrame: 2, toFrame: 2, progress: 1 })
      return
    }

    startTimeRef.current = performance.now()

    const tick = (now: number) => {
      const elapsed = (now - startTimeRef.current) % TOTAL_MS
      const stepIndex = Math.floor(elapsed / STEP_MS)
      const stepElapsed = elapsed - stepIndex * STEP_MS
      const fromFrame = FRAME_SEQUENCE[stepIndex]
      const toFrame = FRAME_SEQUENCE[(stepIndex + 1) % FRAME_SEQUENCE.length]

      if (stepElapsed < TRANSITION_MS) {
        const progress = easeInOutCubic(stepElapsed / TRANSITION_MS)
        setFrameState({ fromFrame, toFrame, progress })
      } else {
        setFrameState({ fromFrame: toFrame, toFrame, progress: 1 })
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [hasVideoAsset, videoError, paused, reducedMotion])

  // --- VIDEO MODE ---
  if (hasVideoAsset && !videoError && !reducedMotion) {
    return (
      <div className="relative h-full w-full overflow-hidden rounded-[var(--sr-radius-sm)] bg-[var(--sr-bg-surface)]">
        <video
          ref={videoRef}
          src={getVideoUrl(demoKey)}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          onError={() => setVideoError(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
    )
  }

  // --- REDUCED MOTION: static frame ---
  if (reducedMotion) {
    return (
      <div className="relative h-full w-full overflow-hidden rounded-[var(--sr-radius-sm)] bg-[var(--sr-bg-surface)]">
        <img
          src={getFrameUrl(demoKey, 2)}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-contain"
        />
      </div>
    )
  }

  // --- PNG CROSSFADE FALLBACK ---
  const { fromFrame, toFrame, progress } = frameState
  const fromOpacity = 1 - progress
  const toOpacity = progress
  const fromScale = 1 + progress * 0.015
  const toScale = 1 - progress * 0.015

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[var(--sr-radius-sm)] bg-[var(--sr-bg-surface)]">
      <img
        src={getFrameUrl(demoKey, fromFrame)}
        alt=""
        aria-hidden
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-contain"
        style={{
          opacity: fromOpacity,
          transform: `scale(${fromScale})`,
          willChange: 'opacity, transform',
        }}
      />
      <img
        src={getFrameUrl(demoKey, toFrame)}
        alt=""
        aria-hidden
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-contain"
        style={{
          opacity: toOpacity,
          transform: `scale(${toScale})`,
          willChange: 'opacity, transform',
        }}
      />
    </div>
  )
})
