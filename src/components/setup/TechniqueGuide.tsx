import type { ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { pl } from '@/i18n/pl'
import type { Program } from '@/data/plans/types'

function StepIllustration({
  step,
  labels,
}: {
  step: 1 | 2 | 3
  labels: [string, string, string]
}) {
  return (
    <svg viewBox="0 0 120 80" className="mx-auto h-20 w-32" aria-hidden>
      <rect x="10" y="50" width="100" height="4" fill="var(--sr-border-subtle)" rx="2" />
      {step === 3 ? (
        <rect x="52" y="8" width="16" height="42" fill="var(--sr-border-subtle)" rx="2" />
      ) : null}
      <circle
        cx={step === 3 ? 60 : 60}
        cy={step === 1 ? 35 : step === 2 ? 45 : 22}
        r="12"
        fill="var(--sr-brand-primary-muted)"
        stroke="var(--sr-brand-primary)"
        strokeWidth="2"
      />
      <text x="60" y="72" textAnchor="middle" fill="var(--sr-text-muted)" fontSize="10">
        {labels[step - 1]}
      </text>
    </svg>
  )
}

type TechniqueContent = {
  title: string
  steps: [string, string, string]
  poseLabels: [string, string, string]
}

function contentForProgram(program: Program): TechniqueContent {
  if (program === 'pullups') {
    return {
      title: pl.techniquePullupsTitle,
      steps: [pl.techniquePullupsStep1, pl.techniquePullupsStep2, pl.techniquePullupsStep3],
      poseLabels: [
        pl.techniquePullupsPoseHang,
        pl.techniquePullupsPoseTop,
        pl.techniquePullupsPoseBottom,
      ],
    }
  }
  return {
    title: pl.techniqueTitle,
    steps: [pl.techniqueStep1, pl.techniqueStep2, pl.techniqueStep3],
    poseLabels: [pl.techniquePoseStart, pl.techniquePoseBottom, pl.techniquePoseTop],
  }
}

export function TechniqueGuide({ program }: { program: Program }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const fromWorkout = searchParams.get('from') === 'workout'
  const content = contentForProgram(program)

  const defaultBack =
    program === 'pullups' ? '/setup/test/pullups' : '/setup/test/pushups'

  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate(fromWorkout ? '/' : defaultBack)
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 safe-top safe-bottom">
      <PageHeader title={content.title} onBack={goBack} />
      <div className="mt-2 space-y-6">
        {([1, 2, 3] as const).map((step) => (
          <div key={step}>
            <StepIllustration step={step} labels={content.poseLabels} />
            <p className="text-sm text-[var(--sr-text-secondary)]">{content.steps[step - 1]}</p>
          </div>
        ))}
      </div>
      <Button className="mt-8" fullWidth onClick={goBack}>
        {fromWorkout ? pl.techniqueContinueWorkout : pl.techniqueContinueTest}
      </Button>
    </div>
  )
}

export default function TechniqueGuidePage(props: { program: Program }) {
  return <TechniqueGuide program={props.program} />
}

export function techniqueLinkForProgram(program: Program, from: 'test' | 'workout'): string {
  const base = program === 'pullups' ? '/setup/technique-pullups' : '/setup/technique'
  return `${base}?from=${from}`
}

export function techniqueLinkLabel(program: Program): string {
  return program === 'pullups' ? pl.howToPullup : pl.howToPushup
}

export function techniqueMenuLabel(program: Program): ReactNode {
  return program === 'pullups' ? pl.helpTechniquePullups : pl.helpTechniquePushups
}
