import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
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
import { cn } from '@/lib/utils'

type WizardStep = 'welcome' | 'interest' | 'programs' | 'next'

const SHELL =
  'mx-auto flex min-h-dvh max-w-lg flex-col px-5 pt-5 pb-7 safe-top safe-bottom'

export default function Onboarding() {
  const [stepId, setStepId] = useState<WizardStep>('welcome')
  const [wantStrong, setWantStrong] = useState(true)
  const [wantCustom, setWantCustom] = useState(false)
  const [programs, setPrograms] = useState<Program[]>(['pushups'])
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

  // Restore session in the background — never block the wizard on getSession/sync
  // (Strict Mode cancel + hung auth left users on PageLoader forever).
  useEffect(() => {
    if (!hydrated || !isSupabaseConfigured || onboardingComplete) return

    let cancelled = false
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (!data.session || cancelled) return
        await runAuthenticatedSync({ showSuccessToast: false, showFailureToast: false })
        if (cancelled) return
        if (useAppStore.getState().settings.onboardingComplete) {
          navigate('/', { replace: true })
        }
      } catch {
        // Soft onboarding continues without cloud restore.
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

  if (!hydrated) {
    return (
      <div className={SHELL}>
        <PageLoader />
      </div>
    )
  }

  if (onboardingComplete) {
    return <Navigate to="/" replace />
  }

  return (
    <div className={SHELL}>
      <div className="mb-5 shrink-0">
        <StepIndicator current={stepIndex} total={steps.length} />
      </div>

      {stepId === 'welcome' && (
        <StepLayout
          centered
          footer={
            <>
              <Button fullWidth onClick={goNext}>
                {pl.onboardingNewUser}
              </Button>
              {isSupabaseConfigured && (
                <Button variant="secondary" fullWidth onClick={goToLogin}>
                  {pl.onboardingHaveAccount}
                </Button>
              )}
            </>
          }
        >
          <LogoFull height={40} className="mb-5" />
          <div className="mb-5 w-full">
            <OnboardingIllustration step="welcome" />
          </div>
          <h1 className="sr-text-h1 px-1">{pl.onboardingWelcome}</h1>
          <p className="mt-3 max-w-sm px-1 text-pretty sr-text-body text-[var(--sr-text-secondary)]">
            {pl.onboardingWelcomeBody}
          </p>
        </StepLayout>
      )}

      {stepId === 'interest' && (
        <StepLayout
          footer={
            <>
              <Button fullWidth disabled={!interestOk} onClick={goNext}>
                {pl.next}
              </Button>
              <Button variant="ghost" fullWidth onClick={goBack}>
                {pl.back}
              </Button>
            </>
          }
        >
          <div className="mb-4">
            <OnboardingIllustration step="interest" />
          </div>
          <h2 className="sr-text-h2">{pl.onboardingInterestTitle}</h2>
          <p className="mt-2 sr-text-body-sm text-[var(--sr-text-secondary)]">
            {pl.onboardingInterestHint}
          </p>
          <div className="mt-5 flex flex-col gap-3">
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
        </StepLayout>
      )}

      {stepId === 'programs' && (
        <StepLayout
          footer={
            <>
              <Button fullWidth disabled={!programsOk} onClick={goNext}>
                {pl.next}
              </Button>
              <Button variant="ghost" fullWidth onClick={goBack}>
                {pl.back}
              </Button>
            </>
          }
        >
          <div className="mb-4">
            <OnboardingIllustration step="programs" />
          </div>
          <h2 className="sr-text-h2">{pl.onboardingPickProgram}</h2>
          <p className="mt-2 sr-text-body-sm text-[var(--sr-text-secondary)]">
            {pl.onboardingPickProgramHint}
          </p>
          <div className="mt-5 flex flex-col gap-3">
            {(['pushups', 'pullups'] as Program[]).map((p) => {
              const selected = programs.includes(p)
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => toggleProgram(p)}
                  aria-pressed={selected}
                  className="flex min-h-[var(--sr-spacing-touch)] items-center justify-between rounded-[var(--sr-radius-lg)] border-2 px-4 py-3.5 text-left transition-colors"
                  style={{
                    borderColor: selected
                      ? p === 'pushups'
                        ? 'var(--sr-pushups-accent)'
                        : 'var(--sr-pullups-accent)'
                      : 'var(--sr-border-subtle)',
                    background: selected ? 'var(--sr-brand-primary-muted)' : 'transparent',
                  }}
                >
                  <p className="font-semibold text-[var(--sr-text-primary)]">
                    {p === 'pushups' ? pl.pushupsProgram : pl.pullupsProgram}
                  </p>
                  {selected && (
                    <Check size={20} className="shrink-0 text-[var(--sr-brand-primary)]" aria-hidden />
                  )}
                </button>
              )
            })}
          </div>
        </StepLayout>
      )}

      {stepId === 'next' && (
        <StepLayout
          footer={
            <>
              <Button fullWidth disabled={!interestOk || !programsOk} onClick={finish}>
                {pl.onboardingEnterApp}
              </Button>
              <Button variant="ghost" fullWidth onClick={goBack}>
                {pl.back}
              </Button>
            </>
          }
        >
          <div className="mb-4">
            <OnboardingIllustration step="next" />
          </div>
          <h2 className="sr-text-h2">{pl.onboardingNextTitle}</h2>
          <div className="mt-5 flex flex-col gap-3">
            <NextBullet text={pl.onboardingNextHome} />
            {wantStrong && <NextBullet text={pl.onboardingNextStrong} />}
            {wantCustom && <NextBullet text={pl.onboardingNextCustom} />}
          </div>
        </StepLayout>
      )}
    </div>
  )
}

function StepLayout({
  children,
  footer,
  centered,
}: {
  children: ReactNode
  footer: ReactNode
  centered?: boolean
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col',
          centered && 'items-center justify-center text-center',
        )}
      >
        {children}
      </div>
      <div className="mt-8 flex shrink-0 flex-col gap-2.5">{footer}</div>
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
      className="rounded-[var(--sr-radius-lg)] border-2 px-4 py-3.5 text-left transition-colors"
      style={{
        borderColor: selected ? accent : 'var(--sr-border-subtle)',
        background: selected ? 'var(--sr-brand-primary-muted)' : 'transparent',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-[var(--sr-text-primary)]">{title}</p>
          <p className="mt-1.5 text-pretty sr-text-body-sm leading-snug text-[var(--sr-text-secondary)]">
            {body}
          </p>
        </div>
        {selected && (
          <Check size={20} className="mt-0.5 shrink-0 text-[var(--sr-brand-primary)]" aria-hidden />
        )}
      </div>
    </button>
  )
}

function NextBullet({ text }: { text: string }) {
  return (
    <div className="rounded-[var(--sr-radius-md)] bg-[var(--sr-bg-elevated)] px-4 py-3.5">
      <p className="text-pretty sr-text-body-sm leading-snug text-[var(--sr-text-secondary)]">
        {text}
      </p>
    </div>
  )
}
