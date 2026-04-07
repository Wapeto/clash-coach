'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSettings, saveSettings, type Settings } from '../utils/settings'

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({ mode: 'fast' })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setSettings(getSettings())
  }, [])

  function updateMode(mode: Settings['mode']) {
    const next = { ...settings, mode }
    setSettings(next)
    saveSettings(next)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <main className="min-h-screen bg-mesh">
      <div className="max-w-2xl mx-auto px-6 py-8">

        <div className="mb-8">
          <Link href="/" className="back-link mb-3 inline-flex">← Back to Dashboard</Link>
          <h1 className="text-3xl font-bold">
            ⚙️ <span className="bg-gradient-to-r from-zinc-300 to-zinc-500 bg-clip-text text-transparent">Settings</span>
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Configure your Clash Coach experience</p>
        </div>

        {/* AI Mode */}
        <div className="glass-card p-6 mb-6">
          <h2 className="text-base font-bold text-white mb-1">AI Analysis Mode</h2>
          <p className="text-zinc-500 text-sm mb-5">
            Fast mode uses a single AI call. Deep mode runs a 3-step chain (Analyst → Strategist → Fact-Checker) for higher quality output, but takes 15–25 seconds.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => updateMode('fast')}
              className={`rounded-xl border p-4 text-left transition-all ${
                settings.mode === 'fast'
                  ? 'border-blue-500 bg-blue-500/10 text-white'
                  : 'border-white/10 bg-white/5 text-zinc-400 hover:border-white/20'
              }`}
            >
              <div className="text-lg font-bold mb-1">⚡ Fast</div>
              <div className="text-xs opacity-70">Single AI call · ~3–5s · Default</div>
            </button>

            <button
              onClick={() => updateMode('deep')}
              className={`rounded-xl border p-4 text-left transition-all ${
                settings.mode === 'deep'
                  ? 'border-purple-500 bg-purple-500/10 text-white'
                  : 'border-white/10 bg-white/5 text-zinc-400 hover:border-white/20'
              }`}
            >
              <div className="text-lg font-bold mb-1">🔬 Deep</div>
              <div className="text-xs opacity-70">3-step AI chain · ~15–25s · Best quality</div>
            </button>
          </div>

          {saved && (
            <p className="text-green-400 text-xs mt-3 font-semibold">✓ Saved</p>
          )}
        </div>

        {/* Future settings (scaffolded) */}
        <div className="glass-card p-6 opacity-50 cursor-not-allowed">
          <h2 className="text-base font-bold text-white mb-1">AI Model <span className="text-xs font-normal text-zinc-500 ml-2">Coming soon</span></h2>
          <p className="text-zinc-500 text-sm mb-4">Choose which Gemini model to use for analysis.</p>
          <select disabled className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-zinc-500 text-sm">
            <option>gemini-2.5-flash (default)</option>
          </select>
        </div>

      </div>
    </main>
  )
}
