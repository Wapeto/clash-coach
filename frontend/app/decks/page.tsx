'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { formatLevel } from '../utils/levels'
import ReactMarkdown from 'react-markdown'

interface Card {
  name: string
  level: number
  maxLevel: number
  rarity: string
  elixirCost: number
  iconUrls: { medium: string }
}

interface Deck {
  cards: Card[]
  trophyChange: number
  gameMode: string
}

interface DecksData {
  decks: Deck[]
  advice: string
}

const rarityBorder: Record<string, string> = {
  common: 'border-gray-400',
  rare: 'border-orange-400',
  epic: 'border-purple-500',
  legendary: 'border-yellow-400',
  champion: 'border-red-500',
}

export default function DecksPage() {
  const [data, setData] = useState<DecksData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [coachIndex, setCoachIndex] = useState<number | null>(null)
  const [coachAdvice, setCoachAdvice] = useState<string | null>(null)
  const [coachLoading, setCoachLoading] = useState(false)

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL
    fetch(`${apiUrl}/decks`)
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

  const handleCoach = (index: number) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL
    setCoachIndex(index)
    setCoachAdvice(null)
    setCoachLoading(true)

    fetch(`${apiUrl}/coach/${index}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(d => {
        setCoachAdvice(d.advice)
        setCoachLoading(false)
      })
      .catch(e => {
        console.error('Coach fetch error:', e)
        setCoachAdvice(`Error: ${e.message}`)
        setCoachLoading(false)
      })
  }

  if (loading) return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-400 text-lg animate-pulse">Analyzing your decks...</p>
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

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <a href="/" className="text-gray-400 hover:text-white transition">← Back</a>
        <h1 className="text-3xl font-bold text-blue-400">🃏 Best Decks</h1>
      </div>

      {/* AI Advice */}
      <div className="bg-gray-800 rounded-2xl p-6 mb-8">
        <h2 className="text-xl font-semibold text-yellow-400 mb-4">🤖 AI Deck Suggestions</h2>
        <div className="prose prose-invert max-w-none text-gray-300 leading-relaxed">
          <ReactMarkdown>{data.advice}</ReactMarkdown>
        </div>
      </div>

      {/* Recent Decks */}
      <h3 className="text-xl font-semibold mb-4 text-gray-200">
        Your Recent Decks ({data.decks.length})
      </h3>
      <div className="space-y-4">
        {data.decks.map((deck, i) => (
          <div key={i} className="bg-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-gray-400 text-sm">{deck.gameMode}</span>
                <span className={deck.trophyChange > 0 ? 'text-green-400' : deck.trophyChange < 0 ? 'text-red-400' : 'text-gray-400'}>
                  {deck.trophyChange > 0 ? '+' : ''}{deck.trophyChange} 🏆
                </span>
              </div>
              <button
                onClick={() => handleCoach(i)}
                className="bg-purple-600 hover:bg-purple-500 px-4 py-1.5 rounded-lg text-sm font-semibold transition"
              >
                🎓 Get Coaching
              </button>
            </div>
            <div className="grid grid-cols-8 gap-2">
              {deck.cards.map(card => (
                <div key={card.name} className={`relative border-2 rounded-lg overflow-hidden bg-gray-900 ${rarityBorder[card.rarity] ?? 'border-gray-600'}`}>
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

            {/* Coach panel for this deck */}
            {coachIndex === i && (
              <div className="mt-4 bg-gray-900 rounded-xl p-4 border border-purple-500/30">
                {coachLoading ? (
                  <p className="text-gray-400 animate-pulse">🎓 Coach is analyzing this deck...</p>
                ) : (
                  <div className="prose prose-invert max-w-none text-gray-300 text-sm leading-relaxed">
                    <ReactMarkdown>{coachAdvice ?? ''}</ReactMarkdown>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  )
}
