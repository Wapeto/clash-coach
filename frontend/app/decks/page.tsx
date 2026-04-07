'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { formatLevel } from '../utils/levels'
import ReactMarkdown from 'react-markdown'
import { getApiMode } from '../utils/settings'
import { useChainPolling, STEP_LABELS } from '../utils/useChainPolling'

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
  deck_score?: DeckScore
}

interface DeckScore {
  score: number
  avg_level: number
  min_level: number
  level_pct: number
  avg_elixir: number
  evo_hero_count: number
  weak_link: string | null
}

interface SuggestedDeck {
  deck_name: string
  archetype: string
  cards: string[]
  why_it_fits: string
  win_condition: string
  deck_score?: DeckScore
}

interface DecksData {
  decks: Deck[]
  collection: Card[]
  advice: {
    ladder_decks: SuggestedDeck[]
    clan_war_deck: SuggestedDeck
  } | null
}

export default function DecksPage() {
  const [data, setData] = useState<DecksData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [coachIndex, setCoachIndex] = useState<number | null>(null)
  const [coachAdvice, setCoachAdvice] = useState<string | null>(null)
  const [coachLoading, setCoachLoading] = useState(false)
  const [coachJobId, setCoachJobId] = useState<string | null>(null)
  const [decksJobId, setDecksJobId] = useState<string | null>(null)

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ''
  const fetchedRef = useRef(false)
  const decksJob = useChainPolling(decksJobId, apiUrl)
  const coachJob = useChainPolling(coachJobId, apiUrl)

  useEffect(() => {
    if (decksJob?.status === 'complete' && decksJob.result) {
      setData(decksJob.result as DecksData)
      setLoading(false)
      setDecksJobId(null)
    } else if (decksJob?.status === 'error') {
      setError(decksJob.error ?? 'Deep analysis failed')
      setLoading(false)
      setDecksJobId(null)
    }
  }, [decksJob])

  useEffect(() => {
    if (coachJob?.status === 'complete' && coachJob.result) {
      const r = coachJob.result as { advice: string }
      setCoachAdvice(r.advice)
      setCoachLoading(false)
      setCoachJobId(null)
    } else if (coachJob?.status === 'error') {
      setCoachAdvice(`Error: ${coachJob.error ?? 'Deep analysis failed'}`)
      setCoachLoading(false)
      setCoachJobId(null)
    }
  }, [coachJob])

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    const mode = getApiMode()
    fetch(`${apiUrl}/decks?mode=${mode}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(d => {
        if (d.job_id) {
          setDecksJobId(d.job_id)
        } else {
          setData(d)
          setLoading(false)
        }
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

    const mode = getApiMode()
    setCoachIndex(index)
    setCoachAdvice(null)
    setCoachLoading(true)
    setCoachJobId(null)

    fetch(`${apiUrl}/coach/${index}?mode=${mode}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(d => {
        if (d.job_id) {
          setCoachJobId(d.job_id)
        } else {
          setCoachAdvice(d.advice)
          setCoachLoading(false)
        }
      })
      .catch(e => {
        setCoachAdvice(`Error: ${e.message}`)
        setCoachLoading(false)
      })
  }

  const renderDeckScore = (ds: DeckScore) => {
    const { score, avg_level, weak_link, evo_hero_count } = ds
    const color =
      score >= 80 ? { bg: 'bg-green-500/20', border: 'border-green-500/40', text: 'text-green-400' }
      : score >= 60 ? { bg: 'bg-blue-500/20', border: 'border-blue-500/40', text: 'text-blue-400' }
      : score >= 40 ? { bg: 'bg-yellow-500/20', border: 'border-yellow-500/40', text: 'text-yellow-400' }
      : { bg: 'bg-red-500/20', border: 'border-red-500/40', text: 'text-red-400' }
    const label = score >= 80 ? 'Strong' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Weak'
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${color.bg} ${color.border}`}>
        <div className="text-center">
          <p className={`text-sm font-black leading-none ${color.text}`}>{Math.round(score)}</p>
          <p className="text-[9px] text-zinc-500 mt-0.5">{label}</p>
        </div>
        <div className="border-l border-white/10 pl-2 text-[10px] text-zinc-400 leading-snug">
          <p>Avg Lvl <span className="font-bold text-zinc-300">{avg_level}</span></p>
          {evo_hero_count > 0 && <p className="text-fuchsia-400 font-semibold">{evo_hero_count} Evo/Hero</p>}
          {weak_link && <p className="text-yellow-500">⚠ {weak_link}</p>}
        </div>
      </div>
    )
  }

  const renderCardList = (cardNames: string[]) => {
    return (
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 my-4">
        {cardNames.map(name => {
          const card = data?.collection.find(c => c.name.toLowerCase() === name.toLowerCase())
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
              {(card as any).evolutionLevel > 0 && card.iconUrls?.evolutionMedium && !card.iconUrls?.heroMedium && (
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
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <span className="text-xl font-bold text-white">{titlePrefix}: {deck.deck_name}</span>
            <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 text-xs font-semibold border border-blue-500/30">
              {deck.archetype}
            </span>
            {deck.deck_score && renderDeckScore(deck.deck_score)}
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
    <main className="min-h-screen bg-mesh flex items-center justify-center px-4">
      <div className="text-center max-w-md w-full">
        {/* Animated icon */}
        <div className="relative mx-auto mb-8 w-24 h-24">
          <div className="absolute inset-0 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
          <div className="absolute inset-3 rounded-full border-4 border-cyan-500/20 border-b-cyan-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
          <div className="absolute inset-0 flex items-center justify-center text-3xl">🃏</div>
        </div>

        {/* Main message */}
        <h2 className="text-xl font-bold text-white mb-2">
          {decksJob ? (STEP_LABELS[decksJob.current_step] ?? 'Processing...') : 'Analyzing your decks...'}
        </h2>
        <p className="text-zinc-500 text-sm mb-6">
          {decksJob ? '🔬 Deep analysis in progress — ~20s' : 'AI is finding the best strategies'}
        </p>

        {/* Step progress */}
        {decksJob && (
          <div className="glass-card p-4 text-left space-y-2">
            {(['analyst', 'meta_search', 'strategist', 'fact_checker'] as const).map((step) => {
              const steps = ['analyst', 'meta_search', 'strategist', 'fact_checker']
              const currentIdx = steps.indexOf(decksJob.current_step)
              const isDone = steps.indexOf(step) < currentIdx
              const isCurrent = decksJob.current_step === step
              return (
                <div key={step} className={`flex items-center gap-3 text-sm transition-all ${isDone ? 'text-green-400' : isCurrent ? 'text-white' : 'text-zinc-600'}`}>
                  <span className="text-base">{isDone ? '✓' : isCurrent ? '⟳' : '○'}</span>
                  <span className={isCurrent ? 'font-semibold' : ''}>{STEP_LABELS[step] ?? step}</span>
                  {isCurrent && <span className="ml-auto w-3 h-3 rounded-full bg-blue-500 animate-pulse" />}
                </div>
              )
            })}
          </div>
        )}

        {!decksJob && (
          <div className="flex justify-center gap-1.5">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-blue-500/60 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        )}
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
            🃏 <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Best Decks</span>
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

          {data.advice ? (
            <>
              {data.advice.ladder_decks.map((deck, i) => (
                <div key={i}>
                  {renderSuggestedDeck(deck, `Ladder Deck ${i + 1}`)}
                </div>
              ))}
              {renderSuggestedDeck(data.advice.clan_war_deck, "Clan War Deck")}
            </>
          ) : (
            <div className="glass-card p-6 text-center text-zinc-500 text-sm">
              AI suggestions unavailable — Gemini quota exceeded. Check your API key at aistudio.google.com/apikey
            </div>
          )}
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
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-black/20 flex-wrap gap-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="gamemode-badge">{deck.gameMode}</span>
                    <span className={`trophy-change ${deck.trophyChange > 0 ? 'trophy-win' : deck.trophyChange < 0 ? 'trophy-loss' : 'trophy-draw'}`}>
                      {deck.trophyChange > 0 ? '+' : ''}{deck.trophyChange} 🏆
                    </span>
                    <span className="text-zinc-500 text-xs font-semibold">
                      ⚡ {avgElixir} avg
                    </span>
                    {deck.deck_score && renderDeckScore(deck.deck_score)}
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
                        {(card as any).evolutionLevel > 0 && (card as any).iconUrls?.evolutionMedium && !(card as any).iconUrls?.heroMedium && (
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
                        <p className="text-zinc-400 text-sm">
                          {coachJob ? (STEP_LABELS[coachJob.current_step] ?? 'Processing...') : 'Coach is writing a detailed report...'}
                        </p>
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
