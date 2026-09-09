/**
 * Exercise demo preview page — shows all animations side by side.
 * Access at /demo-preview (dev only).
 */
import { useState } from 'react'
import { ExerciseDemo } from '@/components/exercise-demos/ExerciseDemo'
import { ExerciseFigure } from '@/components/exercise-demos/ExerciseFigure'
import { ALL_DEMO_SLUGS } from '@/lib/exercise-demo'
import type { ExerciseDefinition, MuscleGroup } from '@/lib/exercise-model'
import { pl } from '@/i18n/pl'

const SLUG_LABELS: Record<string, string> = {
  'push-up': 'Pompki',
  'pull-up': 'Podciągnięcia',
  'squat': 'Przysiady',
  'goblet-squat': 'Przysiad z hantlem',
  'plank': 'Deska',
  'side-plank': 'Deska boczna',
  'forward-lunge': 'Wykroki',
  'walking-lunge': 'Wykroki z hantlami',
  'dip': 'Dipy',
  'burpee': 'Burpees',
  'bicep-curl': 'Uginanie ramion',
  'ez-bar-curl': 'Uginanie ze sztangą',
  'overhead-press': 'Wyciskanie',
  'bench-press': 'Wyciskanie na ławce',
  'incline-bench-press': 'Wyciskanie na ławce skośnej',
  'dumbbell-fly': 'Rozpiętki',
  'wide-push-up': 'Pompki szerokie',
  'barbell-row': 'Wiosłowanie',
  'lat-pulldown': 'Ściąganie drążka',
  'deadlift': 'Martwy ciąg',
  'seated-row': 'Wiosłowanie siedząc',
  'face-pull': 'Face pull',
  'lateral-raise': 'Wznosy bokiem',
  'front-raise': 'Wznosy przodem',
  'rear-delt-fly': 'Wznosy tyłem',
  'arnold-press': 'Arnold press',
  'hammer-curl': 'Hammer curl',
  'tricep-pushdown': 'Prostowanie ramion',
  'skull-crusher': 'Skull crusher',
  'dumbbell-skull-crusher': 'Wyciskanie francuskie',
  'close-grip-bench-press': 'Wyciskanie wąskim chwytem',
  'leg-press': 'Suwnica',
  'romanian-deadlift': 'RDL',
  'leg-extension': 'Prostowanie nóg',
  'leg-curl': 'Uginanie nóg',
  'lying-leg-curl': 'Uginanie nóg leżąc',
  'standing-calf-raise': 'Wspięcia na palce',
  'hip-thrust': 'Hip thrust',
  'crunch': 'Spięcia brzucha',
  'hanging-leg-raise': 'Unoszenie nóg w zwisie',
  'russian-twist': 'Russian twist',
  'mountain-climber': 'Mountain climbers',
  'dead-bug': 'Dead bug',
  'kettlebell-swing': 'Kettlebell swing',
  'push-press': 'Push press',
  'thruster': 'Thrusters',
  'clean-and-press': 'Zarzut i wyciskanie',
  'stair-climber': 'Schody',
  'running': 'Bieganie',
  'cycling': 'Rower',
  'rowing': 'Wiosła',
  'elliptical': 'Orbitrek',
  'jump-rope': 'Skakanka',
  'jumping-jack': 'Pajacyki',
  'high-knees': 'High knees',
}

function makeExercise(name: string, muscleGroup: MuscleGroup): ExerciseDefinition {
  return {
    id: name,
    name,
    primaryMetric: 'reps',
    restDefaultSec: 90,
    muscleGroup,
    source: 'starter',
    archived: false,
    createdAt: '',
    updatedAt: '',
  }
}

export function DemoPreview() {
  const [selected, setSelected] = useState<string>('push-up')

  return (
    <div className="min-h-screen bg-[var(--sr-bg-base)] p-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-2 text-2xl font-bold text-[var(--sr-text-primary)]">
          Exercise Demo Preview
        </h1>
        <p className="mb-6 text-sm text-[var(--sr-text-muted)]">
          Przegląd wszystkich animacji ćwiczeń. Ilustracje: @bryllim/workout-guide (CC BY-SA 4.0).
          Kliknij aby zobaczyć pełne demo.
        </p>

        {/* Grid of all animations */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {ALL_DEMO_SLUGS.map((slug) => (
            <button
              key={slug}
              type="button"
              onClick={() => setSelected(slug)}
              className={`flex flex-col gap-2 rounded-[var(--sr-radius-md)] border p-3 text-left transition-colors ${
                selected === slug
                  ? 'border-[var(--sr-brand-primary)] bg-[var(--sr-brand-primary-muted)]'
                  : 'border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] hover:bg-[var(--sr-bg-surface)]'
              }`}
            >
              <div className="h-28 w-full">
                <ExerciseFigure demoKey={slug} />
              </div>
              <span className="text-xs font-medium text-[var(--sr-text-primary)]">
                {SLUG_LABELS[slug] ?? slug}
              </span>
              <span className="text-[10px] text-[var(--sr-text-muted)] font-mono">
                {slug}
              </span>
            </button>
          ))}
        </div>

        {/* Full demo of selected */}
        <div className="rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-6">
          <h2 className="mb-4 text-lg font-semibold text-[var(--sr-text-primary)]">
            {SLUG_LABELS[selected] ?? selected} — pełne demo
          </h2>
          <div className="max-w-sm">
            <ExerciseDemo
              exercise={makeExercise(SLUG_LABELS[selected] ?? selected, 'chest')}
            />
          </div>
        </div>

        <div className="mt-6 rounded-[var(--sr-radius-md)] bg-[var(--sr-info-muted)] p-3 text-sm text-[var(--sr-text-secondary)]">
          {pl.exerciseDemoAttribution}
        </div>
      </div>
    </div>
  )
}
