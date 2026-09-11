import { Compass } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { pl } from '@/i18n/pl'
import { useSeo } from '@/hooks/useSeo'
import { useNavigate } from 'react-router-dom'

export default function NotFound() {
  const navigate = useNavigate()
  useSeo({ title: pl.seoNotFoundTitle, description: pl.seoNotFoundDescription })
  return (
    <div className="mx-auto max-w-lg px-4 py-8 safe-top safe-bottom">
      <div className="mb-6 flex flex-col items-center gap-4 text-center">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--sr-bg-surface)] text-[var(--sr-text-muted)]"
          aria-hidden
        >
          <Compass size={32} strokeWidth={2} />
        </div>
      </div>
      <PageHeader
        title={pl.notFoundTitle}
        subtitle={pl.notFoundBody}
        onBack={() => navigate('/')}
      />
      <Button fullWidth size="touch" onClick={() => navigate('/', { replace: true })}>
        {pl.backHome}
      </Button>
    </div>
  )
}
