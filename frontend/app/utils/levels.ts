/**
 * Clash Royale card rarity start levels.
 * All cards share a max in-game level of 16, but each rarity
 * begins at a different starting level. The API returns levels
 * relative to the rarity (1-based), so we offset by startLevel - 1.
 */
const RARITY_START_LEVEL: Record<string, number> = {
  common: 1,
  rare: 3,
  epic: 6,
  legendary: 9,
  champion: 11,
}

const MAX_GAME_LEVEL = 16

/**
 * Convert an API-relative card level to the actual in-game level.
 * e.g. a legendary with apiLevel=7 → 9 + 7 - 1 = 15
 */
export function toGameLevel(apiLevel: number, rarity: string): number {
  const start = RARITY_START_LEVEL[rarity.toLowerCase()] ?? 1
  return start + apiLevel - 1
}

/**
 * Returns a formatted "gameLevel/16" string.
 */
export function formatLevel(apiLevel: number, rarity: string): string {
  return `${toGameLevel(apiLevel, rarity)}/${MAX_GAME_LEVEL}`
}
