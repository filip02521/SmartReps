import { TechniqueGuide } from '@/components/setup/TechniqueGuide'
import { useSeo } from '@/hooks/useSeo'
import { pl } from '@/i18n/pl'

export default function TechniqueSquats() {
  useSeo({ title: pl.seoTechniqueSquatsTitle, description: pl.seoTechniqueSquatsDescription, path: '/setup/technique-squats' })
  return <TechniqueGuide program="squats" />
}
