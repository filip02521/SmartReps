/**
 * Centralized date-fns locale helper.
 *
 * All date formatting in the app should use `dateFnsLocale()` instead of
 * importing `pl as plLocale` directly from `date-fns/locale`. This ensures
 * dates are formatted in the user's selected language (pl or en).
 */
import { pl as plLocale, enUS as enLocale } from 'date-fns/locale'
import type { Locale } from 'date-fns'
import { currentLang } from '@/i18n'

/** Returns the date-fns Locale matching the user's current UI language. */
export function dateFnsLocale(): Locale {
  return currentLang() === 'en' ? enLocale : plLocale
}

/** Returns the BCP-47 tag for the user's current UI language (for toLocaleDateString). */
export function dateBcp47(): string {
  return currentLang() === 'en' ? 'en-US' : 'pl-PL'
}
