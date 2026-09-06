import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Check, Dumbbell, LayoutGrid, WifiOff, ShieldCheck, Compass, ArrowRight, Users, RefreshCw, Sparkles, Trophy, type LucideIcon } from 'lucide-react'
import { LogoFull } from '@/components/brand/Logo'
import { OnboardingIllustration } from '@/components/onboarding/OnboardingIllustrations'
import { Button } from '@/components/ui/Button'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { StepIndicator, PageLoader } from '@/components/ux/Feedback'
import { pl } from '@/i18n/pl'
import type { Lang } from '@/i18n'
import { useAppStore } from '@/stores/app-store'
import { useSeo } from '@/hooks/useSeo'
import { useStoreHydrated } from '@/hooks/useStoreHydrated'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { runAuthenticatedSync, setAuthFromOnboarding, consumeAuthReturnTo } from '@/lib/auth-sync'
import { resolvePostAuthNavigation } from '@/lib/post-auth-navigation'
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
  useSeo({ title: pl.seoOnboardingTitle, description: pl.seoOnboardingDescription, path: '/setup/onboarding' })
  const [programs, setPrograms] = useState<Program[]>(['pushups'])
  const setSettings = useAppStore((s) => s.setSettings)
  const setSetupQueue = useAppStore((s) => s.setSetupQueue)
  const onboardingComplete = useAppStore((s) => s.settings.onboardingComplete)
  const lang = useAppStore((s) => s.settings.language ?? 'pl')
  const navigate = useNavigate()
  const hydrated = useStoreHydrated()

  const handleLangChange = (next: Lang) => {
    if (next === lang) return
    setSettings({ language: next })
    if (typeof document !== 'undefined') {
      document.documentElement.lang = next
    }
  }

  const steps = useMemo<WizardStep[]>(() => {
    if (wantStrong) return ['welcome', 'interest', 'programs', 'next']
    return ['welcome', 'interest', 'next']
  }, [wantStrong])

  const stepIndex = Math.max(0, steps.indexOf(stepId))
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
    void resolvePostAuthNavigation(navigate, consumeAuthReturnTo())
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

  // Build summary label for the "next" step
  const choicesParts: string[] = []
  if (wantStrong) choicesParts.push(pl.onboardingNextSummaryStrong)
  if (wantCustom) choicesParts.push(pl.onboardingNextSummaryCustom)
  const choicesLabel = choicesParts.length
    ? choicesParts.join(' · ')
    : pl.onboardingNextSummaryNone

  return (
    <div className={cn(SHELL, stepId === 'welcome' && 'sr-onboard-glow')}>
      <div className="mb-5 flex shrink-0 items-center gap-3">
        <div className="min-w-0 flex-1">
          <StepIndicator current={stepIndex} total={steps.length} />
        </div>
        <SegmentedControl
          size="compact"
          options={[
            { value: 'pl' as const, label: 'PL' },
            { value: 'en' as const, label: 'EN' },
          ]}
          value={lang}
          onChange={handleLangChange}
          aria-label={pl.onboardingLanguageAria}
        />
      </div>

      {stepId === 'welcome' && (
        <StepLayout
          key="welcome"
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
          <div className="flex flex-col items-center text-center sr-onboard-step">
            <LogoFull height={32} className="mb-3" />
            <div className="mb-3 w-full">
              <OnboardingIllustration step="welcome" />
            </div>
            <h1 className="sr-text-h1">{pl.onboardingWelcome}</h1>
            <p className="mt-2 max-w-sm text-pretty sr-text-body-sm text-[var(--sr-text-secondary)]">
              {pl.onboardingWelcomeTagline}
            </p>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2.5">
            <FeatureTile icon={Dumbbell} text={pl.onboardingFeatureProgramsShort} className="sr-onboard-step sr-onboard-stagger-1" />
            <FeatureTile icon={LayoutGrid} text={pl.onboardingFeatureCustomShort} className="sr-onboard-step sr-onboard-stagger-1" />
            <FeatureTile icon={Sparkles} text={pl.onboardingFeatureAiShort} className="sr-onboard-step sr-onboard-stagger-2" />
            <FeatureTile icon={Users} text={pl.onboardingFeatureCommunityShort} className="sr-onboard-step sr-onboard-stagger-2" />
            <FeatureTile icon={Trophy} text={pl.onboardingFeatureProgressShort} className="sr-onboard-step sr-onboard-stagger-3" />
            <FeatureTile icon={RefreshCw} text={pl.onboardingFeatureSyncShort} className="sr-onboard-step sr-onboard-stagger-3" />
            <FeatureTile icon={WifiOff} text={pl.onboardingFeatureOfflineShort} className="sr-onboard-step sr-onboard-stagger-4" />
            <FeatureTile icon={ShieldCheck} text={pl.onboardingFeaturePrivateShort} className="sr-onboard-step sr-onboard-stagger-4" />
          </div>
        </StepLayout>
      )}

      {stepId === 'interest' && (
        <StepLayout
          key="interest"
          footer={
            <>
              <Button fullWidth onClick={goNext}>
                {pl.next}
              </Button>
              <Button variant="ghost" fullWidth onClick={goBack}>
                {pl.back}
              </Button>
            </>
          }
        >
          <h2 className="sr-text-h2 sr-onboard-step">{pl.onboardingInterestTitle}</h2>
          <p className="mt-2 sr-text-body-sm text-[var(--sr-text-secondary)] sr-onboard-step sr-onboard-stagger-1">
            {pl.onboardingInterestHintStrong}
          </p>
          <div className="mt-6 flex flex-col gap-3 sr-onboard-step sr-onboard-stagger-2">
            <InterestCard
              selected={wantStrong}
              icon={Dumbbell}
              title={pl.onboardingInterestStrongTitle}
              body={pl.onboardingInterestStrongBody}
              accent="var(--sr-brand-primary)"
              accentMuted="var(--sr-brand-primary-muted)"
              onToggle={() => setWantStrong((v) => !v)}
            />
            <InterestCard
              selected={wantCustom}
              icon={LayoutGrid}
              title={pl.onboardingInterestCustomTitle}
              body={pl.onboardingInterestCustomBody}
              accent="var(--sr-brand-secondary)"
              accentMuted="var(--sr-brand-secondary-muted)"
              onToggle={() => setWantCustom((v) => !v)}
            />
          </div>
        </StepLayout>
      )}

      {stepId === 'programs' && (
        <StepLayout
          key="programs"
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
          <h2 className="sr-text-h2 sr-onboard-step">{pl.onboardingPickProgram}</h2>
          <p className="mt-2 sr-text-body-sm text-[var(--sr-text-secondary)] sr-onboard-step sr-onboard-stagger-1">
            {pl.onboardingProgramsHint}
          </p>
          <div className="mt-6 flex flex-col gap-3 sr-onboard-step sr-onboard-stagger-2">
            {(['pushups', 'pullups'] as Program[]).map((p) => {
              const selected = programs.includes(p)
              const isPushups = p === 'pushups'
              const accent = isPushups ? 'var(--sr-pushups-accent)' : 'var(--sr-pullups-accent)'
              const accentMuted = isPushups ? 'var(--sr-pushups-accent-muted)' : 'var(--sr-pullups-accent-muted)'
              return (
                <ProgramCard
                  key={p}
                  selected={selected}
                  icon={isPushups ? PushupIcon : PullupIcon}
                  accent={accent}
                  accentMuted={accentMuted}
                  title={isPushups ? pl.pushupsProgram : pl.pullupsProgram}
                  desc={isPushups ? pl.onboardingPushupsDesc : pl.onboardingPullupsDesc}
                  onToggle={() => toggleProgram(p)}
                />
              )
            })}
          </div>
        </StepLayout>
      )}

      {stepId === 'next' && (
        <StepLayout
          key="next"
          footer={
            <>
              <Button fullWidth disabled={!programsOk} onClick={finish}>
                {pl.onboardingEnterApp}
                <ArrowRight size={18} aria-hidden />
              </Button>
              <Button variant="ghost" fullWidth onClick={goBack}>
                {pl.back}
              </Button>
            </>
          }
        >
          <div className="mb-5 sr-onboard-step">
            <OnboardingIllustration step="next" />
          </div>
          <h2 className="sr-text-h2 sr-onboard-step sr-onboard-stagger-1">{pl.onboardingNextTitleReady}</h2>
          {/* Summary of choices */}
          <div className="mt-4 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] px-4 py-3 sr-onboard-step sr-onboard-stagger-2">
            <p className="text-pretty sr-text-body-sm text-[var(--sr-text-secondary)]">
              {pl.onboardingNextSummary(choicesLabel)}
            </p>
          </div>
          {/* Concise bullets — what happens next */}
          <div className="mt-5 flex flex-col gap-2.5 sr-onboard-step sr-onboard-stagger-3">
            <NextBullet icon={Compass} text={pl.onboardingNextBulletHome} />
            {wantStrong && <NextBullet icon={Dumbbell} text={pl.onboardingNextBulletStrong} />}
            {wantCustom && <NextBullet icon={LayoutGrid} text={pl.onboardingNextBulletCustom} />}
            <NextBullet icon={Users} text={pl.onboardingNextBulletCommunity} />
            <NextBullet icon={Sparkles} text={pl.onboardingNextBulletAi} />
            <NextBullet icon={Trophy} text={pl.onboardingNextBulletProgress} />
          </div>
          <p className="mt-6 text-center text-pretty sr-text-body font-semibold text-[var(--sr-brand-primary)] sr-onboard-step sr-onboard-stagger-4">
            {pl.onboardingReadyLine}
          </p>
        </StepLayout>
      )}
    </div>
  )
}

function StepLayout({
  children,
  footer,
}: {
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col">
        {children}
      </div>
      <div className="mt-8 flex shrink-0 flex-col gap-2.5">{footer}</div>
    </div>
  )
}

function InterestCard({
  selected,
  icon: Icon,
  title,
  body,
  accent,
  accentMuted,
  onToggle,
}: {
  selected: boolean
  icon: LucideIcon
  title: string
  body: string
  accent: string
  accentMuted: string
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className="rounded-[var(--sr-radius-lg)] border-2 px-4 py-3.5 text-left transition-all active:scale-[0.98]"
      style={{
        borderColor: selected ? accent : 'var(--sr-border-subtle)',
        background: selected ? accentMuted : 'transparent',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)] transition-colors"
            style={{ background: selected ? accent : 'var(--sr-bg-surface)' }}
            aria-hidden
          >
            <Icon
              size={20}
              className={selected ? 'text-[var(--sr-text-inverse)]' : 'text-[var(--sr-text-secondary)]'}
            />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-[var(--sr-text-primary)]">{title}</p>
            <p className="mt-1.5 text-pretty sr-text-body-sm leading-snug text-[var(--sr-text-secondary)]">
              {body}
            </p>
          </div>
        </div>
        {selected && (
          <Check size={20} className="mt-0.5 shrink-0" style={{ color: accent }} aria-hidden />
        )}
      </div>
    </button>
  )
}

function ProgramCard({
  selected,
  icon: Icon,
  accent,
  accentMuted,
  title,
  desc,
  onToggle,
}: {
  selected: boolean
  icon: (props: { className?: string }) => ReactNode
  accent: string
  accentMuted: string
  title: string
  desc: string
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className="flex min-h-[var(--sr-spacing-touch)] items-center justify-between gap-3 rounded-[var(--sr-radius-lg)] border-2 px-4 py-3.5 text-left transition-all active:scale-[0.98]"
      style={{
        borderColor: selected ? accent : 'var(--sr-border-subtle)',
        background: selected ? accentMuted : 'transparent',
      }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)] transition-colors"
          style={{ background: selected ? accent : 'var(--sr-bg-surface)' }}
          aria-hidden
        >
          <Icon className={selected ? 'text-[var(--sr-text-inverse)]' : 'text-[var(--sr-text-secondary)]'} />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-[var(--sr-text-primary)]">{title}</p>
          <p className="mt-1 text-pretty sr-text-body-sm leading-snug text-[var(--sr-text-secondary)]">
            {desc}
          </p>
        </div>
      </div>
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-full transition-colors"
        style={{
          background: selected ? accent : 'transparent',
          border: selected ? 'none' : '2px solid var(--sr-border-strong)',
        }}
        aria-hidden
      >
        {selected && <Check size={16} className="text-[var(--sr-text-inverse)]" />}
      </span>
    </button>
  )
}

// Program icons — inline SVG silhouettes
function PushupIcon({ className }: { className?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <circle cx="5" cy="9" r="2.5" />
      <rect x="7" y="11" width="14" height="2.5" rx="1.25" />
      <rect x="3" y="13" width="3" height="5" rx="1" />
    </svg>
  )
}

function PullupIcon({ className }: { className?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <rect x="2" y="3" width="20" height="2.5" rx="1.25" />
      <circle cx="12" cy="10" r="2.5" />
      <rect x="10.5" y="12.5" width="3" height="7" rx="1.5" />
    </svg>
  )
}

function NextBullet({ icon: Icon, text }: { icon?: LucideIcon; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-[var(--sr-radius-md)] bg-[var(--sr-bg-elevated)] px-4 py-3.5">
      {Icon && (
        <Icon size={18} className="mt-0.5 shrink-0 text-[var(--sr-brand-primary)]" aria-hidden />
      )}
      <p className="text-pretty sr-text-body-sm leading-snug text-[var(--sr-text-secondary)]">
        {text}
      </p>
    </div>
  )
}

function FeatureTile({ icon: Icon, text, className }: { icon: LucideIcon; text: string; className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] px-3 py-3 text-center',
        className,
      )}
    >
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-[var(--sr-radius-sm)] bg-[var(--sr-brand-primary-muted)]"
        aria-hidden
      >
        <Icon size={18} className="text-[var(--sr-brand-primary)]" />
      </span>
      <p className="text-pretty sr-text-body-sm font-medium leading-tight text-[var(--sr-text-primary)]">
        {text}
      </p>
    </div>
  )
}
