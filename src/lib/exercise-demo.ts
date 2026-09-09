/**
 * Maps exercise definitions to illustration slugs.
 * Uses @bryllim/workout-guide (CC BY-SA 4.0) frame illustrations.
 * Each exercise has 3 frames (start, middle, end) that we animate via CSS.
 */
import type { ExerciseDefinition, ExerciseStarterKey } from '@/lib/exercise-model'
import { EXERCISE_STARTERS } from '@/lib/exercise-model'
import { pl } from '@/i18n/pl'

/** Build a reverse map: lowercase name → starter key */
const NAME_TO_KEY: Map<string, ExerciseStarterKey> = (() => {
  const map = new Map<string, ExerciseStarterKey>()
  const labels: Record<ExerciseStarterKey, string> = {
    pushups: pl.exerciseStarterPushups,
    pullups: pl.exerciseStarterPullups,
    squats: pl.exerciseStarterSquats,
    plank: pl.exerciseStarterPlank,
    sidePlank: pl.exerciseStarterSidePlank,
    press: pl.exerciseStarterPress,
    benchPress: pl.exerciseStarterBenchPress,
    inclineBenchPress: pl.exerciseStarterInclineBenchPress,
    dumbbellFlyes: pl.exerciseStarterDumbbellFlyes,
    dips: pl.exerciseStarterDips,
    pushupWide: pl.exerciseStarterPushupWide,
    declineBenchPress: pl.exerciseStarterDeclineBenchPress,
    pecDeck: pl.exerciseStarterPecDeck,
    barbellRow: pl.exerciseStarterBarbellRow,
    latPulldown: pl.exerciseStarterLatPulldown,
    deadlift: pl.exerciseStarterDeadlift,
    seatedRow: pl.exerciseStarterSeatedRow,
    facePulls: pl.exerciseStarterFacePulls,
    dumbbellRow: pl.exerciseStarterDumbbellRow,
    tbarRow: pl.exerciseStarterTbarRow,
    straightArmPulldown: pl.exerciseStarterStraightArmPulldown,
    shrug: pl.exerciseStarterShrug,
    overheadPress: pl.exerciseStarterOverheadPress,
    lateralRaise: pl.exerciseStarterLateralRaise,
    frontRaise: pl.exerciseStarterFrontRaise,
    rearDeltFlyes: pl.exerciseStarterRearDeltFlyes,
    arnoldPress: pl.exerciseStarterArnoldPress,
    uprightRow: pl.exerciseStarterUprightRow,
    barbellCurl: pl.exerciseStarterBarbellCurl,
    dumbbellCurl: pl.exerciseStarterDumbbellCurl,
    hammerCurl: pl.exerciseStarterHammerCurl,
    tricepPushdown: pl.exerciseStarterTricepPushdown,
    skullCrusher: pl.exerciseStarterSkullCrusher,
    closeGripBench: pl.exerciseStarterCloseGripBench,
    concentrationCurl: pl.exerciseStarterConcentrationCurl,
    preacherCurl: pl.exerciseStarterPreacherCurl,
    overheadTricepExtension: pl.exerciseStarterOverheadTricepExtension,
    tricepKickback: pl.exerciseStarterTricepKickback,
    legPress: pl.exerciseStarterLegPress,
    lunges: pl.exerciseStarterLunges,
    romanianDeadlift: pl.exerciseStarterRomanianDeadlift,
    legExtension: pl.exerciseStarterLegExtension,
    legCurl: pl.exerciseStarterLegCurl,
    calfRaise: pl.exerciseStarterCalfRaise,
    gobletSquat: pl.exerciseStarterGobletSquat,
    hipThrust: pl.exerciseStarterHipThrust,
    frontSquat: pl.exerciseStarterFrontSquat,
    stepUp: pl.exerciseStarterStepUp,
    crunches: pl.exerciseStarterCrunches,
    hangingLegRaise: pl.exerciseStarterHangingLegRaise,
    russianTwist: pl.exerciseStarterRussianTwist,
    mountainClimbers: pl.exerciseStarterMountainClimbers,
    deadBug: pl.exerciseStarterDeadBug,
    reverseCrunch: pl.exerciseStarterReverseCrunch,
    lyingLegRaise: pl.exerciseStarterLyingLegRaise,
    burpees: pl.exerciseStarterBurpees,
    kettlebellSwing: pl.exerciseStarterKettlebellSwing,
    thrusters: pl.exerciseStarterThrusters,
    cleanAndPress: pl.exerciseStarterCleanAndPress,
    stairClimbing: pl.exerciseStarterStairClimbing,
    running: pl.exerciseStarterRunning,
    cycling: pl.exerciseStarterCycling,
    rowingMachine: pl.exerciseStarterRowingMachine,
    elliptical: pl.exerciseStarterElliptical,
    jumpRope: pl.exerciseStarterJumpRope,
    jumpingJacks: pl.exerciseStarterJumpingJacks,
    highKnees: pl.exerciseStarterHighKnees,
  }
  for (const starter of EXERCISE_STARTERS) {
    map.set(labels[starter.key].toLowerCase(), starter.key)
  }
  return map
})()

/**
 * Illustration slug — maps to a directory in /exercises/{slug}/
 * containing frame-1.png, frame-2.png, frame-3.png.
 */
export type DemoAnimationKey = string

/** Map starter keys to illustration slugs (@bryllim/workout-guide). */
const STARTER_TO_SLUG: Partial<Record<ExerciseStarterKey, string>> = {
  pushups: 'push-up',
  pushupWide: 'wide-push-up',
  declineBenchPress: 'decline-bench-press',
  pecDeck: 'pec-deck-fly',
  pullups: 'pull-up',
  squats: 'squat',
  gobletSquat: 'goblet-squat',
  plank: 'plank',
  sidePlank: 'side-plank',
  lunges: 'walking-lunge',
  dips: 'dip',
  burpees: 'burpee',
  jumpingJacks: 'jumping-jack',
  jumpRope: 'jump-rope',
  running: 'running',
  cycling: 'cycling',
  benchPress: 'bench-press',
  inclineBenchPress: 'incline-bench-press',
  overheadPress: 'overhead-press',
  arnoldPress: 'arnold-press',
  uprightRow: 'upright-row',
  closeGripBench: 'close-grip-bench-press',
  concentrationCurl: 'concentration-curl',
  preacherCurl: 'preacher-curl',
  overheadTricepExtension: 'overhead-tricep-extension',
  tricepKickback: 'tricep-kickback',
  press: 'overhead-press',
  barbellRow: 'barbell-row',
  latPulldown: 'lat-pulldown',
  seatedRow: 'seated-row',
  dumbbellFlyes: 'dumbbell-fly',
  lateralRaise: 'lateral-raise',
  frontRaise: 'front-raise',
  rearDeltFlyes: 'rear-delt-fly',
  facePulls: 'face-pull',
  dumbbellRow: 'dumbbell-row',
  tbarRow: 'tbar-row',
  straightArmPulldown: 'straight-arm-pulldown',
  shrug: 'barbell-shrug',
  barbellCurl: 'ez-bar-curl',
  dumbbellCurl: 'bicep-curl',
  hammerCurl: 'hammer-curl',
  tricepPushdown: 'tricep-pushdown',
  skullCrusher: 'dumbbell-skull-crusher',
  crunches: 'crunch',
  hangingLegRaise: 'hanging-leg-raise',
  russianTwist: 'russian-twist',
  mountainClimbers: 'mountain-climber',
  deadBug: 'dead-bug',
  reverseCrunch: 'reverse-crunch',
  lyingLegRaise: 'lying-leg-raise',
  deadlift: 'deadlift',
  romanianDeadlift: 'romanian-deadlift',
  legPress: 'leg-press',
  legExtension: 'leg-extension',
  legCurl: 'lying-leg-curl',
  calfRaise: 'standing-calf-raise',
  hipThrust: 'hip-thrust',
  frontSquat: 'front-squat',
  stepUp: 'step-up',
  kettlebellSwing: 'kettlebell-swing',
  thrusters: 'thruster',
  cleanAndPress: 'clean-and-press',
  stairClimbing: 'stair-climber',
  rowingMachine: 'rowing',
  elliptical: 'elliptical',
  highKnees: 'high-knees',
}

/** All available illustration slugs (for preview page). */
export const ALL_DEMO_SLUGS = Array.from(new Set(Object.values(STARTER_TO_SLUG))).sort()

/** Resolve which illustration slug to show for a given exercise. */
export function getDemoAnimationKey(exercise: ExerciseDefinition | null | undefined): DemoAnimationKey | null {
  if (!exercise) return null
  // Try name-based matching for starter exercises
  const name = exercise.name.trim().toLowerCase()
  const starterKey = NAME_TO_KEY.get(name)
  if (starterKey) {
    return STARTER_TO_SLUG[starterKey] ?? null
  }
  // Try fuzzy matching for common exercise name patterns
  // Order matters: more specific patterns first to avoid false positives
  if (name.includes('rower') || name.includes('cycl')) return 'cycling'
  if (name.includes('face pull') || name.includes('facepull')) return 'face-pull'
  if (name.includes('francuskie') || name.includes('skull crusher') || name.includes('skullcrusher')) return 'dumbbell-skull-crusher'
  if (name.includes('pompk') || name.includes('push')) return 'push-up'
  if (name.includes('podcią') || name.includes('pull')) return 'pull-up'
  if (name.includes('przysi') || name.includes('squat')) return 'squat'
  if (name.includes('deska') || name.includes('plank')) return 'plank'
  if (name.includes('wykrok') || name.includes('lunge')) return 'forward-lunge'
  if (name.includes('dip')) return 'dip'
  if (name.includes('burpee')) return 'burpee'
  if (name.includes('skos') && name.includes('hantl') && name.includes('uginanie')) return 'incline-dumbbell-curl'
  if (name.includes('curl') || name.includes('biceps') || name.includes('uginanie')) return 'bicep-curl'
  if (name.includes('press') || name.includes('wycisk')) return 'overhead-press'
  if (name.includes('wiosł') || name.includes(' row') || name.includes('-row')) return 'barbell-row'
  if (name.includes('raise') || name.includes('wznos')) return 'lateral-raise'
  if (name.includes('crunch') || name.includes('spięci')) return 'crunch'
  if (name.includes('jumping jack') || name.includes('pajacyk')) return 'jumping-jack'
  if (name.includes('skakanka') || name.includes('jump rope')) return 'jump-rope'
  if (name.includes('bieg') || name.includes('run')) return 'running'
  return null
}
