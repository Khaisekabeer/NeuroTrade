'use client'

import * as React from 'react'
import { ShieldAlert } from 'lucide-react'
import { useDashboard } from '@/lib/dashboard-store'
import { LiveDot } from './panel'

function uptime(startedAt: number | undefined): string {
  if (!startedAt) return '—'
  const s = Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${h}h ${m}m ${sec}s`
}

export function Footer() {
  const status = useDashboard((s) => s.status)
  const wsConnected = useDashboard((s) => s.wsConnected)
  const [up, setUp] = React.useState('—')
  React.useEffect(() => {
    const iv = setInterval(() => setUp(uptime(status?.startedAt)), 1000)
    return () => clearInterval(iv)
  }, [status?.startedAt])

  const running = status?.engine?.running ?? false
  const predictors = status?.engine?.predictors ?? 0
  const sentimentCache = status?.engine?.sentimentCache ?? 0

  return (
    <footer className="mt-auto border-t border-zinc-800 bg-zinc-950/95 backdrop-blur">
      <div className="mx-auto max-w-[1800px] px-3 sm:px-4 py-2.5 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 text-[11px]">
        <div className="flex items-center gap-2 text-zinc-400">
          <ShieldAlert className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span className="text-amber-300/90 font-medium">PAPER TRADING SIMULATION</span>
          <span className="text-zinc-600 hidden sm:inline">—</span>
          <span className="text-zinc-500 hidden sm:inline">
            No real funds at risk. Connect Bitget API keys for live execution. Educational use only.
          </span>
        </div>
        <div className="sm:ml-auto flex items-center gap-3 sm:gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <LiveDot color={running ? 'emerald' : 'rose'} pulse={running} />
            <span className="text-zinc-400">Engine</span>
            <span className={running ? 'text-emerald-300' : 'text-rose-300'}>
              {running ? 'RUNNING' : 'IDLE'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-zinc-500">
            <span>Agents:</span>
            <span className="text-zinc-300 font-mono">5</span>
          </div>
          <div className="flex items-center gap-1.5 text-zinc-500">
            <span>NN Predictors:</span>
            <span className="text-zinc-300 font-mono">{predictors}</span>
          </div>
          <div className="flex items-center gap-1.5 text-zinc-500">
            <span>Sentiment Cache:</span>
            <span className="text-zinc-300 font-mono">{sentimentCache}</span>
          </div>
          <div className="flex items-center gap-1.5 text-zinc-500">
            <span>WS:</span>
            <span className={wsConnected ? 'text-emerald-300' : 'text-amber-300'}>
              {wsConnected ? 'LIVE' : 'FALLBACK'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-zinc-500">
            <span>Uptime:</span>
            <span className="text-zinc-300 font-mono tabular-nums">{up}</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
