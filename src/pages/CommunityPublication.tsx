import { useParams, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { CommunityPublicationView } from '@/components/community/CommunityPublicationView'

export default function CommunityPublicationPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  useEffect(() => {
    if (!slug) navigate('/not-found', { replace: true })
  }, [slug, navigate])

  if (!slug) return null
  return <CommunityPublicationView slug={slug} />
}
