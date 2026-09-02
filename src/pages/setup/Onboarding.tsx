import { useEffect, useMemo, useState } from 'react'
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
import { track } from '@/lib/analytics'
import type { Program } from '@/data/plans/types'

type WizardStep = 'welcome' | 'interest' | 'programs' | 'next'

export default function Onboarding() {
  const [stepId, setStepId] = useState<WizardStep>('welcome')
  const [wantStrong, setWantStrong] = useState(true)
  const [wantCustom, setWantCustom] = useState(false)
  const [programs, setPrograms] = useState<Program[]>(['pushups'])
  const [restoring, setRestoring] = useState(false)
  const setSettings = useAppStore((s) => s.setSettings)
  const setSetupQueue = useAppStore((s) => s.setSetupQueue)
  const onboardingComplete = useAppStore((s) => s.settings.onboardingComplete)
  const navigate = useNavigate()
  const hydrated = useStoreHydrated()

  const steps = useMemo<WizardStep[]>(() => {
    if (wantStrong) return ['welcome', 'interest', 'programs', 'next']
    return ['welcome', 'interest', 'next']
  }, [wantStrong])

  const stepIndex = Math.max(0, steps.indexOf(stepId))
  const interestOk = wantStrong || wantCustom
  const programsOk = !wantStrong || programs.length > 0

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

  // If user turns off Strong while on programs step, jump to next.
  useEffect(() => {
    if (!wantStrong && stepId === 'programs') {
      setStepId('next')
    }
  }, [wantStrong, stepId])

  const toggleProgram = (p: Program) => {
    setPrograms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    )
  }

  const goNext = () => {
    const i = steps.indexOf(stepId)
    const next = steps[i + 1]
    if (next) setStepId(next)
  }

  const goBack = () => {
    const i = steps.indexOf(stepId)
    const prev = steps[i - 1]
    if (prev) setStepId(prev)
  }

  const finish = () => {
    const selected: Program[] = wantStrong
      ? programs.length
        ? programs
        : ['pushups']
      : []
    setSettings({ onboardingComplete: true, enabledPrograms: selected })
    setSetupQueue([])
    track('onboarding_complete', {
      strong: wantStrong,
      custom: wantCustom,
      programCount: selected.length,
    })
    navigate('/', { replace: true })
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
      <StepIndicator current={stepIndex} total={steps.length} />

      {stepId === 'welcome' && (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <LogoFull height={44} className="mb-6" />
          <OnboardingIllustration step="welcome" />
          <h1 className="mt-2 sr-text-h1">{pl.onboardingWelcome}</h1>
          <p className="mt-3 max-w-sm text-[var(--sr-text-secondary)]">{pl.onboardingWelcomeBody}</p>
          <Button className="mt-8" fullWidth onClick={goNext}>
            {pl.onboardingNewUser}
          </Button>
          {isSupabaseConfigured && (
            <Button variant="secondary" className="mt-3" fullWidth onClick={goToLogin}>
              {pl.onboardingHaveAccount}
            </Button>
          )}
        </div>
      )}

      {stepId === 'interest' && (
        <div className="flex flex-1 flex-col py-8">
          <OnboardingIllustration step="interest" />
          <h2 className="sr-text-h2">{pl.onboardingInterestTitle}</h2>
          <p className="mt-1 sr-text-body-sm text-[var(--sr-text-secondary)]">
            {pl.onboardingInterestHint}
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <InterestCard
              selected={wantStrong}
              title={pl.onboardingInterestStrongTitle}
              body={pl.onboardingInterestStrongBody}
              accent="var(--sr-brand-primary)"
              onToggle={() => setWantStrong((v) => !v)}
            />
            <InterestCard
              selected={wantCustom}
              title={pl.onboardingInterestCustomTitle}
              body={pl.onboardingInterestCustomBody}
              accent="var(--sr-brand-secondary)"
              onToggle={() => setWantCustom((v) => !v)}
            />
          </div>
          <div className="mt-auto flex flex-col gap-2">
            <Button fullWidth disabled={!interestOk} onClick={goNext}>
              {pl.next}
            </Button>
            <Button variant="ghost" fullWidth onClick={goBack}>
              {pl.back}
            </Button>
          </div>
        </div>
      )}

      {stepId === 'programs' && (
        <div className="flex flex-1 flex-col py-8">
          <OnboardingIllustration step="programs" />
          <h2 className="sr-text-h2">{pl.onboardingPickProgram}</h2>
          <p className="mt-1 sr-text-body-sm text-[var(--sr-text-secondary)]">
            {pl.onboardingPickProgramHint}
          </p>
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
                      ? p === 'pushups'
                        ? 'var(--sr-pushups-accent)'
                        : 'var(--sr-pullups-accent)'
                      : 'var(--sr-border-subtle)',
                    background: selected ? 'var(--sr-brand-primary-muted)' : 'transparent',
                  }}
                >
                  <p className="font-semibold">
                    {p === 'pushups' ? pl.pushupsProgram : pl.pullupsProgram}
                  </p>
                  {selected && (
                    <Check size={20} className="text-[var(--sr-brand-primary)]" aria-hidden />
                  )}
                </button>
              )
            })}
          </div>
          <div className="mt-auto flex flex-col gap-2">
            <Button fullWidth disabled={!programsOk} onClick={goNext}>
              {pl.next}
            </Button>
            <Button variant="ghost" fullWidth onClick={goBack}>
              {pl.back}
            </Button>
          </div>
        </div>
      )}

      {stepId === 'next' && (
        <div className="flex flex-1 flex-col py-8">
          <OnboardingIllustration step="next" />
          <h2 className="sr-text-h2">{pl.onboardingNextTitle}</h2>
          <div className="mt-6 flex flex-col gap-3">
            <NextBullet text={pl.onboardingNextHome} />
            {wantStrong && <NextBullet text={pl.onboardingNextStrong} />}
            {wantCustom && <NextBullet text={pl.onboardingNextCustom} />}
          </div>
          <div className="mt-auto flex flex-col gap-2">
            <Button fullWidth disabled={!interestOk || !programsOk} onClick={finish}>
              {pl.onboardingEnterApp}
            </Button>
            <Button variant="ghost" fullWidth onClick={goBack}>
              {pl.back}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function InterestCard({
  selected,
  title,
  body,
  accent,
  onToggle,
}: {
  selected: boolean
  title: string
  body: string
  accent: string
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className="rounded-[var(--sr-radius-lg)] border-2 p-4 text-left transition-colors"
      style={{
        borderColor: selected ? accent : 'var(--sr-border-subtle)',
        background: selected ? 'var(--sr-brand-primary-muted)' : 'transparent',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-[var(--sr-text-primary)]">{title}</p>
          <p className="mt-1 sr-text-body-sm text-[var(--sr-text-secondary)]">{body}</p>
        </div>
        {selected && <Check size={20} className="shrink-0 text-[var(--sr-brand-primary)]" aria-hidden />}
      </div>
    </button>
  )
}

function NextBullet({ text }: { text: string }) {
  return (
    <div className="rounded-[var(--sr-radius-md)] bg-[var(--sr-bg-elevated)] p-4 sr-card">
      <p className="sr-text-body-sm text-[var(--sr-text-secondary)]">{text}</p>
    </div>
  )
}
