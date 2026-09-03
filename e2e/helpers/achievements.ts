import type { Page } from '@playwright/test'

/** Close achievement unlock / backfill sheets if they cover the UI. */
export async function dismissAchievementUi(page: Page) {
  // Evaluate may enqueue after navigation — give the first sheet a moment.
  for (let i = 0; i < 10; i++) {
    const dialog = page
      .getByRole('dialog')
      .filter({ hasText: /Nowa odznaka|Odznaki z historii/ })
    const visible = await dialog.first().isVisible().catch(() => false)
    if (!visible) {
      if (i === 0) {
        await page.waitForTimeout(600)
        continue
      }
      return
    }
    // Sheet header + body may both expose "Zamknij" — take the last (primary).
    await dialog.first().getByRole('button', { name: 'Zamknij' }).last().click()
    await page.waitForTimeout(250)
  }
}
