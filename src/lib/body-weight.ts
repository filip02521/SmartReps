import { db, type BodyWeightEntry } from '@/lib/db'
import { enqueueSync } from '@/lib/sync'
import { sanitizeWeight } from '@/lib/sanitize'

/**
 * Body weight tracking service.
 * Stores entries locally in IndexedDB (offline-first) and enqueues
 * cloud sync via the same pull/push flow as other entities.
 */

export async function listBodyWeightEntries(): Promise<BodyWeightEntry[]> {
  const rows = await db.bodyWeight.toArray()
  return rows.sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime())
}

export async function addBodyWeightEntry(weightKg: number, note?: string): Promise<BodyWeightEntry> {
  // Validate raw value BEFORE sanitization (sanitizeWeight clamps, which would hide out-of-range)
  if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 500) {
    throw new Error('Invalid weight value')
  }
  const sanitizedWeight = sanitizeWeight(weightKg, 500)
  const entry: BodyWeightEntry = {
    id: crypto.randomUUID(),
    weightKg: sanitizedWeight,
    measuredAt: new Date().toISOString(),
    note: note?.trim() || undefined,
  }
  await db.bodyWeight.add(entry)
  await enqueueSync('body_weight_entries', 'insert', entry)
  return entry
}

export async function deleteBodyWeightEntry(id: string): Promise<void> {
  const entry = await db.bodyWeight.get(id)
  // Store tombstone BEFORE local delete to prevent resurrection by cross-device sync
  await db.bodyWeightTombstones.put({ entryId: id, deletedAt: new Date().toISOString() })
  await db.bodyWeight.delete(id)
  if (entry) {
    await enqueueSync('body_weight_entries', 'delete', entry)
  }
}

export async function getLatestBodyWeight(): Promise<BodyWeightEntry | undefined> {
  const entries = await listBodyWeightEntries()
  return entries[0]
}

/**
 * Get body weight trend for the last N entries.
 * Returns entries in chronological order (oldest first).
 */
export async function getBodyWeightTrend(limit = 30): Promise<BodyWeightEntry[]> {
  const entries = await listBodyWeightEntries()
  return entries.slice(0, limit).reverse()
}
