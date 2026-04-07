'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { formatLevel, toGameLevel } from './utils/levels'
import CardDetailModal from './components/CardDetailModal'

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

interface Player {
  name: string
  trophies: number
  expLevel: number
  wins: number
  losses: number
  cards: Card[]
}

export default function Home() {
  const [player, setPlayer] = useState<Player | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'default' | 'level-asc' | 'level-desc' | 'elixir-asc' | 'elixir-desc'>('default')
  const [elixirMax, setElixirMax] = useState<number>(10)
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL
    fetch(`${apiUrl}/player`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => {
        setPlayer(data)
        setLoading(false)
      })
      .catch(e => {
        setError(e.message)
        setLoading(false)
      })
  }, [])

  if (loading) return (
    <main className="min-h-screen bg-mesh flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-zinc-400 text-sm">Loading player data...</p>
      </div>
    </main>
  )

  if (error) return (
    <main className="min-h-screen bg-mesh flex items-center justify-center">
      <div className="glass-card p-8 text-center max-w-md">
        <p className="text-red-400 text-lg font-semibold mb-2">Connection Error</p>
        <p className="text-zinc-500 text-sm">{error}</p>
      </div>
    </main>
  )

  if (!player) return null

  const winRate = ((player.wins / (player.wins + player.losses)) * 100).toFixed(1)
  const rarities = ['all', 'evo', 'hero', 'champion', 'legendary', 'epic', 'rare', 'common']
  const baseFiltered = filter === 'all'
    ? player.cards
    : filter === 'evo'
      ? player.cards.filter(c => c.evolutionLevel && c.evolutionLevel > 0 && c.iconUrls?.evolutionMedium && !c.iconUrls?.heroMedium)
      : filter === 'hero'
        ? player.cards.filter(c => c.evolutionLevel && c.evolutionLevel > 0 && c.iconUrls?.heroMedium)
        : player.cards.filter(c => c.rarity === filter)

  const elixirFiltered = elixirMax < 10
    ? baseFiltered.filter(c => (c.elixirCost ?? 0) <= elixirMax)
    : baseFiltered

  const filteredCards = [...elixirFiltered].sort((a, b) => {
    const aLvl = toGameLevel(a.level, a.rarity)
    const bLvl = toGameLevel(b.level, b.rarity)
    if (sortBy === 'level-asc') return aLvl - bLvl
    if (sortBy === 'level-desc') return bLvl - aLvl
    if (sortBy === 'elixir-asc') return (a.elixirCost ?? 0) - (b.elixirCost ?? 0)
    if (sortBy === 'elixir-desc') return (b.elixirCost ?? 0) - (a.elixirCost ?? 0)
    return 0
  })

  return (
    <main className="min-h-screen bg-mesh">
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            <span className="bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400 bg-clip-text text-transparent">
              ⚔️ Clash Coach
            </span>
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Personal AI deck builder & strategy coach</p>
        </div>

        {/* Player Card */}
        <div className="glass-card p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-white">{player.name}</h2>
              <p className="text-zinc-500 text-sm mt-0.5">King Level {player.expLevel}</p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <div className="stat-pill">
                <p className="text-lg font-bold text-yellow-400">{player.trophies.toLocaleString()}</p>
                <p className="text-zinc-500 text-xs mt-0.5">Trophies</p>
              </div>
              <div className="stat-pill">
                <p className="text-lg font-bold text-green-400">{winRate}%</p>
                <p className="text-zinc-500 text-xs mt-0.5">Win Rate</p>
              </div>
              <div className="stat-pill">
                <p className="text-lg font-bold text-blue-400">{player.wins.toLocaleString()}</p>
                <p className="text-zinc-500 text-xs mt-0.5">Wins</p>
              </div>
              <div className="stat-pill">
                <p className="text-lg font-bold text-zinc-400">{player.losses.toLocaleString()}</p>
                <p className="text-zinc-500 text-xs mt-0.5">Losses</p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex gap-3 mb-10 flex-wrap items-center">
          <Link href="/upgrades" className="nav-btn nav-btn-purple">
            📈 Upgrade Priorities
          </Link>
          <Link href="/decks" className="nav-btn nav-btn-blue">
            🃏 Best Decks
          </Link>
          <Link href="/settings" className="ml-auto text-zinc-500 hover:text-zinc-300 transition-colors text-sm flex items-center gap-1.5">
            ⚙️ Settings
          </Link>
        </div>

        {/* Card Collection */}
        <div className="section-title">
          Your Collection — {player.cards?.length ?? 0} cards
        </div>

        {/* Rarity Filter */}
        <div className="flex gap-2 mb-3 flex-wrap">
          {rarities.map(r => (
            <button
              key={r}
              onClick={() => setFilter(r)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all cursor-pointer
                ${filter === r
                  ? 'bg-white/10 text-white border border-white/20'
                  : 'text-zinc-500 hover:text-zinc-300 border border-transparent hover:border-white/10'}`}
            >
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>

        {/* Sort & Elixir Filter */}
        <div className="flex gap-3 mb-5 flex-wrap items-center">
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-zinc-300 cursor-pointer"
          >
            <option value="default">Sort: Default</option>
            <option value="level-desc">Level: High → Low</option>
            <option value="level-asc">Level: Low → High</option>
            <option value="elixir-asc">Elixir: Low → High</option>
            <option value="elixir-desc">Elixir: High → Low</option>
          </select>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Max elixir:</span>
            <div className="flex gap-1">
              {[3, 4, 5, 6, 7, 8, 10].map(n => (
                <button
                  key={n}
                  onClick={() => setElixirMax(n === elixirMax ? 10 : n)}
                  className={`text-xs w-7 h-7 rounded-lg border transition-all cursor-pointer font-bold
                    ${elixirMax === n
                      ? 'bg-purple-500/30 border-purple-500 text-purple-300'
                      : 'border-white/10 text-zinc-500 hover:border-white/20 hover:text-zinc-300'}`}
                >
                  {n === 10 ? 'All' : n}
                </button>
              ))}
            </div>
          </div>

          <span className="text-xs text-zinc-600 ml-auto">{filteredCards.length} cards</span>
        </div>

        <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
          {(filteredCards ?? []).map(card => {
            const gameLevel = toGameLevel(card.level, card.rarity)
            const pct = (gameLevel / 16) * 100
            return (
              <div
                key={card.name}
                className={`group relative rounded-xl overflow-hidden border-2 bg-[#111318] transition-all hover:scale-105 hover:z-10 border-rarity-${card.rarity} cursor-pointer`}
                title={`${card.name} — ${formatLevel(card.level, card.rarity)}`}
                onClick={() => setSelectedCard(card)}
              >
                <Image
                  src={card.iconUrls.medium}
                  alt={card.name}
                  width={80}
                  height={80}
                  className="w-full"
                  unoptimized
                />
                {/* Rarity & Level Bar */}
                <div className="absolute bottom-0 left-0 right-0 bg-black/80 px-1 py-0.5 text-center flex flex-col justify-end">
                  <span className="text-[10px] font-bold text-white z-10 leading-tight">
                    {formatLevel(card.level, card.rarity)}
                  </span>
                  <div className="level-bar-bg mt-0.5">
                    <div
                      className="level-bar-fill"
                      style={{
                        width: `${pct}%`,
                        background: pct >= 100 ? '#22c55e' : pct >= 80 ? '#fbbf24' : '#a855f7'
                      }}
                    />
                  </div>
                </div>

                {/* Evo Shard Indicator */}
                {(card as any).evolutionLevel > 0 && (card as any).iconUrls?.evolutionMedium && !(card as any).iconUrls?.heroMedium && (
                  <div className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center bg-fuchsia-600 border border-fuchsia-300 rounded-sm shadow-[0_0_8px_rgba(192,38,211,0.8)] rotate-45 z-20">
                    <span className="-rotate-45 text-[10px] font-black text-white ml-[1px]">❖</span>
                  </div>
                )}
                {/* Hero Indicator */}
                {(card as any).evolutionLevel > 0 && (card as any).iconUrls?.heroMedium && (
                  <div className="absolute top-1 left-1 w-5 h-5 flex items-center justify-center bg-yellow-500 border border-yellow-200 rounded-sm shadow-[0_0_8px_rgba(234,179,8,0.8)] z-20">
                    <span className="text-[12px] font-black text-white ml-[1px] -mt-[1px]">★</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

      </div>

      {selectedCard && (
        <CardDetailModal card={selectedCard} onClose={() => setSelectedCard(null)} />
      )}
    </main>
  )
}
