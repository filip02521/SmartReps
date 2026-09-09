import { db } from '@/lib/db'
import {
  EXERCISE_STARTERS,
  type CustomPlan,
  type ExerciseDefinition,
  type ExerciseStarterKey,
  type PlanDay,
  type PlannedExercise,
} from '@/lib/exercise-model'
import {
  ensureDefaultExercises,
  listCustomPlans,
  saveCustomPlan,
} from '@/lib/custom-plan-service'
import { findActiveExerciseByDedupKey } from '@/lib/custom-exercise-dedup'
import { generateId } from '@/lib/utils'
import { useAppStore } from '@/stores/app-store'
import { track, AnalyticsEvents } from '@/lib/analytics'
import { pl } from '@/i18n/pl'
import type { StarterTemplate } from '@/data/starter-templates'

export {
  STARTER_TEMPLATES,
  getStarterTemplate,
  STARTER_TEMPLATE_CATEGORIES,
  starterTemplateEstimatedWeeks,
} from '@/data/starter-templates'
export type {
  StarterTemplate,
  StarterTemplateCategory,
  StarterTemplateDifficulty,
  StarterTemplateEquipment,
  StarterTemplateDay,
  StarterTemplateExerciseRef,
} from '@/data/starter-templates'

/** Mapa starterKey → zlokalizowana nazwa (jak STARTER_LABELS w custom-plan-service). */
const STARTER_LABELS: Record<ExerciseStarterKey, string> = EXERCISE_STARTERS.reduce(
  (acc, s) => {
    const key = `exerciseStarter${s.key.charAt(0).toUpperCase()}${s.key.slice(1)}` as keyof typeof pl
    acc[s.key] = pl[key] as string
    return acc
  },
  {} as Record<ExerciseStarterKey, string>,
)

/** Konwertuje templateId (kebab-case) na camelCase suffix dla klucza i18n. */
function templateIdToCamel(id: string): string {
  return id.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase())
}

/** Mapa templateId → zlokalizowana nazwa. */
export function starterTemplateName(template: StarterTemplate): string {
  const key = `starterTemplateName_${templateIdToCamel(template.id)}` as keyof typeof pl
  return pl[key] as string
}

/** Mapa templateId → zlokalizowany opis. */
export function starterTemplateDescription(template: StarterTemplate): string {
  const key = `starterTemplateDesc_${templateIdToCamel(template.id)}` as keyof typeof pl
  return pl[key] as string
}

/**
 * Materializuje szablon startowy do lokalnego CustomPlan.
 *
 * Kluczowe różnice vs importCommunityPublication:
 *  - Ćwiczenia matchowane po nazwie — zero duplikatów (reuse starter exercises)
 *  - source: 'starter' (nie 'community')
 *  - Brak communityPublicationId (uuid) — to NIE jest publikacja społecznościowa
 *  - Brak recordCommunityImport — nie liczy się jako import z katalogu
 *  - Brak wymaganego online — działa offline
 */
export async function materializeStarterTemplate(
  template: StarterTemplate,
): Promise<CustomPlan> {
  // 1. Upewnij się, że starter exercises są zseedowane (idempotentne).
  await ensureDefaultExercises()

  // 2. Mapa: starterKey → istniejące ćwiczenie.
  //    Najpierw match po nazwie (zachowuje user customization).
  //    Fallback: findActiveExerciseByDedupKey (nazwa + primaryMetric).
  const existingExercises = await db.exercises.toArray()
  const byStarterKey = new Map<ExerciseStarterKey, ExerciseDefinition>()
  for (const starter of EXERCISE_STARTERS) {
    const name = STARTER_LABELS[starter.key]
    const match = existingExercises.find(
      (ex) => !ex.archived && ex.name.trim().toLowerCase() === name.trim().toLowerCase(),
    )
    if (match) {
      byStarterKey.set(starter.key, match)
    } else {
      // Fallback: dedup key (nazwa + primaryMetric) — działa gdy user zmienił nazwę.
      const dedup = await findActiveExerciseByDedupKey(name, starter.primaryMetric)
      if (dedup) byStarterKey.set(starter.key, dedup)
    }
  }

  // 3. Zbuduj dni planu z remapem exerciseId.
  //    Walidacja: jeśli ćwiczenie nie istnieje, rzuć błąd (nie twórz planu z pustymi dniami).
  const missingKeys: ExerciseStarterKey[] = []
  const days: PlanDay[] = template.days.map((day) => ({
    dayNumber: day.dayNumber,
    restAfterDay: day.restAfterDay,
    groups: day.groups,
    exercises: day.exercises
      .map((pe): PlannedExercise | null => {
        const ex = byStarterKey.get(pe.starterKey)
        if (!ex) {
          missingKeys.push(pe.starterKey)
          return null
        }
        return {
          exerciseId: ex.id,
          order: 0,
          sets: pe.sets,
          restBetweenSetsSec: pe.restBetweenSetsSec,
          restAfterExerciseSec: pe.restAfterExerciseSec,
          note: pe.note,
          groupId: pe.groupId,
          progression: pe.progression,
        }
      })
      .filter((pe): pe is PlannedExercise => pe != null)
      .map((pe, i) => ({ ...pe, order: i })),
  }))

  if (missingKeys.length > 0) {
    throw new Error(
      `Starter exercises not found: ${Array.from(new Set(missingKeys)).join(', ')}`,
    )
  }

  const now = new Date().toISOString()
  const plan: CustomPlan = {
    id: generateId(),
    name: starterTemplateName(template),
    description: starterTemplateDescription(template),
    status: 'draft',
    days,
    createdAt: now,
    updatedAt: now,
    source: 'starter',
    progression: template.progression,
    deload: template.deload,
    communityPublicationId: null,
  }

  // 4. Zapisz + aktywuj (z walidacją + sync). saveCustomPlan robi wszystko:
  //    db.customPlans.put + validateCustomPlan + enqueueSync.
  const activated = await saveCustomPlan(plan, { activate: true })

  // 5. Dodaj do enabledCustomPlanIds — ZACHOWUJ istniejące aktywne plany.
  await addPlanToEnabledWorkouts(activated.id)

  track(AnalyticsEvents.starterTemplateActivated, {
    templateId: template.id,
    category: template.category,
    difficulty: template.difficulty,
  })

  return activated
}

/**
 * Dodaje plan do enabledCustomPlanIds, zachowując istniejące aktywne plany.
 *
 * Jeśli customPlansFilterExplicit === false, przejście na true wymaga skopiowania
 * wszystkich aktualnie aktywnych plan IDs do enabledCustomPlanIds (inaczej ukryłoby
 * je z Plans page toggle "show on training").
 */
async function addPlanToEnabledWorkouts(planId: string): Promise<void> {
  const { settings, setSettings } = useAppStore.getState()
  let nextIds: string[]
  if (settings.customPlansFilterExplicit) {
    nextIds = settings.enabledCustomPlanIds.includes(planId)
      ? settings.enabledCustomPlanIds
      : [...settings.enabledCustomPlanIds, planId]
  } else {
    // Przejście false → true: skopiuj wszystkie aktywne plany.
    const allPlans = await listCustomPlans()
    const activeIds = allPlans.filter((p) => p.status === 'active').map((p) => p.id)
    nextIds = activeIds.includes(planId) ? activeIds : [...activeIds, planId]
  }
  setSettings({
    customPlansFilterExplicit: true,
    enabledCustomPlanIds: nextIds,
  })
}

/** Czy plan lokalny pochodzi z szablonu startowego. */
export function isStarterPlan(plan: CustomPlan): boolean {
  return plan.source === 'starter'
}
