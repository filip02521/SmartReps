import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { pl } from '@/i18n/pl'

function StepIllustration({ step }: { step: 1 | 2 | 3 }) {
  const labels = ['Start', 'Dół', 'Góra']
  return (
    <svg viewBox="0 0 120 80" className="mx-auto h-20 w-32" aria-hidden>
      <rect x="10" y="50" width="100" height="4" fill="var(--sr-border-subtle)" rx="2" />
      <circle cx="60" cy={step === 1 ? 35 : step === 2 ? 45 : 25} r="12" fill="var(--sr-brand-primary-muted)" stroke="var(--sr-brand-primary)" strokeWidth="2" />
      <text x="60" y="72" textAnchor="middle" fill="var(--sr-text-muted)" fontSize="10">{labels[step - 1]}</text>
    </svg>
  )
}

export default function TechniquePushups() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const fromWorkout = searchParams.get('from') === 'workout'

  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate(fromWorkout ? '/' : '/setup/test/pushups')
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 safe-top safe-bottom">
      <PageHeader title={pl.techniqueTitle} onBack={goBack} />
      <div className="mt-2 space-y-6">
        <div>
          <StepIllustration step={1} />
          <p className="text-sm text-[var(--sr-text-secondary)]">{pl.techniqueStep1}</p>
        </div>
        <div>
          <StepIllustration step={2} />
          <p className="text-sm text-[var(--sr-text-secondary)]">{pl.techniqueStep2}</p>
        </div>
        <div>
          <StepIllustration step={3} />
          <p className="text-sm text-[var(--sr-text-secondary)]">{pl.techniqueStep3}</p>
        </div>
      </div>
      <Button className="mt-8" fullWidth onClick={goBack}>
        {fromWorkout ? pl.techniqueContinueWorkout : pl.techniqueContinueTest}
      </Button>
    </div>
  )
}
