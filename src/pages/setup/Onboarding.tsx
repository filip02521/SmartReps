import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { OnboardingIllustration } from '@/components/onboarding/OnboardingIllustrations'
import { Button } from '@/components/ui/Button'
import { StepIndicator } from '@/components/ux/Feedback'
import { pl } from '@/i18n/pl'
import { useAppStore } from '@/stores/app-store'
import type { Program } from '@/data/plans/types'

const rules = [
  { title: pl.onboardingRuleTestTitle, text: pl.onboardingRuleTestText },
  { title: pl.onboardingRuleRestTitle, text: pl.onboardingRuleRestText },
  { title: pl.onboardingRuleRestartTitle, text: pl.onboardingRuleRestartText },
]

export default function Onboarding() {
  const [step, setStep] = useState(0)
  const [programs, setPrograms] = useState<Program[]>(['pushups'])
  const { setSettings, setSetupQueue } = useAppStore()
  const navigate = useNavigate()

  const toggleProgram = (p: Program) => {
    setPrograms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    )
  }

  const finish = () => {
    const enabled: Program[] = programs.length ? programs : ['pushups']
    setSettings({ onboardingComplete: true, enabledPrograms: enabled })
    setSetupQueue(enabled.slice(1))
    navigate(`/setup/test/${enabled[0]}`)
  }

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col px-4 py-8 safe-top safe-bottom">
      <StepIndicator current={step} total={3} />

      {step === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <OnboardingIllustration step="welcome" />
          <h1 className="mt-2 sr-text-h1">{pl.onboardingWelcome}</h1>
          <p className="mt-2 text-[var(--sr-text-secondary)]">{pl.tagline}</p>
          <Button className="mt-8" fullWidth onClick={() => setStep(1)}>{pl.next}</Button>
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-1 flex-col py-8">
          <OnboardingIllustration step="programs" />
          <h2 className="sr-text-h2">{pl.onboardingPickProgram}</h2>
          <div className="mt-6 flex flex-col gap-3">
            {(['pushups', 'pullups'] as Program[]).map((p) => {
              const selected = programs.includes(p)
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => toggleProgram(p)}
                  aria-pressed={selected}
                  className="flex min-h-[var(--sr-spacing-touch)] items-center justify-between rounded-[var(--sr-radius-lg)] border-2 p-4 text-left transition-colors"
                  style={{
                    borderColor: selected
                      ? p === 'pushups' ? 'var(--sr-pushups-accent)' : 'var(--sr-pullups-accent)'
                      : 'var(--sr-border-subtle)',
                    background: selected ? 'var(--sr-brand-primary-muted)' : 'transparent',
                  }}
                >
                  <p className="font-semibold">{p === 'pushups' ? pl.pushupsProgram : pl.pullupsProgram}</p>
                  {selected && <Check size={20} className="text-[var(--sr-brand-primary)]" aria-hidden />}
                </button>
              )
            })}
          </div>
          <div className="mt-auto flex flex-col gap-2">
            <Button fullWidth disabled={programs.length === 0} onClick={() => setStep(2)}>{pl.next}</Button>
            <Button variant="ghost" fullWidth onClick={() => setStep(0)}>{pl.back}</Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-1 flex-col py-8">
          <OnboardingIllustration step="rules" />
          <h2 className="sr-text-h2">{pl.onboardingRulesTitle}</h2>
          <div className="mt-6 flex flex-col gap-4">
            {rules.map((r) => (
              <div key={r.title} className="rounded-[var(--sr-radius-md)] bg-[var(--sr-bg-elevated)] p-4 sr-card">
                <p className="sr-text-h3">{r.title}</p>
                <p className="mt-1 sr-text-body-sm text-[var(--sr-text-secondary)]">{r.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-auto flex flex-col gap-2">
            <Button fullWidth onClick={finish}>{pl.test}</Button>
            <Button variant="ghost" fullWidth onClick={() => setStep(1)}>{pl.back}</Button>
          </div>
        </div>
      )}
    </div>
  )
}
