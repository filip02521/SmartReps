import type { Program } from '@/data/plans/types'
import { Dumbbell, Grip, Footprints, type LucideIcon } from 'lucide-react'

const accentVar: Record<Program, string> = {
  pushups: 'var(--sr-pushups-accent)',
  pullups: 'var(--sr-pullups-accent)',
  squats: 'var(--sr-squats-accent)',
}

const accentLight: Record<Program, string> = {
  pushups: 'var(--sr-pushups-accent-muted)',
  pullups: 'var(--sr-pullups-accent-muted)',
  squats: 'var(--sr-squats-accent-muted)',
}

/**
 * Program icons — uses Lucide icon library for professional, consistent icons.
 * Each exercise gets a distinct icon that's immediately recognizable:
 *   pushups: Dumbbell (strength training, upper body)
 *   pullups: Grip (grip strength, hanging from bar)
 *   squats: Footprints (legs, stance, ground contact)
 *
 * Lucide icons are the same library used throughout the app, so these icons
 * are visually consistent with the rest of the UI.
 */
const iconMap: Record<Program, LucideIcon> = {
  pushups: Dumbbell,
  pullups: Grip,
  squats: Footprints,
}

export function ProgramIcon({
  program,
  size = 20,
  className,
}: {
  program: Program
  size?: number
  className?: string
}) {
  const Icon = iconMap[program]
  return <Icon width={size} height={size} className={className} aria-hidden />
}

export function programAccent(program: Program): string {
  return accentVar[program]
}

export function programAccentMuted(program: Program): string {
  return accentLight[program]
}
