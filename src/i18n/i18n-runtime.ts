/**
 * Tiny runtime module for i18n — holds a reference to the active dictionary.
 * Kept separate from pl.ts and index.ts to avoid circular dependencies:
 * pl.ts imports this module (no circular), index.ts sets the active dict.
 */

let activeDict: Record<string, any> | null = null

export function setActiveDict(dict: Record<string, any> | null): void {
  activeDict = dict
}

export function getActiveDict(): Record<string, any> | null {
  return activeDict
}
