import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { pl } from '@/i18n/pl'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="mx-auto max-w-lg px-4 py-8 safe-top safe-bottom">
      <PageHeader title={pl.notFoundTitle} subtitle={pl.notFoundBody} />
      <Button fullWidth onClick={() => navigate('/', { replace: true })}>
        {pl.backHome}
      </Button>
    </div>
  )
}
