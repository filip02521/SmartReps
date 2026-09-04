import { useEffect } from 'react'
import { pl } from '@/i18n/pl'

const SITE_NAME = 'SmartReps'
const DEFAULT_DESCRIPTION = pl.seoDefaultDescription

/**
 * Sets document.title and meta[name=description] per route.
 * Also updates og:title, og:description, og:url, twitter:title,
 * twitter:description, and canonical link for the current URL.
 *
 * This gives search engines and link previews route-specific metadata
 * without requiring SSR — crawlers that execute JS (Googlebot) will see
 * the updated tags, and the static fallback in index.html covers the rest.
 */
export function useSeo({
  title,
  description,
  path,
}: {
  /** Page-specific title without site name suffix. */
  title: string
  /** Page-specific description (120–160 chars ideal). */
  description?: string
  /** Current pathname for canonical/og:url. */
  path?: string
}) {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME
    document.title = fullTitle

    const desc = description ?? DEFAULT_DESCRIPTION
    setMetaTag('name', 'description', desc)
    setMetaTag('property', 'og:title', fullTitle)
    setMetaTag('property', 'og:description', desc)
    setMetaTag('name', 'twitter:title', fullTitle)
    setMetaTag('name', 'twitter:description', desc)

    if (path) {
      const url = `https://smart-reps.vercel.app${path}`
      setMetaTag('property', 'og:url', url)
      setCanonical(url)
    }
  }, [title, description, path])
}

function setMetaTag(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}
