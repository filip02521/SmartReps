import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { LogoFull } from '@/components/brand/Logo'
import { OnboardingIllustration } from '@/components/onboarding/OnboardingIllustrations'
import { Button } from '@/components/ui/Button'
import { StepIndicator, PageLoader } from '@/components/ux/Feedback'
import { pl } from '@/i18n/pl'
import { useAppStore } from '@/stores/app-store'
import { useStoreHydrated } from '@/hooks/useStoreHydrated'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { runAuthenticatedSync, setAuthFromOnboarding } from '@/lib/auth-sync'
import type { Program } from '@/data/plans/types'

const rules = [
  { title: pl.onboardingRuleTestTitle, text: pl.onboardingRuleTestText },
  { title: pl.onboardingRuleRestTitle, text: pl.onboardingRuleRestText },
  { title: pl.onboardingRuleRestartTitle, text: pl.onboardingRuleRestartText },
]

export default function Onboarding() {
  const [step, setStep] = useState(0)
  const [programs, setPrograms] = useState<Program[]>(['pushups'])
  const [restoring, setRestoring] = useState(false)
  const setSettings = useAppStore((s) => s.setSettings)
  const setSetupQueue = useAppStore((s) => s.setSetupQueue)
  const onboardingComplete = useAppStore((s) => s.settings.onboardingComplete)
  const navigate = useNavigate()
  const hydrated = useStoreHydrated()

  useEffect(() => {
    if (!hydrated) return
    if (onboardingComplete) {
      navigate('/', { replace: true })
    }
  }, [hydrated, onboardingComplete, navigate])

  useEffect(() => {
    if (!hydrated || !isSupabaseConfigured || onboardingComplete) return

    let cancelled = false
    void (async () => {
      setRestoring(true)
      try {
        const { data } = await supabase.auth.getSession()
        if (!data.session || cancelled) return
        await runAuthenticatedSync({ showSuccessToast: false, showFailureToast: false })
        if (cancelled) return
        if (useAppStore.getState().settings.onboardingComplete) {
          navigate('/', { replace: true })
        }
      } finally {
        if (!cancelled) setRestoring(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [hydrated, onboardingComplete, navigate])

  const toggleProgram = (p: Program) => {
    setPrograms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    )
  }

  const finish = () => {
    const selected: Program[] = programs.length ? programs : ['pushups']
    const prev = useAppStore.getState().settings.enabledPrograms
    const merged = Array.from(new Set([...prev, ...selected])) as Program[]
    setSettings({ onboardingComplete: true, enabledPrograms: merged.length ? merged : selected })
    setSetupQueue(selected.slice(1))
    void import('@/lib/analytics').then((m) => m.track('onboarding_complete'))
    navigate(`/setup/test/${selected[0]}`)
  }

  const goToLogin = () => {
    setAuthFromOnboarding(true)
    navigate('/setup/login', { state: { fromOnboarding: true } })
  }

  if (!hydrated || onboardingComplete || restoring) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 safe-top">
        <PageLoader />
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col px-4 py-8 safe-top safe-bottom">
      <StepIndicator current={step} total={3} />

      {step === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <LogoFull height={44} className="mb-6" />
          <OnboardingIllustration step="welcome" />
          <h1 className="mt-2 sr-text-h1">{pl.onboardingWelcome}</h1>
          <p className="mt-2 text-[var(--sr-text-secondary)]">{pl.tagline}</p>
          <Button className="mt-8" fullWidth onClick={() => setStep(1)}>
            {pl.onboardingNewUser}
          </Button>
          {isSupabaseConfigured && (
            <Button variant="secondary" className="mt-3" fullWidth onClick={goToLogin}>
              {pl.onboardingHaveAccount}
            </Button>
          )}
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
