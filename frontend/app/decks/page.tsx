'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
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
        setError(e.message)
        setLoading(false)
      })
  }, [])

  const handleCoach = (index: number) => {
    if (coachIndex === index && coachAdvice) {
      setCoachIndex(null)
      return
    }

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
        setCoachAdvice(`Error: ${e.message}`)
        setCoachLoading(false)
      })
  }

  if (loading) return (
    <main className="min-h-screen bg-mesh flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-zinc-400 text-sm">Analyzing your decks...</p>
        <p className="text-zinc-600 text-xs mt-1">AI is finding the best strategies</p>
      </div>
    </main>
  )

  if (error) return (
    <main className="min-h-screen bg-mesh flex items-center justify-center">
      <div className="glass-card p-8 text-center max-w-md">
        <p className="text-red-400 text-lg font-semibold mb-2">Error</p>
        <p className="text-zinc-500 text-sm mb-4">{error}</p>
        <Link href="/" className="back-link">← Back home</Link>
      </div>
    </main>
  )

  if (!data) return null

  return (
    <main className="min-h-screen bg-mesh">
      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="back-link mb-3 inline-flex">← Back to Dashboard</Link>
          <h1 className="text-3xl font-bold">
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              🃏 Best Decks
            </span>
          </h1>
          <p className="text-zinc-500 text-sm mt-1">AI deck suggestions & per-deck coaching</p>
        </div>

        {/* AI Advice */}
        <div className="glass-card p-6 mb-10">
          <div className="flex items-center gap-2 mb-5">
            <span className="text-lg">🤖</span>
            <h2 className="text-base font-semibold text-blue-300 tracking-wide uppercase text-[13px]">AI Deck Suggestions</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 font-medium">
              Live Meta
            </span>
          </div>
          <div className="ai-prose">
            <ReactMarkdown>{data.advice}</ReactMarkdown>
          </div>
        </div>

        {/* Recent Decks */}
        <div className="section-title">
          Your Recent Decks — {data.decks.length} found
        </div>

        <div className="space-y-4">
          {data.decks.map((deck, i) => {
            const avgElixir = (deck.cards.reduce((sum, c) => sum + c.elixirCost, 0) / deck.cards.length).toFixed(1)
            const isCoaching = coachIndex === i

            return (
              <div key={i} className={`glass-card overflow-hidden transition-all ${isCoaching ? 'ring-1 ring-purple-500/30' : ''}`}>

                {/* Deck Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <span className="gamemode-badge">{deck.gameMode}</span>
                    <span className={`trophy-change ${deck.trophyChange > 0 ? 'trophy-win' : deck.trophyChange < 0 ? 'trophy-loss' : 'trophy-draw'}`}>
                      {deck.trophyChange > 0 ? '+' : ''}{deck.trophyChange} 🏆
                    </span>
                    <span className="text-zinc-600 text-xs">
                      ⚡ {avgElixir} avg
                    </span>
                  </div>
                  <button
                    onClick={() => handleCoach(i)}
                    className="coach-btn"
                  >
                    🎓 {isCoaching && coachAdvice ? 'Hide Coach' : 'Get Coaching'}
                  </button>
                </div>

                {/* Deck Cards */}
                <div className="px-5 py-4">
                  <div className="grid grid-cols-8 gap-2">
                    {deck.cards.map(card => (
                      <div
                        key={card.name}
                        className={`group relative rounded-xl overflow-hidden border border-rarity-${card.rarity} bg-rarity-${card.rarity} transition-transform hover:scale-105`}
                        title={`${card.name} — ${formatLevel(card.level, card.rarity)} — ${card.elixirCost} elixir`}
                      >
                        <Image
                          src={card.iconUrls.medium}
                          alt={card.name}
                          width={80}
                          height={80}
                          className="w-full"
                          unoptimized
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-center py-0.5">
                          <span className="text-[10px] font-bold text-white">
                            {formatLevel(card.level, card.rarity)}
                          </span>
                        </div>
                        {/* Elixir cost badge */}
                        <div className="absolute top-0 left-0 bg-purple-600/90 text-[9px] font-bold text-white px-1.5 py-0.5 rounded-br-lg z-10">
                          {card.elixirCost}
                        </div>
                        
                        {/* Evo Shard Indicator */}
                        {(card as any).evolutionLevel > 0 && (
                          <div className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center bg-fuchsia-600 border border-fuchsia-300 rounded-sm shadow-[0_0_8px_rgba(192,38,211,0.8)] rotate-45 z-20">
                            <span className="-rotate-45 text-[8px] font-black text-white ml-[1px]">❖</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Coach Panel */}
                {isCoaching && (
                  <div className="border-t border-purple-500/20 bg-purple-500/5 px-5 py-5">
                    {coachLoading ? (
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
                        <p className="text-zinc-400 text-sm">Coach is analyzing this deck...</p>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <span className="text-base">🎓</span>
                          <h3 className="text-[13px] font-semibold text-purple-300 uppercase tracking-wide">Coaching Breakdown</h3>
                        </div>
                        <div className="ai-prose">
                          <ReactMarkdown>{coachAdvice ?? ''}</ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>
            )
          })}
        </div>

      </div>
    </main>
  )
}
