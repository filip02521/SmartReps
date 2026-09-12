import { NoticeCard, noticeIcon, Lightbulb, AlertTriangle, Info, CheckCircle2 } from '@/components/ux/NoticeCard'
import type { HomeTipModel, TipKind } from '@/lib/home-summary'
import { pl } from '@/i18n/pl'
import type { Program } from '@/data/plans/types'
import type { NoticeTone } from '@/components/ux/NoticeCard'
import type { ReactNode } from 'react'
import { Activity, BarChart3, ChevronRight, List, Sparkles, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'

function tipMeta(kind: TipKind): { tone: NoticeTone; title: string; icon: ReactNode } {
  switch (kind) {
    case 'welcome':
      return { tone: 'brand', title: pl.homeTipTitleWelcome, icon: <Sparkles size={20} strokeWidth={2.25} /> }
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
  const isWelcome = tip.kind === 'welcome'
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
      message={isWelcome ? undefined : tip.message}
      actionLabel={actionLabel}
      onAction={handleAction}
      stackActions={Boolean(actionLabel && handleAction)}
      demotePrimary={!isWelcome}
      onDismiss={tip.dismissible ? () => onDismiss(tip.id) : undefined}
    >
      {isWelcome && (
        <WelcomeGuide
          scrollProgram={tip.scrollProgram}
          onScroll={onScroll}
          onNavigate={onNavigate}
        />
      )}
    </NoticeCard>
  )
}

type WelcomeItemDef = {
  icon: ReactNode
  title: string
  description: string
  onClick?: () => void
}

function WelcomeGuide({
  scrollProgram,
  onScroll,
  onNavigate,
}: {
  scrollProgram?: Program | null
  onScroll?: (program: Program) => void
  onNavigate?: (path: string) => void
}) {
  const items: WelcomeItemDef[] = [
    {
      icon: <Activity size={16} strokeWidth={2.25} />,
      title: pl.navWorkout,
      description: pl.homeTipWelcomeTraining,
      onClick: scrollProgram && onScroll ? () => onScroll(scrollProgram) : undefined,
    },
    {
      icon: <BarChart3 size={16} strokeWidth={2.25} />,
      title: pl.navProgress,
      description: pl.homeTipWelcomeProgress,
      onClick: onNavigate ? () => onNavigate('/progress') : undefined,
    },
    {
      icon: <List size={16} strokeWidth={2.25} />,
      title: pl.navPlans,
      description: pl.homeTipWelcomePlans,
      onClick: onNavigate ? () => onNavigate('/plans') : undefined,
    },
    {
      icon: <User size={16} strokeWidth={2.25} />,
      title: pl.navProfile,
      description: pl.homeTipWelcomeProfile,
      onClick: onNavigate ? () => onNavigate('/profile') : undefined,
    },
  ]

  return (
    <div className="mt-3">
      <ul className="flex flex-col gap-1.5" aria-label={pl.homeTipTitleWelcome}>
        {items.map((item, i) => (
          <WelcomeItem key={i} {...item} />
        ))}
      </ul>
      <p className="mt-3 flex items-center gap-1.5 text-xs leading-relaxed text-[var(--sr-text-muted)]">
        <ChevronRight size={14} className="shrink-0 rotate-90" aria-hidden />
        {pl.homeTipWelcomeHint}
      </p>
    </div>
  )
}

function WelcomeItem({ icon, title, description, onClick }: WelcomeItemDef) {
  const clickable = Boolean(onClick)
  return (
    <li>
      <button
        type="button"
        disabled={!clickable}
        onClick={onClick}
        aria-label={`${title}. ${description}`}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-[var(--sr-radius-md)] p-2 text-left transition-colors',
          clickable && 'hover:bg-[var(--sr-bg-surface)] active:bg-[var(--sr-bg-surface)]',
          clickable && FOCUS_RING,
          !clickable && 'cursor-default',
        )}
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--sr-radius-sm)] bg-[var(--sr-brand-primary-muted)] text-[var(--sr-brand-primary)]"
          aria-hidden
        >
          {icon}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm font-medium leading-snug text-[var(--sr-text-primary)]">
            {title}
          </span>
          <span className="text-xs leading-relaxed text-[var(--sr-text-secondary)]">
            {description}
          </span>
        </span>
        {clickable && (
          <ChevronRight
            size={16}
            className="shrink-0 text-[var(--sr-text-muted)]"
            aria-hidden
          />
        )}
      </button>
    </li>
  )
}
