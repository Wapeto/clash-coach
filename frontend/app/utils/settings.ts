export interface Settings {
  mode: 'fast' | 'deep'
}

export const DEFAULT_SETTINGS: Settings = { mode: 'fast' }

const STORAGE_KEY = 'clash-coach-settings'

export function getSettings(): Settings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      mode: parsed.mode === 'deep' ? 'deep' : 'fast',
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(s: Settings): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

export function getApiMode(): 'fast' | 'deep' {
  return getSettings().mode
}
