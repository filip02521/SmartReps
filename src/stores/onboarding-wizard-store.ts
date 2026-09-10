import { create } from 'zustand'
import type { Program } from '@/data/plans/types'

type WizardStep = 'welcome' | 'interest' | 'programs' | 'next'

type OnboardingWizardState = {
  stepId: WizardStep
  wantStrong: boolean
  wantCustom: boolean
  programs: Program[]
  activeSlide: number
  hasSwiped: boolean
  setStepId: (step: WizardStep) => void
  setWantStrong: (v: boolean) => void
  setWantCustom: (v: boolean) => void
  setPrograms: (programs: Program[]) => void
  setActiveSlide: (n: number) => void
  setHasSwiped: (v: boolean) => void
  /** Reset to defaults — called when onboarding completes or wizard exits. */
  reset: () => void
}

const defaults = {
  stepId: 'welcome' as WizardStep,
  wantStrong: true,
  wantCustom: false,
  programs: ['pushups'] as Program[],
  activeSlide: 0,
  hasSwiped: false,
}

/**
 * In-memory (non-persisted) wizard state.
 * Survives the `key={language}` remount of <Routes> so changing language
 * mid-wizard doesn't reset the user to the welcome step.
 */
export const useOnboardingWizardStore = create<OnboardingWizardState>((set) => ({
  ...defaults,
  setStepId: (stepId) => set({ stepId }),
  setWantStrong: (wantStrong) => set({ wantStrong }),
  setWantCustom: (wantCustom) => set({ wantCustom }),
  setPrograms: (programs) => set({ programs }),
  setActiveSlide: (activeSlide) => set({ activeSlide }),
  setHasSwiped: (hasSwiped) => set({ hasSwiped }),
  reset: () => set(defaults),
}))
