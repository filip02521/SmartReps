import { test, expect } from '@playwright/test'

test('progress page loads', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(`PAGE ERROR: ${err.message}`))

  await page.goto('http://localhost:4173/progress', { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)

  const bodyText = await page.textContent('body')
  console.log('BODY TEXT (first 500 chars):', bodyText?.slice(0, 500))
  console.log('ERRORS:', JSON.stringify(errors, null, 2))
})
