'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { formatLevel } from './utils/levels'

interface Card {
  name: string
  level: number
  maxLevel: number
  rarity: string
  iconUrls: { medium: string }
}

interface Player {
  name: string
  trophies: number
  expLevel: number
  wins: number
  losses: number
  cards: Card[]
}

const rarityBorder: Record<string, string> = {
  common: 'border-gray-400',
  rare: 'border-orange-400',
  epic: 'border-purple-500',
  legendary: 'border-yellow-400',
  champion: 'border-red-500',
}

export default function Home() {
  const [player, setPlayer] = useState<Player | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL
    console.log('Fetching from:', apiUrl)
    fetch(`${apiUrl}/player`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => {
        console.log('Player data:', data)
        setPlayer(data)
        setLoading(false)
      })
      .catch(e => {
        console.error('Fetch error:', e)
        setError(e.message)
        setLoading(false)
      })
  }, [])

  if (loading) return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <p className="text-gray-400 text-lg animate-pulse">Loading player data...</p>
    </main>
  )

  if (error) return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <p className="text-red-400 text-lg">Error: {error}</p>
    </main>
  )

  if (!player) return null

  const winRate = ((player.wins / (player.wins + player.losses)) * 100).toFixed(1)

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-yellow-400">⚔️ Clash Coach</h1>
        <p className="text-gray-400 mt-1">Personal AI deck builder & coach</p>
      </div>

      {/* Player Card */}
      <div className="bg-gray-800 rounded-2xl p-6 mb-8 flex gap-8 items-center">
        <div>
          <h2 className="text-2xl font-bold">{player.name}</h2>
          <p className="text-gray-400">King Level {player.expLevel}</p>
        </div>
        <div className="flex gap-6 text-center">
          <div>
            <p className="text-yellow-400 text-2xl font-bold">{player.trophies}</p>
            <p className="text-gray-400 text-sm">Trophies</p>
          </div>
          <div>
            <p className="text-green-400 text-2xl font-bold">{winRate}%</p>
            <p className="text-gray-400 text-sm">Win Rate</p>
          </div>
          <div>
            <p className="text-blue-400 text-2xl font-bold">{player.wins}</p>
            <p className="text-gray-400 text-sm">Wins</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-4 mb-8">
        <a href="/upgrades" className="bg-purple-600 hover:bg-purple-500 px-6 py-3 rounded-xl font-semibold transition">
          📈 Upgrade Priorities
        </a>
        <a href="/decks" className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-xl font-semibold transition">
          🃏 Best Decks
        </a>
      </div>

      {/* Card Collection */}
      <h3 className="text-xl font-semibold mb-4 text-gray-200">
        Your Collection ({player.cards?.length ?? 0} cards)
      </h3>
      <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
        {(player.cards ?? []).map(card => (
          <div key={card.name} className={`relative border-2 rounded-lg overflow-hidden bg-gray-800 ${rarityBorder[card.rarity] ?? 'border-gray-600'}`}>
            <Image
              src={card.iconUrls.medium}
              alt={card.name}
              width={80}
              height={80}
              className="w-full"
              unoptimized
            />
            <div className="absolute bottom-0 right-0 bg-black/70 text-xs px-1 font-bold text-white">
              {formatLevel(card.level, card.rarity)}
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
