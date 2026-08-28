/** Apply theme-color meta for PWA chrome to match light/dark surfaces. */
export function applyThemeColor(theme: 'system' | 'dark' | 'light'): void {
  const meta = document.querySelector('#sr-theme-color') as HTMLMetaElement | null
  const prefersDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  if (meta) meta.content = prefersDark ? '#09090B' : '#FAFAFA'
  /* Helps iOS overscroll / form controls match the in-app theme. */
  document.documentElement.style.colorScheme = prefersDark ? 'dark' : 'light'
}

export function hideBootSplash(): void {
  const el = document.getElementById('sr-boot-splash')
  if (!el) return
  el.setAttribute('data-hide', '1')
  window.setTimeout(() => el.remove(), 300)
}
