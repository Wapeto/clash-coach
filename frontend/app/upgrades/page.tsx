'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { formatLevel, toGameLevel } from '../utils/levels'
import ReactMarkdown from 'react-markdown'
import { getApiMode } from '../utils/settings'
import { useChainPolling, STEP_LABELS } from '../utils/useChainPolling'

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
  iconUrls?: {
    medium?: string
    evolutionMedium?: string
    heroMedium?: string
  }
}

interface UpgradeData {
  priorities: Priority[]
  advice: string
}

export default function UpgradesPage() {
  const [data, setData] = useState<UpgradeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showUnused, setShowUnused] = useState(false)
  const [upgradesJobId, setUpgradesJobId] = useState<string | null>(null)

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ''
  const fetchedRef = useRef(false)
  const upgradesJob = useChainPolling(upgradesJobId, apiUrl)

  useEffect(() => {
    if (upgradesJob?.status === 'complete' && upgradesJob.result) {
      setData(upgradesJob.result as UpgradeData)
      setLoading(false)
      setUpgradesJobId(null)
    } else if (upgradesJob?.status === 'error') {
      setLoading(false)
      setUpgradesJobId(null)
    }
  }, [upgradesJob])

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    const mode = getApiMode()
    fetch(`${apiUrl}/upgrades?mode=${mode}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(d => {
        if (d.job_id) {
          setUpgradesJobId(d.job_id)
        } else {
          setData(d)
          setLoading(false)
        }
      })
      .catch(e => {
        setLoading(false)
        console.error(e)
      })
  }, [])

  if (loading) return (
    <main className="min-h-screen bg-mesh flex items-center justify-center px-4">
      <div className="text-center max-w-md w-full">
        {/* Animated icon */}
        <div className="relative mx-auto mb-8 w-24 h-24">
          <div className="absolute inset-0 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin" />
          <div className="absolute inset-3 rounded-full border-4 border-fuchsia-500/20 border-b-fuchsia-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
          <div className="absolute inset-0 flex items-center justify-center text-3xl">📈</div>
        </div>

        {/* Main message */}
        <h2 className="text-xl font-bold text-white mb-2">
          {upgradesJob ? (STEP_LABELS[upgradesJob.current_step] ?? 'Processing...') : 'Analyzing your cards...'}
        </h2>
        <p className="text-zinc-500 text-sm mb-6">
          {upgradesJob ? '🔬 Deep analysis in progress — ~20s' : 'AI is crunching your battle data'}
        </p>

        {/* Step progress */}
        {upgradesJob && (
          <div className="glass-card p-4 text-left space-y-2">
            {(['analyst', 'strategist', 'fact_checker'] as const).map((step, i) => {
              const steps = ['analyst', 'strategist', 'fact_checker']
              const currentIdx = steps.indexOf(upgradesJob.current_step)
              const isDone = steps.indexOf(step) < currentIdx
              const isCurrent = upgradesJob.current_step === step
              return (
                <div key={step} className={`flex items-center gap-3 text-sm transition-all ${isDone ? 'text-green-400' : isCurrent ? 'text-white' : 'text-zinc-600'}`}>
                  <span className="text-base">{isDone ? '✓' : isCurrent ? '⟳' : '○'}</span>
                  <span className={isCurrent ? 'font-semibold' : ''}>{STEP_LABELS[step] ?? step}</span>
                  {isCurrent && <span className="ml-auto w-3 h-3 rounded-full bg-purple-500 animate-pulse" />}
                </div>
              )
            })}
          </div>
        )}

        {!upgradesJob && (
          <div className="flex justify-center gap-1.5">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-purple-500/60 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
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

  const usedCards = data.priorities.filter(p => p.appearances > 0)
  const unusedCards = data.priorities.filter(p => p.appearances === 0)

  return (
    <main className="min-h-screen bg-mesh">
      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="back-link mb-3 inline-flex">← Back to Dashboard</Link>
          <h1 className="text-3xl font-bold">
            📈 <span className="bg-gradient-to-r from-purple-400 to-fuchsia-400 bg-clip-text text-transparent">Upgrade Priorities</span>
          </h1>
          <p className="text-zinc-500 text-sm mt-1">AI-powered analysis of which cards to level up first</p>
        </div>

        {/* AI Advice */}
        <div className="glass-card p-6 mb-10">
          <div className="flex items-center gap-2 mb-5">
            <span className="text-lg">🤖</span>
            <h2 className="text-base font-semibold text-purple-300 tracking-wide uppercase text-[13px]">AI Recommendations</h2>
            <span className="text-[10px] px-2.5 py-1 rounded-full bg-[#166534] text-[#4ade80] border border-[#22c55e] font-bold tracking-wide shadow-sm">
              Live Meta
            </span>
          </div>
          <div className="ai-prose">
            <ReactMarkdown>{data.advice}</ReactMarkdown>
          </div>
        </div>

        {/* Cards you use */}
        <div className="section-title">
          Cards You Use — {usedCards.length} cards
        </div>

        {/* Grid layout for used cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-10">
          {usedCards.map((card, i) => {
            const gameLevel = toGameLevel(card.level, card.rarity)
            const pct = (gameLevel / 16) * 100
            const isTop5 = i < 5

            return (
              <div
                key={card.name}
                className={`glass-card flex flex-col p-4 transition-all hover:scale-[1.02] ${isTop5 ? 'ring-2 ring-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.2)]' : ''}`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className={`text-sm font-black ${isTop5 ? 'text-purple-400' : 'text-zinc-500'}`}>
                    #{i + 1}
                  </div>
                  
                  {card.iconUrl && (
                    <div className={`relative w-14 h-14 rounded-lg overflow-hidden border-2 border-rarity-${card.rarity} bg-rarity-${card.rarity}`}>
                      <Image
                        src={card.iconUrl}
                        alt={card.name}
                        width={56}
                        height={56}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                      {/* Evo Shard Indicator */}
                      {(card as any).evolutionLevel > 0 && card.iconUrls?.evolutionMedium && !card.iconUrls?.heroMedium && (
                        <div className="absolute top-0 right-0 w-4 h-4 flex items-center justify-center bg-fuchsia-600 border border-fuchsia-300 rounded-sm rotate-45 z-20 transform translate-x-1 -translate-y-1">
                          <span className="-rotate-45 text-[8px] font-black text-white ml-[1px]">❖</span>
                        </div>
                      )}
                      {/* Hero Indicator */}
                      {(card as any).evolutionLevel > 0 && card.iconUrls?.heroMedium && (
                        <div className="absolute top-0 left-0 w-4 h-4 flex items-center justify-center bg-yellow-500 border border-yellow-200 rounded-sm z-20 transform -translate-x-1 -translate-y-1">
                          <span className="text-[10px] font-black text-white ml-[1px] -mt-[1px]">★</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mb-3">
                  <p className="font-bold text-white text-base truncate">{card.name}</p>
                  <div className="flex justify-between items-center mt-1">
                    <p className={`text-xs font-semibold rarity-${card.rarity} capitalize`}>{card.rarity}</p>
                    <p className="text-xs font-bold text-zinc-300">Lvl {formatLevel(card.level, card.rarity)}</p>
                  </div>
                </div>

                <div className="level-bar-bg mb-4 h-1.5">
                  <div
                    className="level-bar-fill"
                    style={{
                      width: `${pct}%`,
                      background: pct >= 100 ? '#22c55e' : pct >= 80 ? '#fbbf24' : '#a855f7',
                    }}
                  />
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-2 mt-auto pt-3 border-t border-white/5">
                  <div className="text-center">
                    <p className="text-xs text-zinc-500 mb-0.5">Used</p>
                    <p className="text-sm font-bold text-zinc-300">{card.appearances}</p>
                  </div>
                  <div className="text-center border-l border-r border-white/5">
                    <p className="text-xs text-zinc-500 mb-0.5">Win %</p>
                    <p className={`text-sm font-bold ${card.winRate > 50 ? 'text-green-400' : card.winRate > 0 ? 'text-yellow-400' : 'text-zinc-500'}`}>
                      {card.winRate}%
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-zinc-500 mb-0.5">Score</p>
                    <p className="text-sm font-bold text-purple-400">{card.upgradeScore}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Unused cards */}
        {unusedCards.length > 0 && (
          <>
            <button
              onClick={() => setShowUnused(!showUnused)}
              className="section-title cursor-pointer hover:text-zinc-400 transition-colors w-full text-left"
            >
              {showUnused ? '▾' : '▸'} Unused Cards — {unusedCards.length} cards
            </button>

            {showUnused && (
              <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2 mt-4">
                {unusedCards.map(card => (
                  <div
                    key={card.name}
                    className="glass-card p-2 text-center opacity-40 hover:opacity-70 transition-opacity"
                  >
                    {card.iconUrl && (
                      <div className="relative w-9 h-9 mx-auto mb-1">
                        <Image
                          src={card.iconUrl}
                          alt={card.name}
                          width={36}
                          height={36}
                          className="rounded"
                          unoptimized
                        />
                      </div>
                    )}
                    <p className="text-[10px] text-zinc-400 truncate">{card.name}</p>
                    <p className="text-[10px] font-bold text-zinc-600">{formatLevel(card.level, card.rarity)}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

      </div>
    </main>
  )
}
