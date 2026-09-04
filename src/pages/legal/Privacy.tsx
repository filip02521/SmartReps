import { useNavigate, Link } from 'react-router-dom'
import { useSeo } from '@/hooks/useSeo'
import { PageHeader } from '@/components/ui/PageHeader'
import { pl } from '@/i18n/pl'

export default function PrivacyPage() {
  const navigate = useNavigate()
  useSeo({ title: pl.seoPrivacyTitle, description: pl.seoPrivacyDescription, path: '/privacy' })
  return (
    <div className="mx-auto max-w-lg px-4 py-8 safe-top safe-bottom">
      <PageHeader
        title={pl.privacyTitle}
        onBack={() => navigate('/')}
      />
      <div className="mt-2 space-y-4 text-sm leading-relaxed text-[var(--sr-text-secondary)]">
        <p>{pl.privacyBody1}</p>
        <p>{pl.privacyBody2}</p>
        <p>{pl.privacyBody3}</p>
        <p>
          <strong>{pl.privacyBodyExport}</strong> {pl.privacyBodyExportDetail}
        </p>
        <p>
          <strong>{pl.privacyBodyCommunity}</strong> {pl.privacyBodyCommunityDetail}
        </p>
        <p>
          <strong>{pl.privacyBodyDelete}</strong> {pl.privacyBodyDeleteDetail}
        </p>
        <p>{pl.privacyBodyLocal}</p>
        <p>{pl.privacyBodyContact}</p>
      </div>
      <p className="mt-8 text-sm">
        <Link to="/terms" className="font-medium text-[var(--sr-brand-primary)] underline-offset-4 hover:underline">
          {pl.termsLink}
        </Link>
      </p>
    </div>
  )
}
