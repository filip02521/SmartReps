import { useEffect, useMemo, useRef, useState, useCallback, type ReactNode, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Check, Dumbbell, LayoutGrid, Compass, ArrowRight, Users, Sparkles, ChevronRight, type LucideIcon } from 'lucide-react'
import { LogoFull } from '@/components/brand/Logo'
import { OnboardingIllustration, SlideCyclesIllustration, SlideAiIllustration, SlideProgressIllustration } from '@/components/onboarding/OnboardingIllustrations'
import { Button } from '@/components/ui/Button'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { StepIndicator, PageLoader } from '@/components/ux/Feedback'
import { ProgramIcon, programAccent } from '@/components/ui/ProgramIcon'
import { pl } from '@/i18n/pl'
import type { Lang } from '@/i18n'
import { useAppStore } from '@/stores/app-store'
import { useOnboardingWizardStore } from '@/stores/onboarding-wizard-store'
import { useSeo } from '@/hooks/useSeo'
import { useStoreHydrated } from '@/hooks/useStoreHydrated'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { runAuthenticatedSync, setAuthFromOnboarding, consumeAuthReturnTo } from '@/lib/auth-sync'
import { resolvePostAuthNavigation } from '@/lib/post-auth-navigation'
import { track, AnalyticsEvents } from '@/lib/analytics'
import { showToast } from '@/stores/toast-store'
import type { Program } from '@/data/plans/types'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'

type WizardStep = 'welcome' | 'interest' | 'programs' | 'next'

const SHELL =
  'mx-auto flex min-h-dvh max-w-lg flex-col px-5 pt-5 pb-7 safe-top safe-bottom'

export default function Onboarding() {
  const stepId = useOnboardingWizardStore((s) => s.stepId)
  const setStepId = useOnboardingWizardStore((s) => s.setStepId)
  const wantStrong = useOnboardingWizardStore((s) => s.wantStrong)
  const setWantStrong = useOnboardingWizardStore((s) => s.setWantStrong)
  const wantCustom = useOnboardingWizardStore((s) => s.wantCustom)
  const setWantCustom = useOnboardingWizardStore((s) => s.setWantCustom)
  const activeSlide = useOnboardingWizardStore((s) => s.activeSlide)
  const setActiveSlide = useOnboardingWizardStore((s) => s.setActiveSlide)
  const hasSwiped = useOnboardingWizardStore((s) => s.hasSwiped)
  const setHasSwiped = useOnboardingWizardStore((s) => s.setHasSwiped)
  const programs = useOnboardingWizardStore((s) => s.programs)
  const setPrograms = useOnboardingWizardStore((s) => s.setPrograms)
  const resetWizard = useOnboardingWizardStore((s) => s.reset)
  const carouselRef = useRef<HTMLDivElement>(null)
  const onboardingStartedTracked = useRef(false)
  useSeo({ title: pl.seoOnboardingTitle, description: pl.seoOnboardingDescription, path: '/setup/onboarding' })
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

  const handleCarouselScroll = useCallback(() => {
    const el = carouselRef.current
    if (!el) return
    const slideW = el.clientWidth
    if (slideW === 0) return
    const next = Math.round(el.scrollLeft / slideW)
    setActiveSlide(next)
    if (next > 0) setHasSwiped(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Zustand setters are stable
  }, [])

  const handleCarouselKey = useCallback((e: ReactKeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const el = carouselRef.current
    if (!el) return
    const slideW = el.clientWidth
    const current = Math.round(el.scrollLeft / slideW)
    const target = e.key === 'ArrowRight' ? current + 1 : current - 1
    if (target < 0 || target > 2) return
    el.scrollTo({ left: target * slideW, behavior: 'smooth' })
  }, [])

  const steps = useMemo<WizardStep[]>(() => {
    if (wantStrong) return ['welcome', 'interest', 'programs', 'next']
    return ['welcome', 'interest', 'next']
  }, [wantStrong])

  const stepIndex = Math.max(0, steps.indexOf(stepId))
  const programsOk = !wantStrong || programs.length > 0

  // Restore session in the background — never block the wizard on getSession/sync
  // (Strict Mode cancel + hung auth left users on PageLoader forever).
  // Surface restore failures with a non-blocking toast + retry action so the
  // user knows cloud data wasn't pulled and can try again.
  const [restoreFailed, setRestoreFailed] = useState(false)
  const [restoreAttempt, setRestoreAttempt] = useState(0)
  useEffect(() => {
    if (!hydrated || !isSupabaseConfigured || onboardingComplete) return

    // Track onboarding started — fires once per onboarding flow
    if (!onboardingStartedTracked.current) {
      onboardingStartedTracked.current = true
      track(AnalyticsEvents.onboardingStarted)
    }

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
        if (!cancelled) setRestoreFailed(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [hydrated, onboardingComplete, navigate, restoreAttempt])

  // Show a non-blocking toast when restore fails — user can retry or ignore.
  useEffect(() => {
    if (!restoreFailed) return
    showToast(pl.onboardingCloudRestoreFailed, 'error', {
      action: {
        label: pl.onboardingCloudRestoreRetry,
        onClick: () => {
          setRestoreFailed(false)
          setRestoreAttempt((n) => n + 1)
        },
      },
    })
  }, [restoreFailed])

  // If user turns off Strong while on programs step, jump to next.
  useEffect(() => {
    if (!wantStrong && stepId === 'programs') {
      setStepId('next')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Zustand setter is stable
  }, [wantStrong, stepId])

  const toggleProgram = (p: Program) => {
    const prev = programs
    const next = prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    track(AnalyticsEvents.programSelected, {
      program: p,
      action: prev.includes(p) ? 'deselected' : 'selected',
      totalSelected: next.length,
    })
    setPrograms(next)
  }

  const goNext = () => {
    const i = steps.indexOf(stepId)
    const next = steps[i + 1]
    if (next) {
      track(AnalyticsEvents.onboardingStep, { from: stepId, to: next })
      setStepId(next)
    }
  }

  const goBack = () => {
    const i = steps.indexOf(stepId)
    const prev = steps[i - 1]
    if (prev) {
      track(AnalyticsEvents.onboardingStep, { from: stepId, to: prev })
      setStepId(prev)
    }
  }

  const finish = () => {
    const selected: Program[] = wantStrong
      ? programs.length
        ? programs
        : ['pushups']
      : []
    setSettings({ onboardingComplete: true, enabledPrograms: selected })
    setSetupQueue([])
    resetWizard()
    track(AnalyticsEvents.onboardingComplete, {
      strong: wantStrong,
      custom: wantCustom,
      programCount: selected.length,
      programs: selected.join(','),
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
            { value: 'pl' as const, label: pl.onboardingLanguagePl },
            { value: 'en' as const, label: pl.onboardingLanguageEn },
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
            <h1 className="sr-text-h1">{pl.onboardingWelcome}</h1>
            <p className="mt-2 max-w-sm text-pretty sr-text-body-sm text-[var(--sr-text-secondary)]">
              {pl.onboardingWelcomeTagline}
            </p>
          </div>
          {/* Swipeable feature carousel */}
          <div
            ref={carouselRef}
            className="sr-carousel sr-onboard-step sr-onboard-stagger-1 mt-4 flex min-h-[270px] snap-x snap-mandatory overflow-x-auto pb-1 focus:outline-none focus-visible:[&]:ring-2 focus-visible:ring-[var(--sr-brand-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--sr-bg-base)] rounded-[var(--sr-radius-md)]"
            aria-label={pl.onboardingCarouselAria}
            tabIndex={0}
            onScroll={handleCarouselScroll}
            onKeyDown={handleCarouselKey}
          >
            {/* Slide 1 — Ready cycles */}
            <div className="sr-carousel-slide flex w-full shrink-0 flex-col items-center justify-center">
              <SlideCyclesIllustration />
              <p className="mt-3 text-sm font-semibold text-[var(--sr-text-primary)]">{pl.onboardingSlide1Title}</p>
              <p className="mt-1 max-w-[240px] text-center text-xs text-[var(--sr-text-muted)]">{pl.onboardingSlide1Desc}</p>
              {/* Swipe hint — only on first slide, only once */}
              {activeSlide === 0 && !hasSwiped && (
                <div className="mt-3 flex items-center gap-1 text-[var(--sr-text-muted)] sr-swipe-hint">
                  <span className="text-[11px] font-medium">{pl.onboardingSwipeHint}</span>
                  <ChevronRight size={14} aria-hidden />
                </div>
              )}
            </div>
            {/* Slide 2 — AI Coach */}
            <div className="sr-carousel-slide flex w-full shrink-0 flex-col items-center justify-center">
              <SlideAiIllustration />
              <p className="mt-3 text-sm font-semibold text-[var(--sr-text-primary)]">{pl.onboardingSlide2Title}</p>
              <p className="mt-1 max-w-[240px] text-center text-xs text-[var(--sr-text-muted)]">{pl.onboardingSlide2Desc}</p>
            </div>
            {/* Slide 3 — Progress & badges */}
            <div className="sr-carousel-slide flex w-full shrink-0 flex-col items-center justify-center">
              <SlideProgressIllustration isActive={activeSlide === 2} />
              <p className="mt-3 text-sm font-semibold text-[var(--sr-text-primary)]">{pl.onboardingSlide3Title}</p>
              <p className="mt-1 max-w-[240px] text-center text-xs text-[var(--sr-text-muted)]">{pl.onboardingSlide3Desc}</p>
            </div>
          </div>
          {/* Dots indicator */}
          <div className="mt-3 flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <button
                key={i}
                type="button"
                className={cn('flex min-h-[var(--sr-spacing-touch)] min-w-[var(--sr-spacing-touch)] items-center justify-center rounded-full', FOCUS_RING)}
                aria-label={pl.onboardingSlideAria(i + 1, 3)}
                aria-current={i === activeSlide}
                onClick={() => {
                  carouselRef.current?.scrollTo({
                    left: i * (carouselRef.current?.clientWidth ?? 0),
                    behavior: 'smooth',
                  })
                }}
              >
                <span
                  className="block rounded-full transition-all"
                  style={{
                    height: 6,
                    width: i === activeSlide ? 20 : 6,
                    background: i === activeSlide
                      ? 'var(--sr-brand-primary)'
                      : 'var(--sr-bg-surface)',
                  }}
                />
              </button>
            ))}
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
              onToggle={() => setWantStrong(!wantStrong)}
            />
            <InterestCard
              selected={wantCustom}
              icon={LayoutGrid}
              title={pl.onboardingInterestCustomTitle}
              body={pl.onboardingInterestCustomBody}
              accent="var(--sr-brand-secondary)"
              accentMuted="var(--sr-brand-secondary-muted)"
              onToggle={() => setWantCustom(!wantCustom)}
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
          {!programsOk && (
            <p className="mt-2 sr-text-body-sm text-[var(--sr-text-muted)] sr-onboard-step sr-onboard-stagger-1">
              {pl.onboardingPickProgramHint}
            </p>
          )}
          <div className="mt-6 flex flex-col gap-3 sr-onboard-step sr-onboard-stagger-2">
            {(['pushups', 'pullups', 'squats'] as Program[]).map((p) => {
              const selected = programs.includes(p)
              const accent = programAccent(p)
              const accentMuted =
                p === 'pushups'
                  ? 'var(--sr-pushups-accent-muted)'
                  : p === 'pullups'
                    ? 'var(--sr-pullups-accent-muted)'
                    : 'var(--sr-squats-accent-muted)'
              const title =
                p === 'pushups'
                  ? pl.pushupsProgram
                  : p === 'pullups'
                    ? pl.pullupsProgram
                    : pl.squatsProgram
              const desc =
                p === 'pushups'
                  ? pl.onboardingPushupsDesc
                  : p === 'pullups'
                    ? pl.onboardingPullupsDesc
                    : pl.onboardingSquatsDesc
              return (
                <ProgramCard
                  key={p}
                  selected={selected}
                  program={p}
                  accent={accent}
                  accentMuted={accentMuted}
                  title={title}
                  desc={desc}
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
          <div className="mb-4 flex flex-col items-center sr-onboard-step">
            <OnboardingIllustration step="next" />
          </div>
          <h2 className="text-center sr-text-h2 sr-onboard-step sr-onboard-stagger-1">{pl.onboardingNextTitleReady}</h2>
          {/* Summary of choices */}
          <div className="mt-4 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] px-4 py-3 text-center sr-onboard-step sr-onboard-stagger-2">
            <p className="text-pretty sr-text-body-sm text-[var(--sr-text-secondary)]">
              {pl.onboardingNextSummary(choicesLabel)}
            </p>
          </div>
          {/* Concise bullets — what happens next */}
          <div className="mt-4 flex flex-col gap-2 sr-onboard-step sr-onboard-stagger-3">
            <NextBullet icon={Compass} text={pl.onboardingNextBulletHome} />
            {wantStrong && <NextBullet icon={Dumbbell} text={pl.onboardingNextBulletStrong} />}
            {wantCustom && <NextBullet icon={LayoutGrid} text={pl.onboardingNextBulletCustom} />}
            <NextBullet icon={Users} text={pl.onboardingNextBulletCommunity} />
            <NextBullet icon={Sparkles} text={pl.onboardingNextBulletAiProgress} />
          </div>
          <p className="mt-5 text-center text-pretty sr-text-body font-semibold text-[var(--sr-brand-primary)] sr-onboard-step sr-onboard-stagger-4">
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
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {children}
      </div>
      <div className="mt-6 flex shrink-0 flex-col gap-2.5">{footer}</div>
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
      className={cn('min-h-[var(--sr-spacing-touch)] rounded-[var(--sr-radius-lg)] border-2 px-4 py-4 text-left transition-all active:scale-[0.98]', FOCUS_RING)}
      style={{
        borderColor: selected ? accent : 'var(--sr-border-subtle)',
        background: selected ? accentMuted : 'transparent',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="flex size-11 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)] transition-all duration-200"
            style={{
              background: selected ? accent : 'var(--sr-bg-surface)',
              transform: selected ? 'scale(1.05)' : 'scale(1)',
            }}
            aria-hidden
          >
            <Icon
              size={22}
              className={selected ? 'text-[var(--sr-text-inverse)]' : 'text-[var(--sr-text-secondary)]'}
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-[var(--sr-text-primary)]">{title}</p>
            <p className="mt-1.5 text-pretty sr-text-body-sm leading-snug text-[var(--sr-text-secondary)]">
              {body}
            </p>
          </div>
        </div>
        {/* Selection indicator — circle with check */}
        <span
          className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full transition-all duration-200"
          style={{
            background: selected ? accent : 'transparent',
            border: selected ? 'none' : '2px solid var(--sr-border-strong)',
          }}
          aria-hidden
        >
          {selected && <Check size={14} className="text-[var(--sr-text-inverse)]" />}
        </span>
      </div>
    </button>
  )
}

function ProgramCard({
  selected,
  program,
  accent,
  accentMuted,
  title,
  desc,
  onToggle,
}: {
  selected: boolean
  program: Program
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
      className={cn('flex min-h-[var(--sr-spacing-touch)] items-center justify-between gap-3 rounded-[var(--sr-radius-lg)] border-2 px-4 py-3.5 text-left transition-all active:scale-[0.98]', FOCUS_RING)}
      style={{
        borderColor: selected ? accent : 'var(--sr-border-subtle)',
        background: selected ? accentMuted : 'transparent',
      }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)] transition-colors"
          style={{
            background: selected ? accent : 'var(--sr-bg-surface)',
            color: selected ? 'var(--sr-text-inverse)' : accent,
          }}
          aria-hidden
        >
          <ProgramIcon program={program} size={24} />
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

// Program icons — use shared ProgramIcon component for consistency

function NextBullet({ icon: Icon, text }: { icon?: LucideIcon; text: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-[var(--sr-radius-md)] bg-[var(--sr-bg-elevated)] px-3.5 py-3">
      {Icon && (
        <Icon size={16} className="mt-0.5 shrink-0 text-[var(--sr-brand-primary)]" aria-hidden />
      )}
      <p className="text-pretty sr-text-body-sm leading-snug text-[var(--sr-text-secondary)]">
        {text}
      </p>
    </div>
  )
}
