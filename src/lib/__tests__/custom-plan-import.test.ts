import { describe, expect, it } from 'vitest'
import { importCustomPlanFromJson } from '@/lib/custom-plan-service'

describe('importCustomPlanFromJson', () => {
  it('rejects invalid JSON', async () => {
    await expect(importCustomPlanFromJson('not json')).rejects.toThrow()
  })

  it('rejects payload without name or days', async () => {
    await expect(importCustomPlanFromJson(JSON.stringify({ foo: 1 }))).rejects.toThrow()
  })
})
