import {
  Trophy,
  CalendarCheck,
  Crosshair,
  TrendingUp,
  Flag,
  Zap,
  Repeat,
  CalendarDays,
  Sunrise,
  Moon,
  Palmtree,
  Layers,
  Gem,
  Rocket,
  ChevronsUp,
  Swords,
  CheckCircle2,
  PlayCircle,
  Mountain,
  CalendarClock,
  Sun,
  Sandwich,
  Sunset,
  RotateCw,
  Droplets,
  Crown,
  BadgeCheck,
  Target,
  RotateCcw,
  Metronome,
  Award,
  Medal,
  Star,
  Gauge,
} from 'lucide-react'
import { pl } from '@/i18n/pl'
import type { Program } from '@/data/plans/types'
import { challengeRequiredWeekday } from '@/lib/weekly-challenge'
import type { ChallengeType, ChallengeCategory } from '@/lib/weekly-challenge'

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
  marathon: Flag,
  max_set: Zap,
  grinder: Repeat,
  surplus: ChevronsUp,
  dominator: Swords,
  strong_finish: CheckCircle2,
  session_starter: PlayCircle,
  big_day: Mountain,
  consistency: CalendarCheck,
  daily: CalendarDays,
  early_bird: Sunrise,
  night_owl: Moon,
  weekend: Palmtree,
  double: Layers,
  weekday_quest: CalendarClock,
  morning_moves: Sun,
  lunch_break: Sandwich,
  evening_shift: Sunset,
  around_the_clock: RotateCw,
  sunday_sweat: Droplets,
  precision: Crosshair,
  perfect_pair: Gem,
  hat_trick: Crown,
  flawless_sets: BadgeCheck,
  sharpshooter: Target,
  bounce_back: RotateCcw,
  metronome: Metronome,
  personal_best: TrendingUp,
  improvement: Rocket,
  volume_record: Award,
  session_record: Medal,
  day_record: Star,
  beat_average: Gauge,
}

export const TYPE_COLOR: Record<ChallengeType, string> = {
  volume: 'var(--sr-brand-primary)',
  marathon: 'var(--sr-error)',
  max_set: 'var(--sr-warning)',
  grinder: 'var(--sr-bronze)',
  surplus: 'var(--sr-success)',
  dominator: 'var(--sr-error)',
  strong_finish: 'var(--sr-success)',
  session_starter: 'var(--sr-brand-secondary)',
  big_day: 'var(--sr-brand-primary)',
  consistency: 'var(--sr-info)',
  daily: 'var(--sr-brand-secondary)',
  early_bird: 'var(--sr-warning)',
  night_owl: 'var(--sr-brand-primary)',
  weekend: 'var(--sr-success)',
  double: 'var(--sr-brand-secondary)',
  weekday_quest: 'var(--sr-info)',
  morning_moves: 'var(--sr-warning)',
  lunch_break: 'var(--sr-bronze)',
  evening_shift: 'var(--sr-brand-primary)',
  around_the_clock: 'var(--sr-info)',
  sunday_sweat: 'var(--sr-brand-secondary)',
  precision: 'var(--sr-success)',
  perfect_pair: 'var(--sr-brand-secondary)',
  hat_trick: 'var(--sr-warning)',
  flawless_sets: 'var(--sr-success)',
  sharpshooter: 'var(--sr-error)',
  bounce_back: 'var(--sr-info)',
  metronome: 'var(--sr-brand-secondary)',
  personal_best: 'var(--sr-warning)',
  improvement: 'var(--sr-success)',
  volume_record: 'var(--sr-warning)',
  session_record: 'var(--sr-brand-primary)',
  day_record: 'var(--sr-error)',
  beat_average: 'var(--sr-success)',
}

export function typeTitle(type: ChallengeType): string {
  switch (type) {
    case 'volume': return pl.challengeTypeVolume
    case 'marathon': return pl.challengeTypeMarathon
    case 'max_set': return pl.challengeTypeMaxSet
    case 'grinder': return pl.challengeTypeGrinder
    case 'surplus': return pl.challengeTypeSurplus
    case 'dominator': return pl.challengeTypeDominator
    case 'strong_finish': return pl.challengeTypeStrongFinish
    case 'session_starter': return pl.challengeTypeSessionStarter
    case 'big_day': return pl.challengeTypeBigDay
    case 'consistency': return pl.challengeTypeConsistency
    case 'daily': return pl.challengeTypeDaily
    case 'early_bird': return pl.challengeTypeEarlyBird
    case 'night_owl': return pl.challengeTypeNightOwl
    case 'weekend': return pl.challengeTypeWeekend
    case 'double': return pl.challengeTypeDouble
    case 'weekday_quest': return pl.challengeTypeWeekdayQuest
    case 'morning_moves': return pl.challengeTypeMorningMoves
    case 'lunch_break': return pl.challengeTypeLunchBreak
    case 'evening_shift': return pl.challengeTypeEveningShift
    case 'around_the_clock': return pl.challengeTypeAroundTheClock
    case 'sunday_sweat': return pl.challengeTypeSundaySweat
    case 'precision': return pl.challengeTypePrecision
    case 'perfect_pair': return pl.challengeTypePerfectPair
    case 'hat_trick': return pl.challengeTypeHatTrick
    case 'flawless_sets': return pl.challengeTypeFlawlessSets
    case 'sharpshooter': return pl.challengeTypeSharpshooter
    case 'bounce_back': return pl.challengeTypeBounceBack
    case 'metronome': return pl.challengeTypeMetronome
    case 'personal_best': return pl.challengeTypePersonalBest
    case 'improvement': return pl.challengeTypeImprovement
    case 'volume_record': return pl.challengeTypeVolumeRecord
    case 'session_record': return pl.challengeTypeSessionRecord
    case 'day_record': return pl.challengeTypeDayRecord
    case 'beat_average': return pl.challengeTypeBeatAverage
  }
}

/** Full localized description. `startsAt` is required — weekday_quest derives
 *  its drawn weekday from the challenge's week start. */
export function typeDescription(type: ChallengeType, target: number, startsAt: string): string {
  switch (type) {
    case 'volume': return pl.challengeDescVolume
    case 'marathon': return pl.challengeDescMarathon(target)
    case 'max_set': return pl.challengeDescMaxSet(target)
    case 'grinder': return pl.challengeDescGrinder(target)
    case 'surplus': return pl.challengeDescSurplus(target)
    case 'dominator': return pl.challengeDescDominator
    case 'strong_finish': return pl.challengeDescStrongFinish
    case 'session_starter': return pl.challengeDescSessionStarter
    case 'big_day': return pl.challengeDescBigDay(target)
    case 'consistency': return pl.challengeDescConsistency(target)
    case 'daily': return pl.challengeDescDaily(target)
    case 'early_bird': return pl.challengeDescEarlyBird
    case 'night_owl': return pl.challengeDescNightOwl
    case 'weekend': return pl.challengeDescWeekend
    case 'double': return pl.challengeDescDouble
    case 'weekday_quest': {
      const day = pl.challengeWeekdayPhrases[challengeRequiredWeekday(startsAt) - 1]
      return pl.challengeDescWeekdayQuest(day)
    }
    case 'morning_moves': return pl.challengeDescMorningMoves
    case 'lunch_break': return pl.challengeDescLunchBreak
    case 'evening_shift': return pl.challengeDescEveningShift
    case 'around_the_clock': return pl.challengeDescAroundTheClock
    case 'sunday_sweat': return pl.challengeDescSundaySweat
    case 'precision': return pl.challengeDescPrecision
    case 'perfect_pair': return pl.challengeDescPerfectPair(target)
    case 'hat_trick': return pl.challengeDescHatTrick(target)
    case 'flawless_sets': return pl.challengeDescFlawlessSets(target)
    case 'sharpshooter': return pl.challengeDescSharpshooter
    case 'bounce_back': return pl.challengeDescBounceBack
    case 'metronome': return pl.challengeDescMetronome
    case 'personal_best': return pl.challengeDescPersonalBest
    case 'improvement': return pl.challengeDescImprovement(target)
    case 'volume_record': return pl.challengeDescVolumeRecord
    case 'session_record': return pl.challengeDescSessionRecord
    case 'day_record': return pl.challengeDescDayRecord
    case 'beat_average': return pl.challengeDescBeatAverage
  }
}

export function categoryLabel(category: ChallengeCategory): string {
  switch (category) {
    case 'power': return pl.challengeCatPower
    case 'habit': return pl.challengeCatHabit
    case 'skill': return pl.challengeCatSkill
    case 'records': return pl.challengeCatRecords
  }
}

export function progressLabel(type: ChallengeType, current: number, target: number): string {
  switch (type) {
    case 'consistency':
    case 'perfect_pair':
    case 'hat_trick':
      return pl.challengeProgressSessions(current, target)
    case 'daily':
      return pl.challengeProgressDays(current, target)
    case 'grinder':
    case 'flawless_sets':
      return pl.challengeProgressSets(current, target)
    case 'improvement':
      return pl.challengeProgressImprovement(current, target)
    case 'personal_best':
    case 'volume_record':
    case 'session_record':
    case 'day_record':
    case 'beat_average':
      return pl.challengeProgressPersonalBest(current, target)
    case 'volume':
    case 'marathon':
    case 'max_set':
    case 'surplus':
    case 'big_day':
      return pl.challengeProgressReps(current, target)
    default:
      // Binary/count habit + skill types — early_bird, night_owl, weekend,
      // double, weekday_quest, morning_moves, lunch_break, evening_shift,
      // around_the_clock, sunday_sweat, precision, dominator, strong_finish,
      // session_starter, sharpshooter, bounce_back, metronome
      return pl.challengeProgressCount(current, target)
  }
}

export const MEDAL_CLASS: Record<number, string> = {
  1: 'text-[var(--sr-warning)]',
  2: 'text-[var(--sr-text-secondary)]',
  3: 'text-[var(--sr-bronze)]',
}
