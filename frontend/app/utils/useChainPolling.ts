import { useEffect, useRef, useState } from 'react'

export type ChainStatus = 'running' | 'complete' | 'error'

export interface ChainJob {
  job_id: string
  status: ChainStatus
  current_step: string
  result: unknown
  error: string | null
}

export const STEP_LABELS: Record<string, string> = {
  starting: 'Starting analysis...',
  analyst: '🔍 Analyst is reviewing your data...',
  meta_search: '🌐 Searching live meta decks...',
  strategist: '🧠 Strategist is building recommendations...',
  fact_checker: '✅ Fact-checker is validating decks...',
  formatter: '✏️ Formatting final output...',
  done: '✅ Done!',
}

export function useChainPolling(jobId: string | null, apiUrl: string) {
  const [job, setJob] = useState<ChainJob | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!jobId) return

    const poll = async () => {
      try {
        const r = await fetch(`${apiUrl}/status/${jobId}`)
        if (!r.ok) return
        const data: ChainJob = await r.json()
        setJob(data)
        if (data.status === 'complete' || data.status === 'error') {
          if (intervalRef.current) clearInterval(intervalRef.current)
        }
      } catch {
        // network error — keep polling
      }
    }

    poll()
    intervalRef.current = setInterval(poll, 2000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [jobId, apiUrl])

  return job
}
