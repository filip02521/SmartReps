import {
  Trophy,
  CalendarCheck,
  Crosshair,
  TrendingUp,
} from 'lucide-react'
import { pl } from '@/i18n/pl'
import type { Program } from '@/data/plans/types'
import type { ChallengeType } from '@/lib/weekly-challenge'

export function daysUntil(endDate: string): number {
  const end = new Date(endDate).getTime()
  const now = Date.now()
  return Math.ceil((end - now) / 86400000)
}

export function programLabel(program: Program): string {
  switch (program) {
    case 'pushups': return pl.pushupsProgram
    case 'pullups': return pl.pullupsProgram
    case 'squats': return pl.squatsProgram
  }
}

export const TYPE_ICON: Record<ChallengeType, typeof Trophy> = {
  volume: Trophy,
  consistency: CalendarCheck,
  precision: Crosshair,
  personal_best: TrendingUp,
}

export const TYPE_COLOR: Record<ChallengeType, string> = {
  volume: 'var(--sr-brand-primary)',
  consistency: 'var(--sr-info)',
  precision: 'var(--sr-success)',
  personal_best: 'var(--sr-warning)',
}

export function typeTitle(type: ChallengeType): string {
  switch (type) {
    case 'volume': return pl.challengeTypeVolume
    case 'consistency': return pl.challengeTypeConsistency
    case 'precision': return pl.challengeTypePrecision
    case 'personal_best': return pl.challengeTypePersonalBest
  }
}

export function typeDescription(type: ChallengeType): string {
  switch (type) {
    case 'volume': return pl.challengeDescVolume
    case 'consistency': return pl.challengeDescConsistency
    case 'precision': return pl.challengeDescPrecision
    case 'personal_best': return pl.challengeDescPersonalBest
  }
}

export function progressLabel(type: ChallengeType, current: number, target: number): string {
  if (type === 'consistency') return pl.challengeProgressSessions(current, target)
  if (type === 'personal_best') return pl.challengeProgressPersonalBest(current, target)
  if (type === 'precision') return pl.challengeProgressCount(current, target)
  return pl.challengeProgressReps(current, target)
}

export const MEDAL_CLASS: Record<number, string> = {
  1: 'text-[var(--sr-warning)]',
  2: 'text-[var(--sr-text-secondary)]',
  3: 'text-[var(--sr-bronze)]',
}
