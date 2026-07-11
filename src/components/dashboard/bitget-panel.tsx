'use client'

import * as React from 'react'
import { Radio, RefreshCw, Loader2, ExternalLink, KeyRound } from 'lucide-react'
import { useDashboard, SYMBOL_TO_BITGET, SYMBOLS } from '@/lib/dashboard-store'
import { Panel, LiveDot } from './panel'
import { fmtPrice, fmtPctRaw } from './format'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface BitgetTickerRaw {
  symbol: string
  lastPr: string
  open24h: string
  high24h: string
  low24h: string
  change24h: string
  quoteVolume24h: string
}

export function BitgetPanel() {
  const status = useDashboard((s) => s.bitgetStatus)
  const setBitgetTickers = useDashboard((s) => s.setBitgetTickers)
  const tickers = useDashboard((s) => s.bitgetTickers)
  const ticks = useDashboard((s) => s.ticks)
  const [loading, setLoading] = React.useState(false)

  async function fetchTickers() {
    setLoading(true)
    try {
      const syms = SYMBOLS.map((s) => SYMBOL_TO_BITGET[s]).join(',')
      const res = await fetch(`/api/bitget?action=tickers&symbols=${encodeURIComponent(syms)}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (data?.live && Array.isArray(data?.data)) {
        const mapped: BitgetTickerRaw[] = data.data
        setBitgetTickers(mapped)
        toast.success('Fetched live Bitget tickers', { description: `${mapped.length} symbols` })
      } else {
        toast.error('Bitget fetch failed', { description: data?.error ?? 'see console' })
      }
    } catch (e: any) {
      toast.error('Bitget fetch failed', { description: e?.message })
    } finally {
      setLoading(false)
    }
  }

  const connected = !!status?.connected

  return (
    <Panel
      title="Bitget Connection"
      subtitle={status?.host ?? 'api.bitget.com'}
      icon={<Radio className="h-4 w-4" />}
      actions={
        <span className="flex items-center gap-1 text-[10px] text-zinc-500">
          <LiveDot color={connected ? 'emerald' : 'amber'} pulse={connected} />
          {connected ? 'AUTH' : 'PUBLIC'}
        </span>
      }
    >
      <div className="space-y-3">
        <div
          className={cn(
            'rounded-md border px-3 py-2 text-[11px] leading-relaxed',
            connected
              ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-200'
              : 'border-amber-500/40 bg-amber-500/5 text-amber-200',
          )}
        >
          {status?.message ?? 'Checking connection…'}
        </div>

        <button
          onClick={fetchTickers}
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700/60 disabled:opacity-50 min-h-[40px] transition-colors"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Fetch Live Bitget Tickers
        </button>

        {tickers && tickers.length > 0 && (
          <div className="rounded-md border border-zinc-800 bg-zinc-950/60 overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-2 py-1.5 text-[10px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
              <span>Symbol</span>
              <span className="text-right">Live</span>
              <span className="text-right">Sim</span>
            </div>
            {tickers.map((t) => {
              const sym = SYMBOLS.find((s) => SYMBOL_TO_BITGET[s] === t.symbol) ?? t.symbol
              const live = Number(t.lastPr)
              const simTick = typeof sym === 'string' ? ticks[sym] : undefined
              const sim = simTick?.price ?? 0
              const diff = live && sim ? ((sim - live) / live) * 100 : 0
              return (
                <div key={t.symbol} className="grid grid-cols-[1fr_auto_auto] gap-2 px-2 py-1.5 text-[11px] border-b border-zinc-900 last:border-0">
                  <span className="text-zinc-300 font-medium">{t.symbol}</span>
                  <span className="text-right font-mono tabular-nums text-emerald-300">{fmtPrice(live)}</span>
                  <span className="text-right font-mono tabular-nums text-zinc-400">
                    {sim ? fmtPrice(sim) : '—'}
                    {diff !== 0 && (
                      <span className={cn('ml-1 text-[9px]', diff > 0 ? 'text-emerald-500' : 'text-rose-500')}>
                        {diff > 0 ? '+' : ''}{fmtPctRaw(diff, 2)}
                      </span>
                    )}
                  </span>
                </div>
              )
            })}
            <div className="px-2 py-1 text-[9px] text-zinc-600 border-t border-zinc-800">
              24h change shown via simulated feed; live spot from Bitget v2 public API.
            </div>
          </div>
        )}

        <div className="rounded-md border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-[10px] text-zinc-500 leading-relaxed flex gap-2">
          <KeyRound className="h-3.5 w-3.5 shrink-0 mt-0.5 text-zinc-600" />
          <span>
            Authenticated order execution requires <code className="text-zinc-300">BITGET_API_KEY</code> /{' '}
            <code className="text-zinc-300">SECRET</code> / <code className="text-zinc-300">PASSPHRASE</code> env vars.
            See <code className="text-zinc-300">/python-core</code> for the live execution engine.{' '}
            <a
              href="https://www.bitget.com/api-doc/common/intro"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 text-emerald-400 hover:underline"
            >
              API docs <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </span>
        </div>
      </div>
    </Panel>
  )
}
