'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { formatLevel } from '../utils/levels'
import ReactMarkdown from 'react-markdown'

interface Priority {
  name: string
  level: number
  maxLevel: number
  levelsToMax: number
  rarity: string
  appearances: number
  winRate: number
  upgradeScore: number
  iconUrl: string | null
}

interface UpgradeData {
  priorities: Priority[]
  advice: string
}

const rarityColor: Record<string, string> = {
  common: 'text-gray-300',
  rare: 'text-orange-400',
  epic: 'text-purple-400',
  legendary: 'text-yellow-400',
  champion: 'text-red-400',
}

const rarityBorder: Record<string, string> = {
  common: 'border-gray-500',
  rare: 'border-orange-400',
  epic: 'border-purple-500',
  legendary: 'border-yellow-400',
  champion: 'border-red-500',
}

export default function UpgradesPage() {
  const [data, setData] = useState<UpgradeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL
    fetch(`${apiUrl}/upgrades`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(d => {
        setData(d)
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
      <div className="text-center">
        <p className="text-gray-400 text-lg animate-pulse">Analyzing your cards...</p>
        <p className="text-gray-600 text-sm mt-2">This may take a moment (AI is thinking)</p>
      </div>
    </main>
  )

  if (error) return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-400 text-lg">Error: {error}</p>
        <a href="/" className="text-blue-400 hover:underline mt-4 inline-block">← Back home</a>
      </div>
    </main>
  )

  if (!data) return null

  const usedCards = data.priorities.filter(p => p.appearances > 0)
  const unusedCards = data.priorities.filter(p => p.appearances === 0)

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <a href="/" className="text-gray-400 hover:text-white transition">← Back</a>
        <h1 className="text-3xl font-bold text-purple-400">📈 Upgrade Priorities</h1>
      </div>

      {/* AI Advice */}
      <div className="bg-gray-800 rounded-2xl p-6 mb-8">
        <h2 className="text-xl font-semibold text-yellow-400 mb-4">🤖 AI Recommendations</h2>
        <div className="prose prose-invert max-w-none text-gray-300 leading-relaxed">
          <ReactMarkdown>{data.advice}</ReactMarkdown>
        </div>
      </div>

      {/* Cards you use */}
      <h3 className="text-xl font-semibold mb-4 text-gray-200">
        Cards You Use ({usedCards.length})
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        {usedCards.map(card => (
          <div
            key={card.name}
            className={`bg-gray-800 rounded-xl p-4 flex items-center gap-4 border-l-4 ${rarityBorder[card.rarity] ?? 'border-gray-600'}`}
          >
            {card.iconUrl && (
              <Image
                src={card.iconUrl}
                alt={card.name}
                width={48}
                height={48}
                className="rounded"
                unoptimized
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{card.name}</p>
              <p className={`text-xs ${rarityColor[card.rarity] ?? 'text-gray-400'}`}>
                {card.rarity}
              </p>
            </div>
            <div className="text-right text-sm">
              <p className="text-white font-bold">Lvl {formatLevel(card.level, card.rarity)}</p>
              <p className="text-gray-400">{card.appearances}x used</p>
              <p className="text-green-400">{card.winRate}% WR</p>
              <p className="text-yellow-400 text-xs font-mono">Score: {card.upgradeScore}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Unused cards */}
      {unusedCards.length > 0 && (
        <>
          <h3 className="text-xl font-semibold mb-4 text-gray-500">
            Unused Cards ({unusedCards.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {unusedCards.map(card => (
              <div
                key={card.name}
                className="bg-gray-900 rounded-lg p-3 text-center opacity-50"
              >
                {card.iconUrl && (
                  <Image
                    src={card.iconUrl}
                    alt={card.name}
                    width={40}
                    height={40}
                    className="mx-auto rounded mb-1"
                    unoptimized
                  />
                )}
                <p className="text-xs text-gray-400 truncate">{card.name}</p>
                <p className="text-xs text-gray-600">Lvl {formatLevel(card.level, card.rarity)}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  )
}
