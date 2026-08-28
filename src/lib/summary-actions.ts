import type { NavigateFunction } from 'react-router-dom'
import type { Program } from '@/data/plans/types'
import type { LocalProgramProgress } from '@/lib/db'
import { pl } from '@/i18n/pl'
import { beginLevelChange } from '@/lib/setup-flow'

export type SummaryAction = {
  label: string
  variant?: 'secondary' | 'ghost'
  onClick: (ctx: { navigate: NavigateFunction }) => void
}

export function getSummaryActions({
  failed,
  progress,
  program,
}: {
  failed: boolean
  progress: LocalProgramProgress | undefined
  program: Program
}): { secondary: SummaryAction[] } {
  if (failed) {
    return {
      secondary: [
        {
          label: pl.summaryCtaLevelChange,
          onClick: ({ navigate }) => void beginLevelChange(navigate, program),
        },
        {
          label: pl.summaryCtaRetest,
          onClick: ({ navigate }) => navigate(`/setup/test/${program}?retest=1`),
        },
      ],
    }
  }

  if (progress?.status === 'test_pending') {
    return {
      secondary: [
        {
          label: pl.summaryCtaLater,
          variant: 'ghost',
          onClick: ({ navigate }) => navigate('/', { replace: true }),
        },
      ],
    }
  }

  return {
    secondary: [
      {
        label: pl.summaryCtaProgress,
        onClick: ({ navigate }) => navigate('/progress'),
      },
    ],
  }
}

export function shouldShowLoginCloudPrompt({
  passed,
  email,
  hasSeenLoginCloudPrompt,
}: {
  passed: boolean
  email: string | null | undefined
  hasSeenLoginCloudPrompt: boolean
}): boolean {
  return passed && !email && !hasSeenLoginCloudPrompt
}
