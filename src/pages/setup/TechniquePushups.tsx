import { TechniqueGuide } from '@/components/setup/TechniqueGuide'
import { useSeo } from '@/hooks/useSeo'
import { pl } from '@/i18n/pl'

export default function TechniquePushups() {
  useSeo({ title: pl.seoTechniquePushupsTitle, description: pl.seoTechniquePushupsDescription, path: '/setup/technique' })
  return <TechniqueGuide program="pushups" />
}
