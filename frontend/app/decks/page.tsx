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
  iconUrls: { 
    medium: string 
    evolutionMedium?: string
    heroMedium?: string
  }
}

interface Deck {
  cards: Card[]
  trophyChange: number
  gameMode: string
}

interface SuggestedDeck {
  deck_name: string
  archetype: string
  cards: string[]
  why_it_fits: string
  win_condition: string
}

interface DecksData {
  decks: Deck[]
  collection: Card[]
  advice: {
    ladder_decks: SuggestedDeck[]
    clan_war_deck: SuggestedDeck
  }
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

  const renderCardList = (cardNames: string[]) => {
    return (
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 my-4">
        {cardNames.map(name => {
          const card = data?.collection.find(c => c.name === name)
          if (!card) return (
            <div key={name} className="glass-card flex items-center justify-center p-2 text-center h-[80px]">
              <span className="text-[10px] text-zinc-500">{name}</span>
            </div>
          )

          return (
            <div
              key={card.name}
              className={`group relative rounded-xl overflow-hidden border border-rarity-${card.rarity} bg-rarity-${card.rarity} transition-transform hover:scale-105`}
              title={`${card.name} — Lvl ${formatLevel(card.level, card.rarity)}`}
            >
              <Image
                src={card.iconUrls.heroMedium || card.iconUrls.medium}
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
              <div className="absolute top-0 left-0 bg-purple-600/90 text-[9px] font-bold text-white px-1.5 py-0.5 rounded-br-lg z-10">
                {card.elixirCost}
              </div>
              {/* Evo Shard Indicator */}
              {(card as any).evolutionLevel > 0 && card.iconUrls?.evolutionMedium && (
                <div className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center bg-fuchsia-600 border border-fuchsia-300 rounded-sm rotate-45 z-20">
                  <span className="-rotate-45 text-[8px] font-black text-white ml-[1px]">❖</span>
                </div>
              )}
              {/* Hero Indicator */}
              {(card as any).evolutionLevel > 0 && card.iconUrls?.heroMedium && (
                <div className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center bg-yellow-500 border border-yellow-200 rounded-sm z-20">
                  <span className="text-[10px] font-black text-white ml-[1px] -mt-[1px]">★</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  const renderSuggestedDeck = (deck: SuggestedDeck, titlePrefix: string) => {
    return (
      <div className="glass-card overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-white/5 bg-white/5">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-xl font-bold text-white">{titlePrefix}: {deck.deck_name}</span>
            <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 text-xs font-semibold border border-blue-500/30">
              {deck.archetype}
            </span>
          </div>
        </div>
        <div className="px-5 py-2">
          {renderCardList(deck.cards)}
          <div className="grid md:grid-cols-2 gap-6 mt-4 mb-3">
            <div>
              <h4 className="text-[11px] font-bold text-purple-400 uppercase tracking-wider mb-2">Why It Fits Your Levels</h4>
              <p className="text-sm text-zinc-300 leading-relaxed">{deck.why_it_fits}</p>
            </div>
            <div>
              <h4 className="text-[11px] font-bold text-fuchsia-400 uppercase tracking-wider mb-2">Win Condition</h4>
              <p className="text-sm text-zinc-300 leading-relaxed">{deck.win_condition}</p>
            </div>
          </div>
        </div>
      </div>
    )
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

        {/* AI Suggested Decks Section */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <span className="text-xl">🤖</span>
            <h2 className="text-lg font-bold text-white tracking-wide">AI Deck Suggestions</h2>
            <span className="text-[10px] px-2.5 py-1 rounded-full bg-[#166534] text-[#4ade80] border border-[#22c55e] font-bold tracking-wide shadow-sm ml-2">
              Live Meta
            </span>
          </div>

          {data.advice.ladder_decks.map((deck, i) => (
            <div key={i}>
              {renderSuggestedDeck(deck, `Ladder Deck ${i + 1}`)}
            </div>
          ))}

          {renderSuggestedDeck(data.advice.clan_war_deck, "Clan War Deck")}
        </div>

        {/* Recent Decks (Your actual run history) */}
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
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-black/20">
                  <div className="flex items-center gap-3">
                    <span className="gamemode-badge">{deck.gameMode}</span>
                    <span className={`trophy-change ${deck.trophyChange > 0 ? 'trophy-win' : deck.trophyChange < 0 ? 'trophy-loss' : 'trophy-draw'}`}>
                      {deck.trophyChange > 0 ? '+' : ''}{deck.trophyChange} 🏆
                    </span>
                    <span className="text-zinc-500 text-xs font-semibold">
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
                   <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {deck.cards.map(card => (
                      <div
                        key={card.name}
                        className={`group relative rounded-xl overflow-hidden border border-rarity-${card.rarity} bg-rarity-${card.rarity} transition-transform hover:scale-105`}
                        title={`${card.name} — Lvl ${formatLevel(card.level, card.rarity)}`}
                      >
                        <Image
                          src={card.iconUrls.heroMedium || card.iconUrls.medium}
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
                        {(card as any).evolutionLevel > 0 && (card as any).iconUrls?.evolutionMedium && (
                          <div className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center bg-fuchsia-600 border border-fuchsia-300 rounded-sm shadow-[0_0_8px_rgba(192,38,211,0.8)] rotate-45 z-20">
                            <span className="-rotate-45 text-[8px] font-black text-white ml-[1px]">❖</span>
                          </div>
                        )}
                        {/* Hero Indicator */}
                        {(card as any).evolutionLevel > 0 && (card as any).iconUrls?.heroMedium && (
                          <div className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center bg-yellow-500 border border-yellow-200 rounded-sm z-20">
                            <span className="text-[10px] font-black text-white ml-[1px] -mt-[1px]">★</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Coach Panel */}
                {isCoaching && (
                  <div className="border-t border-purple-500/20 bg-purple-500/5 px-6 py-6">
                    {coachLoading ? (
                      <div className="flex items-center gap-3 justify-center py-6">
                        <div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
                        <p className="text-zinc-400 text-sm">Coach is writing a detailed report for this deck...</p>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <span className="text-lg">🎓</span>
                          <h3 className="text-sm font-bold text-[#e9d5ff] uppercase tracking-wider">Detailed Coaching Report</h3>
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
