import type { Program } from '@/data/plans/types'
import { useAppStore } from '@/stores/app-store'

export function parseEnabledPrograms(raw: string[] | null | undefined): Program[] {
  const valid = (raw ?? []).filter((p): p is Program => p === 'pushups' || p === 'pullups')
  return valid.length ? valid : ['pushups']
}

export type RemoteProfileSettings = {
  enabled_programs: string[] | null
  enabled_programs_updated_at: string | null
}

/**
 * Merge remote profile enabled_programs with local using last-write-wins.
 * Falls back to local when remote columns are absent (pre-migration clients).
 */
export function mergeEnabledProgramsFromProfile(remote: RemoteProfileSettings | null): boolean {
  if (!remote?.enabled_programs?.length || !remote.enabled_programs_updated_at) {
    return false
  }

  const remotePrograms = parseEnabledPrograms(remote.enabled_programs)
  const remoteUpdatedAt = remote.enabled_programs_updated_at
  const { settings, enabledProgramsUpdatedAt } = useAppStore.getState()

  const localTime = enabledProgramsUpdatedAt ? new Date(enabledProgramsUpdatedAt).getTime() : 0
  const remoteTime = new Date(remoteUpdatedAt).getTime()

  if (remoteTime <= localTime) return false

  const same =
    remotePrograms.length === settings.enabledPrograms.length &&
    remotePrograms.every((p) => settings.enabledPrograms.includes(p))

  if (same) {
    useAppStore.setState({ enabledProgramsUpdatedAt: remoteUpdatedAt })
    return false
  }

  useAppStore.setState({
    settings: { ...settings, enabledPrograms: remotePrograms },
    enabledProgramsUpdatedAt: remoteUpdatedAt,
  })
  return true
}

/** Programs with Dexie progress that must stay addressable after sync (legacy fallback). */
export function mergeEnabledProgramsFromProgress(programs: Program[]): boolean {
  const { settings } = useAppStore.getState()
  const enabled = new Set(settings.enabledPrograms)
  let changed = false

  for (const program of programs) {
    if (!enabled.has(program)) {
      enabled.add(program)
      changed = true
    }
  }

  if (changed) {
    useAppStore.setState({
      settings: { ...settings, enabledPrograms: Array.from(enabled) as Program[] },
      enabledProgramsUpdatedAt: new Date().toISOString(),
    })
  }

  return changed
}
