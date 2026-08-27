import { LogoFull } from '@/components/brand/Logo'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { pl } from '@/i18n/pl'
import { useNavigate } from 'react-router-dom'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="mx-auto max-w-lg px-4 py-8 safe-top safe-bottom">
      <LogoFull height={36} className="mx-auto mb-6" />
      <PageHeader title={pl.notFoundTitle} subtitle={pl.notFoundBody} />
      <Button fullWidth onClick={() => navigate('/', { replace: true })}>
        {pl.backHome}
      </Button>
    </div>
  )
}
