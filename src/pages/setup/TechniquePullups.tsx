import { TechniqueGuide } from '@/components/setup/TechniqueGuide'
import { useSeo } from '@/hooks/useSeo'
import { pl } from '@/i18n/pl'

export default function TechniquePullups() {
  useSeo({ title: pl.seoTechniquePullupsTitle, description: pl.seoTechniquePullupsDescription, path: '/setup/technique-pullups' })
  return <TechniqueGuide program="pullups" />
}
