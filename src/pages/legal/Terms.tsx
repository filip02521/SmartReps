import { useNavigate, Link } from 'react-router-dom'
import { useSeo } from '@/hooks/useSeo'
import { PageHeader } from '@/components/ui/PageHeader'
import { pl } from '@/i18n/pl'

export default function TermsPage() {
  const navigate = useNavigate()
  useSeo({ title: pl.seoTermsTitle, description: pl.seoTermsDescription, path: '/terms' })
  return (
    <div className="mx-auto max-w-lg px-4 py-8 safe-top safe-bottom">
      <PageHeader title={pl.termsTitle} onBack={() => navigate('/')} />
      <div className="mt-2 space-y-4 text-sm leading-relaxed text-[var(--sr-text-secondary)]">
        <p>{pl.termsBody1}</p>
        <p>{pl.termsBody2}</p>
        <p>{pl.termsBody3}</p>
        <p>{pl.termsBody4}</p>
        <p>{pl.termsBody5}</p>
        <p>{pl.termsBody6}</p>
      </div>
      <p className="mt-8 text-sm">
        <Link to="/privacy" className="font-medium text-[var(--sr-brand-primary)] underline-offset-4 hover:underline">
          {pl.privacyLink}
        </Link>
      </p>
    </div>
  )
}
