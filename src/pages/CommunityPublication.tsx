import { useParams, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { CommunityPublicationView } from '@/components/community/CommunityPublicationView'
import { useSeo } from '@/hooks/useSeo'
import { pl } from '@/i18n/pl'

export default function CommunityPublicationPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  useSeo({
    title: pl.seoCommunityTitle,
    description: pl.seoCommunityDescription,
    path: slug ? `/community/${slug}` : '/community',
  })

  useEffect(() => {
    if (!slug) navigate('/not-found', { replace: true })
  }, [slug, navigate])

  if (!slug) return null
  return <CommunityPublicationView slug={slug} />
}
