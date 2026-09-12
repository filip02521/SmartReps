import { NoticeCard, noticeIcon, Lightbulb, AlertTriangle, Info, CheckCircle2 } from '@/components/ux/NoticeCard'
import type { HomeTipModel, TipKind } from '@/lib/home-summary'
import { pl } from '@/i18n/pl'
import type { Program } from '@/data/plans/types'
import type { NoticeTone } from '@/components/ux/NoticeCard'
import type { ReactNode } from 'react'
import { Activity, BarChart3, List, User } from 'lucide-react'

function tipMeta(kind: TipKind): { tone: NoticeTone; title: string; icon: ReactNode } {
  switch (kind) {
    case 'welcome':
      return { tone: 'brand', title: pl.homeTipTitleWelcome, icon: noticeIcon('brand') }
    case 'stale':
      return { tone: 'warning', title: pl.homeTipTitleStale, icon: <AlertTriangle size={20} strokeWidth={2.25} /> }
    case 'test_ready':
      return { tone: 'info', title: pl.homeTipTitleTestReady, icon: <Info size={20} strokeWidth={2.25} /> }
    case 'test_rest':
      return { tone: 'info', title: pl.homeTipTitleTestRest, icon: <Info size={20} strokeWidth={2.25} /> }
    case 'level':
      return { tone: 'warning', title: pl.homeTipTitleLevel, icon: <AlertTriangle size={20} strokeWidth={2.25} /> }
    case 'return_after_break':
      return { tone: 'neutral', title: pl.homeTipTitleReturnAfterBreak, icon: <Lightbulb size={20} strokeWidth={2.25} /> }
    case 'habit_almost':
      return { tone: 'neutral', title: pl.homeTipTitleHabitAlmost, icon: <Lightbulb size={20} strokeWidth={2.25} /> }
    case 'dual_program':
      return { tone: 'info', title: pl.homeTipTitleDualProgram, icon: <Info size={20} strokeWidth={2.25} /> }
    case 'login_backup':
      return { tone: 'info', title: pl.homeTipTitleLoginBackup, icon: <Info size={20} strokeWidth={2.25} /> }
    case 'habit_met':
      return { tone: 'success', title: pl.homeTipTitleHabitMet, icon: <CheckCircle2 size={20} strokeWidth={2.25} /> }
    case 'habit_zero':
      return { tone: 'neutral', title: pl.homeTipTitleHabitZero, icon: <Lightbulb size={20} strokeWidth={2.25} /> }
    case 'achievement':
      return {
        tone: 'brand',
        title: pl.achievementsHomeTipTitle,
        icon: noticeIcon('brand'),
      }
    case 'plateau':
      return { tone: 'warning', title: pl.coachPlateauTitle, icon: <AlertTriangle size={20} strokeWidth={2.25} /> }
    default:
      return { tone: 'info', title: pl.homeTipTitleDefault, icon: noticeIcon('info') }
  }
}

export function HomeTip({
  tip,
  onDismiss,
  onAction,
  onScroll,
  onNavigate,
}: {
  tip: HomeTipModel
  onDismiss: (id: string) => void
  onAction?: (program: Program) => void
  onScroll?: (program: Program) => void
  onNavigate?: (path: string) => void
}) {
  const meta = tipMeta(tip.kind)
  const actionLabel =
    tip.actionLabel ??
    (tip.scrollProgram ? pl.homeTipShowCard : undefined)
  const handleAction =
    tip.navigateTo && onNavigate
      ? () => onNavigate(tip.navigateTo!)
      : tip.actionLabel && tip.actionProgram && onAction
        ? () => onAction(tip.actionProgram!)
        : tip.scrollProgram && onScroll
          ? () => onScroll(tip.scrollProgram!)
          : tip.dismissible && tip.actionLabel && !tip.scrollProgram && !tip.navigateTo && !tip.actionProgram
            ? () => onDismiss(tip.id)
            : undefined

  return (
    <NoticeCard
      className="mb-4"
      tone={meta.tone}
      icon={meta.icon}
      title={tip.title ?? meta.title}
      message={tip.kind === 'welcome' ? undefined : tip.message}
      actionLabel={actionLabel}
      onAction={handleAction}
      stackActions={Boolean(actionLabel && handleAction)}
      demotePrimary
      onDismiss={tip.dismissible ? () => onDismiss(tip.id) : undefined}
    >
      {tip.kind === 'welcome' && (
        <ul className="mt-2 flex flex-col gap-2">
          <WelcomeItem icon={<Activity size={16} />} text={pl.homeTipWelcomeTraining} />
          <WelcomeItem icon={<BarChart3 size={16} />} text={pl.homeTipWelcomeProgress} />
          <WelcomeItem icon={<List size={16} />} text={pl.homeTipWelcomePlans} />
          <WelcomeItem icon={<User size={16} />} text={pl.homeTipWelcomeProfile} />
        </ul>
      )}
    </NoticeCard>
  )
}

function WelcomeItem({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0 text-[var(--sr-brand-primary)]" aria-hidden>
        {icon}
      </span>
      <span className="sr-text-body-sm leading-relaxed text-[var(--sr-text-secondary)]">
        {text}
      </span>
    </li>
  )
}
