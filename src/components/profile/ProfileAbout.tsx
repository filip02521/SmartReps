import { Link } from 'react-router-dom'
import { LogoMark } from '@/components/brand/Logo'
import { Shield, FileText, HeartPulse } from 'lucide-react'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'

const appVersion = import.meta.env.VITE_APP_VERSION ?? '1.0.0'

/**
 * About section — app identity, legal links, health disclaimer.
 * Redesigned with visual hierarchy: logo, row-based links, notice card.
 */
export function ProfileAbout({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* App identity */}
      <div className="flex items-center gap-3 rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] p-4">
        <LogoMark size={40} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[var(--sr-text-primary)]">
            {pl.appName}
          </p>
          <p className="mt-0.5 text-xs text-[var(--sr-text-secondary)]">
            {pl.profileAboutHint}
          </p>
        </div>
        <span className="shrink-0 text-xs text-[var(--sr-text-muted)]">
          v{appVersion}
        </span>
      </div>

      {/* Legal links — row-based */}
      <div className="flex flex-col gap-px overflow-hidden rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)]">
        <Link
          to="/privacy"
          className="flex items-center gap-3 bg-[var(--sr-bg-elevated)] px-4 py-3 text-sm text-[var(--sr-text-primary)] transition-colors hover:bg-[var(--sr-bg-surface)]"
        >
          <Shield size={18} className="shrink-0 text-[var(--sr-text-muted)]" aria-hidden />
          <span className="flex-1">{pl.profileAboutPrivacy}</span>
        </Link>
        <Link
          to="/terms"
          className="flex items-center gap-3 bg-[var(--sr-bg-elevated)] px-4 py-3 text-sm text-[var(--sr-text-primary)] transition-colors hover:bg-[var(--sr-bg-surface)]"
        >
          <FileText size={18} className="shrink-0 text-[var(--sr-text-muted)]" aria-hidden />
          <span className="flex-1">{pl.profileAboutTerms}</span>
        </Link>
      </div>

      {/* Licenses — exercise media attribution */}
      <div className="rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] px-4 py-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--sr-text-muted)]">
          {pl.profileAboutLicenses}
        </p>
        <div className="flex flex-col gap-2 text-xs leading-relaxed text-[var(--sr-text-secondary)]">
          <p>
            {pl.licenseExerciseVideos}{' '}
            <a
              href="https://github.com/harshvishu/free-exercise-db-with-videos"
              className="text-[var(--sr-brand-primary)] underline-offset-4 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              free-exercise-db-with-videos
            </a>{' '}
            {pl.licenseMit}{' '}
            <a
              href="https://opensource.org/licenses/MIT"
              className="text-[var(--sr-brand-primary)] underline-offset-4 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              MIT
            </a>{' '}
            © 2026 Arham Wani
          </p>
          <p>
            {pl.licenseIllustrations}{' '}
            <a
              href="https://github.com/bryllim/workout-guide"
              className="text-[var(--sr-brand-primary)] underline-offset-4 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              @bryllim/workout-guide
            </a>{' '}
            {pl.licenseAnd}{' '}
            <a
              href="https://github.com/RepDB/exercise-dataset"
              className="text-[var(--sr-brand-primary)] underline-offset-4 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              RepDB
            </a>{' '}
            <a
              href="https://creativecommons.org/licenses/by-sa/4.0/"
              className="text-[var(--sr-brand-primary)] underline-offset-4 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              CC BY-SA 4.0
            </a>
          </p>
        </div>
      </div>

      {/* Health disclaimer — notice card style */}
      <div className="flex items-start gap-2.5 rounded-[var(--sr-radius-md)] border border-[var(--sr-warning)]/30 bg-[var(--sr-warning-muted)]/40 p-3">
        <HeartPulse size={18} className="mt-0.5 shrink-0 text-[var(--sr-warning)]" aria-hidden />
        <p className="text-xs leading-relaxed text-[var(--sr-text-secondary)]">
          {pl.healthDisclaimer}
        </p>
      </div>
    </div>
  )
}
