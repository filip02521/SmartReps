import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  validateCustomPlan,
  type CustomPlan,
  type ExerciseDefinition,
} from '../src/lib/exercise-model.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const fixturesDir = join(root, 'src/data/custom/fixtures')
const seedDir = join(root, 'src/data/custom/seed-plans')

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

let errors = 0

const exerciseFiles = readdirSync(fixturesDir).filter((f) => f.startsWith('exercises'))
const planFiles = readdirSync(fixturesDir).filter((f) => f.startsWith('plan'))

const allExercises: ExerciseDefinition[] = []
for (const file of exerciseFiles) {
  const list = loadJson<ExerciseDefinition[]>(join(fixturesDir, file))
  allExercises.push(...list)
}
const byId = new Map(allExercises.map((e) => [e.id, e]))

for (const file of planFiles) {
  const plan = loadJson<CustomPlan>(join(fixturesDir, file))
  const issues = validateCustomPlan(plan, byId)
  if (issues.length) {
    errors++
    console.error(`❌ ${file}`)
    for (const i of issues) console.error(`  - ${i.path}: ${i.message}`)
  } else {
    console.log(`✓ ${file}`)
  }
}

type SeedPack = CustomPlan & { exercises: ExerciseDefinition[] }

const seedFiles = readdirSync(seedDir).filter((f) => f.endsWith('.json'))
for (const file of seedFiles) {
  const pack = loadJson<SeedPack>(join(seedDir, file))
  const seedById = new Map(
    (pack.exercises ?? []).map((e) => [
      e.id,
      {
        id: e.id,
        name: e.name,
        primaryMetric: e.primaryMetric,
        restDefaultSec: e.restDefaultSec ?? 90,
        archived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      } satisfies ExerciseDefinition,
    ]),
  )
  const plan: CustomPlan = {
    id: `seed-${file}`,
    name: pack.name,
    description: pack.description ?? '',
    status: 'active',
    source: 'user',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    days: pack.days,
    progression: pack.progression ?? null,
    deload: pack.deload ?? null,
  }
  const issues = validateCustomPlan(plan, seedById)
  if (!pack.progression?.enabled) {
    errors++
    console.error(`❌ ${file}`)
    console.error('  - progression: expected enabled progression on seed plan')
    continue
  }
  if (!pack.deload?.enabled) {
    errors++
    console.error(`❌ ${file}`)
    console.error('  - deload: expected enabled deload on seed plan')
    continue
  }
  if (issues.length) {
    errors++
    console.error(`❌ seed/${file}`)
    for (const i of issues) console.error(`  - ${i.path}: ${i.message}`)
  } else {
    console.log(`✓ seed/${file}`)
  }
}

if (errors) {
  console.error(`\n${errors} plan(s) failed validation`)
  process.exit(1)
}
console.log('\nAll custom plan fixtures OK')
