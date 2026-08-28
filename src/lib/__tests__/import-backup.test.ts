import { describe, expect, it } from 'vitest'
import {
  parseSessionsCsv,
  isBackupSnapshotV1,
  assertImportFileSize,
} from '@/lib/import-backup'
import { mergeSessionCsvExports } from '@/lib/export'

describe('parseSessionsCsv', () => {
  it('parses export header and row', () => {
    const csv = [
      'data,session_id,program,cycle_id,day,attempt,status,passed,total_reps,sets',
      '2026-02-01,abc123,pushups,pushups-6-10,1,1,completed,true,25,"S1:10|S2:15"',
    ].join('\n')
    const rows = parseSessionsCsv(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('abc123')
    expect(rows[0].totalReps).toBe(25)
    expect(rows[0].setResults).toHaveLength(2)
  })
})

describe('isBackupSnapshotV1', () => {
  it('accepts minimal v1 snapshot', () => {
    expect(
      isBackupSnapshotV1({
        version: 1,
        exportedAt: new Date().toISOString(),
        settings: {},
        programProgress: [],
        workoutSessions: [],
        maxTests: [],
      }),
    ).toBe(true)
  })

  it('rejects invalid payload', () => {
    expect(isBackupSnapshotV1({ version: 2 })).toBe(false)
  })
})

describe('assertImportFileSize', () => {
  it('throws when over 5MB', () => {
    expect(() => assertImportFileSize(6 * 1024 * 1024)).toThrow('file_too_large')
  })
})

describe('merge round-trip', () => {
  it('parses merged export CSV', () => {
    const header =
      'data,session_id,program,cycle_id,day,attempt,status,passed,total_reps,sets'
    const merged = mergeSessionCsvExports([
      [header, '2026-02-02,s2,pushups,c1,1,1,completed,true,10,"S1:10"'].join('\n'),
      [header, '2026-01-01,s1,pullups,c2,1,1,completed,true,5,"S1:5"'].join('\n'),
    ])
    const rows = parseSessionsCsv(merged)
    expect(rows).toHaveLength(2)
  })
})
