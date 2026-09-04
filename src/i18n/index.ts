import { useEffect, useState } from 'react'
import { pl, type Translation } from './pl'
import { en } from './en'
import { useAppStore } from '@/stores/app-store'
import { setActiveDict } from './i18n-runtime'

export type Lang = 'pl' | 'en'

export type { Translation }

const dictionaries: Record<Lang, Translation> = {
  pl,
  en: en as unknown as Translation,
}

/** Current language from the store (non-reactive). */
export function currentLang(): Lang {
  return useAppStore.getState().settings.language ?? 'pl'
}

/** Current translation object (non-reactive, for lib/non-component code). */
let _t: Translation = pl

function syncT(): void {
  const lang = currentLang()
  _t = dictionaries[lang] ?? pl
  // Update the proxy's active dictionary so all `pl` imports localize
  setActiveDict(lang === 'en' ? (en as unknown as Translation) : null)
}

// Initialize from store state
syncT()

// Keep _t and active dict in sync with store changes
useAppStore.subscribe((s) => {
  const lang = s.settings.language ?? 'pl'
  const next = dictionaries[lang] ?? pl
  if (_t !== next) {
    _t = next
    setActiveDict(lang === 'en' ? (en as unknown as Translation) : null)
  }
})

/**
 * Reactive proxy for non-component code (lib files, utilities, services).
 * Reads from the current language's translation object.
 * Use `useT()` inside React components for reactivity.
 */
export const t = new Proxy({} as Translation, {
  get(_target, prop: string) {
    return (_t as Record<string, unknown>)[prop]
  },
})

/**
 * React hook that returns the translation object for the current language.
 * Triggers re-render when language changes.
 */
export function useT(): Translation {
  const lang = useAppStore((s) => s.settings.language ?? 'pl')
  // Force re-render when language changes
  const [, force] = useState(0)
  useEffect(() => {
    const unsub = useAppStore.subscribe((s) => {
      if (s.settings.language !== lang) force((n) => n + 1)
    })
    return unsub
  }, [lang])
  return dictionaries[lang] ?? pl
}

/** Get available languages. */
export const availableLanguages: { code: Lang; label: string; nativeLabel: string }[] = [
  { code: 'pl', label: 'Polish', nativeLabel: 'Polski' },
  { code: 'en', label: 'English', nativeLabel: 'English' },
]

/** Detect browser language and return matching Lang code. */
export function detectBrowserLang(): Lang {
  if (typeof navigator === 'undefined') return 'pl'
  const browserLang = navigator.language.toLowerCase()
  if (browserLang.startsWith('pl')) return 'pl'
  if (browserLang.startsWith('en')) return 'en'
  return 'pl'
}

// Backward compatibility — re-export pl for gradual migration
export { pl }
