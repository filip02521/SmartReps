import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogoMark } from '@/components/brand/Logo'
import { OnboardingIllustration } from '@/components/onboarding/OnboardingIllustrations'
import { Button } from '@/components/ui/Button'
import { StepIndicator } from '@/components/ux/Feedback'
import { pl } from '@/i18n/pl'
import { useAppStore } from '@/stores/app-store'
import type { Program } from '@/data/plans/types'

const rules = [
  { title: 'Test max', text: 'Zacznij od testu — aplikacja dobierze odpowiedni poziom.' },
  { title: 'Przerwy', text: 'Szanuj przerwy między dniami — regeneracja buduje siłę.' },
  { title: 'Restart', text: 'Nieudany dzień? Po przerwie wracasz do dnia 1 tego cyklu.' },
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
          <LogoMark size={64} />
          <h1 className="mt-4 sr-text-h1">{pl.appName}</h1>
          <p className="mt-2 text-[var(--sr-text-secondary)]">{pl.tagline}</p>
          <Button className="mt-8" fullWidth onClick={() => setStep(1)}>Dalej</Button>
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-1 flex-col py-8">
          <OnboardingIllustration step="programs" />
          <h2 className="sr-text-h2">Wybierz programy</h2>
          <div className="mt-6 flex flex-col gap-3">
            {(['pushups', 'pullups'] as Program[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => toggleProgram(p)}
                className="rounded-[var(--sr-radius-lg)] border-2 p-4 text-left transition-colors min-h-[var(--sr-spacing-touch)]"
                style={{
                  borderColor: programs.includes(p)
                    ? p === 'pushups' ? 'var(--sr-pushups-accent)' : 'var(--sr-pullups-accent)'
                    : 'var(--sr-border-subtle)',
                }}
              >
                <p className="font-semibold">{p === 'pushups' ? pl.pushupsProgram : pl.pullupsProgram}</p>
              </button>
            ))}
          </div>
          <div className="mt-auto flex flex-col gap-2">
            <Button fullWidth onClick={() => setStep(2)}>Dalej</Button>
            <Button variant="ghost" fullWidth onClick={() => setStep(0)}>Wstecz</Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-1 flex-col py-8">
          <OnboardingIllustration step="rules" />
          <h2 className="sr-text-h2">Zasady programu</h2>
          <div className="mt-6 flex flex-col gap-4">
            {rules.map((r) => (
              <div key={r.title} className="rounded-[var(--sr-radius-md)] bg-[var(--sr-bg-elevated)] p-4 sr-card">
                <p className="sr-text-h3">{r.title}</p>
                <p className="mt-1 sr-text-body-sm text-[var(--sr-text-secondary)]">{r.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-auto flex flex-col gap-2">
            <Button fullWidth onClick={finish}>Rozpocznij test</Button>
            <Button variant="ghost" fullWidth onClick={() => setStep(1)}>Wstecz</Button>
          </div>
        </div>
      )}
    </div>
  )
}
