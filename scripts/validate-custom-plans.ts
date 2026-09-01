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

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

const exerciseFiles = readdirSync(fixturesDir).filter((f) => f.startsWith('exercises'))
const planFiles = readdirSync(fixturesDir).filter((f) => f.startsWith('plan'))

let errors = 0

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

if (errors) {
  console.error(`\n${errors} fixture plan(s) failed validation`)
  process.exit(1)
}
console.log('\nAll custom plan fixtures OK')
