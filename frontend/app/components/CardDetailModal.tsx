'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import { formatLevel, toGameLevel } from '../utils/levels'

interface Card {
  name: string
  level: number
  maxLevel: number
  rarity: string
  elixirCost?: number
  count?: number
  evolutionLevel?: number
  iconUrls: {
    medium: string
    evolutionMedium?: string
    heroMedium?: string
  }
}

interface Props {
  card: Card
  onClose: () => void
}

const RARITY_COLORS: Record<string, string> = {
  common: 'text-zinc-300 border-zinc-600',
  rare: 'text-blue-300 border-blue-500',
  epic: 'text-purple-300 border-purple-500',
  legendary: 'text-yellow-300 border-yellow-500',
  champion: 'text-red-300 border-red-500',
}

export default function CardDetailModal({ card, onClose }: Props) {
  const gameLevel = toGameLevel(card.level, card.rarity)
  const pct = Math.min((gameLevel / 16) * 100, 100)
  const isMaxed = gameLevel >= 16
  const hasHero = card.evolutionLevel && card.evolutionLevel > 0 && card.iconUrls.heroMedium
  const hasEvo = card.evolutionLevel && card.evolutionLevel > 0 && card.iconUrls.evolutionMedium && !card.iconUrls.heroMedium
  const displayIcon = card.iconUrls.heroMedium || card.iconUrls.evolutionMedium || card.iconUrls.medium
  const rarityClass = RARITY_COLORS[card.rarity] ?? 'text-zinc-300 border-zinc-600'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative glass-card w-full max-w-sm overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 text-zinc-500 hover:text-white transition-colors text-lg leading-none"
          aria-label="Close"
        >
          ✕
        </button>

        {/* Card image */}
        <div className={`flex justify-center items-center py-8 bg-rarity-${card.rarity}/20 border-b border-white/5`}>
          <div className={`relative w-28 h-28 rounded-2xl overflow-hidden border-2 ${rarityClass} bg-rarity-${card.rarity}`}>
            <Image
              src={displayIcon}
              alt={card.name}
              width={112}
              height={112}
              className="w-full h-full object-contain"
              unoptimized
            />
            {hasEvo && (
              <div className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center bg-fuchsia-600 border border-fuchsia-300 rounded-sm rotate-45 z-10">
                <span className="-rotate-45 text-[9px] font-black text-white">❖</span>
              </div>
            )}
            {hasHero && (
              <div className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center bg-yellow-500 border border-yellow-200 rounded-sm z-10">
                <span className="text-[11px] font-black text-white">★</span>
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-white">{card.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs font-semibold capitalize ${rarityClass.split(' ')[0]}`}>
                  {card.rarity}
                </span>
                {hasHero && <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 font-bold">Hero</span>}
                {hasEvo && <span className="text-xs px-2 py-0.5 rounded-full bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30 font-bold">Evo</span>}
              </div>
            </div>
            {card.elixirCost != null && (
              <div className="flex items-center gap-1.5 bg-purple-600/20 border border-purple-500/30 rounded-xl px-3 py-2">
                <span className="text-purple-300 text-lg font-black">{card.elixirCost}</span>
                <span className="text-purple-400 text-xs">elixir</span>
              </div>
            )}
          </div>

          {/* Level progress */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs text-zinc-500">Level</span>
              <span className={`text-xs font-bold ${isMaxed ? 'text-green-400' : 'text-zinc-300'}`}>
                {formatLevel(card.level, card.rarity)} / 16{isMaxed ? ' ✓ Maxed' : ''}
              </span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  background: isMaxed ? '#22c55e' : pct >= 80 ? '#fbbf24' : '#a855f7',
                }}
              />
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/5 rounded-xl p-3 text-center">
              <p className="text-xs text-zinc-500 mb-0.5">Max Level</p>
              <p className="text-sm font-bold text-zinc-300">16</p>
            </div>
            {card.count != null && (
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <p className="text-xs text-zinc-500 mb-0.5">Cards Owned</p>
                <p className="text-sm font-bold text-zinc-300">{card.count.toLocaleString()}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
