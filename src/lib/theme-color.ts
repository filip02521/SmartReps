/** Apply theme-color meta for PWA chrome to match light/dark surfaces. */
export function applyThemeColor(theme: 'system' | 'dark' | 'light'): void {
  const prefersDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  const darkMeta = document.querySelector('#sr-theme-color') as HTMLMetaElement | null
  const lightMeta = document.querySelector('#sr-theme-color-light') as HTMLMetaElement | null
  if (darkMeta) darkMeta.content = prefersDark ? '#09090B' : '#6366F1'
  if (lightMeta) lightMeta.content = prefersDark ? '#09090B' : '#FAFAFA'
  /* Helps iOS overscroll / form controls match the in-app theme. */
  document.documentElement.style.colorScheme = prefersDark ? 'dark' : 'light'
}

export function hideBootSplash(): void {
  const el = document.getElementById('sr-boot-splash')
  if (!el) return
  el.setAttribute('data-hide', '1')
  window.setTimeout(() => el.remove(), 300)
}
