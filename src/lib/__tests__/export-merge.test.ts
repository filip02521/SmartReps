import { describe, expect, it } from 'vitest'
import { mergeSessionCsvExports } from '@/lib/export'

describe('mergeSessionCsvExports', () => {
  it('keeps a single header and sorts rows by date', () => {
    const a = [
      'data,session_id,program,cycle_id,day,attempt,status,passed,total_reps,sets',
      '2026-02-02,s2,pushups,c1,1,1,completed,true,10,"S1:10"',
    ].join('\n')
    const b = [
      'data,session_id,program,cycle_id,day,attempt,status,passed,total_reps,sets',
      '2026-01-01,s1,pullups,c2,1,1,completed,true,5,"S1:5"',
    ].join('\n')
    const merged = mergeSessionCsvExports([a, b])
    const lines = merged.split('\n')
    expect(lines[0]).toContain('data,session_id')
    expect(lines[1]).toContain('2026-01-01')
    expect(lines[2]).toContain('2026-02-02')
    expect(lines.filter((l) => l.startsWith('data,')).length).toBe(1)
  })
})
