/** PL-friendly slugify for community publication URLs. */

const PL_MAP: Record<string, string> = {
  ą: 'a',
  ć: 'c',
  ę: 'e',
  ł: 'l',
  ń: 'n',
  ó: 'o',
  ś: 's',
  ź: 'z',
  ż: 'z',
}

export function slugify(input: string): string {
  const base = input
    .trim()
    .toLowerCase()
    .split('')
    .map((ch) => PL_MAP[ch] ?? ch)
    .join('')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)

  return base.length >= 2 ? base : 'plan'
}

/** Immutable-ish slug: title slug + short id suffix. */
export function communitySlugFromTitle(title: string, idSuffix: string): string {
  const suffix = idSuffix.replace(/-/g, '').slice(0, 6).toLowerCase()
  return `${slugify(title)}-${suffix}`
}
