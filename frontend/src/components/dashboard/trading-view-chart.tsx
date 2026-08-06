'use client'

// TradingView Advanced Chart widget — injected client-side via the official
// tv.js script. Uses container_id (string) which is more reliable than the
// container (DOM ref) option across tv.js builds. Reloads when the symbol
// changes. Overlays a small agent-signal badge from the latest orchestrator
// decision for the active symbol.

import * as React from 'react'
import { useDashboard, SYMBOL_TO_TV } from '@/lib/dashboard-store'
import { signalBg } from './format'
import { Panel } from './panel'
import { CandlestickChart, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

declare global {
  interface Window {
    TradingView?: any
  }
}

// Robust script loader — survives HMR module re-evaluation by checking both
// the module-level promise AND the DOM for an existing script tag.
function loadTvScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.TradingView) return Promise.resolve()
  // check if a script tag already exists (HMR may have reset our promise)
  const existing = document.querySelector('script[src*="tradingview.com/tv.js"]')
  if (existing && (window as any).__tvScriptPromise) {
    return (window as any).__tvScriptPromise
  }
  const p = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://s3.tradingview.com/tv.js'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('failed to load tv.js'))
    document.head.appendChild(s)
  })
  ;(window as any).__tvScriptPromise = p
  return p
}

export function TradingViewChart() {
  const activeSymbol = useDashboard((s) => s.activeSymbol)
  const decisions = useDashboard((s) => s.decisions)
  const tick = useDashboard((s) => s.ticks[s.activeSymbol])

  const widgetRef = React.useRef<any>(null)
  const [loading, setLoading] = React.useState(true)
  const [failed, setFailed] = React.useState(false)
  const tvSymbol = SYMBOL_TO_TV[activeSymbol] ?? 'BITGET:BTCUSDT'
  // stable unique container id per symbol
  const containerId = React.useMemo(
    () => `tv_chart_${activeSymbol.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`,
    [activeSymbol],
  )

  // latest orchestrator decision for active symbol
  const latestDecision = React.useMemo(() => {
    return decisions.find((d) => d.symbol === activeSymbol) ?? null
  }, [decisions, activeSymbol])

  React.useEffect(() => {
    let cancelled = false
    let retryCount = 0
    setLoading(true)
    setFailed(false)

    const createWidget = () => {
      if (cancelled) return
      if (!window.TradingView) {
        // script loaded but TradingView not yet defined — retry
        if (retryCount++ < 20) { setTimeout(createWidget, 150) }
        else { setFailed(true); setLoading(false) }
        return
      }
      const el = document.getElementById(containerId)
      if (!el || el.offsetWidth === 0) {
        // container not laid out yet — retry
        if (retryCount++ < 20) { setTimeout(createWidget, 150) }
        else { setFailed(true); setLoading(false) }
        return
      }
      // destroy previous widget if any
      if (widgetRef.current) {
        try { widgetRef.current.remove?.() } catch { /* ignore */ }
        widgetRef.current = null
      }
      el.innerHTML = ''
      try {
        const widget = new window.TradingView.widget({
          autosize: true,
          symbol: tvSymbol,
          interval: '1',
          timezone: 'Etc/UTC',
          theme: 'dark',
          style: '1',
          locale: 'en',
          toolbar_bg: '#18181b',
          enable_publishing: false,
          hide_top_toolbar: false,
          hide_legend: false,
          allow_symbol_change: false,
          save_image: false,
          backgroundColor: '#09090b',
          gridColor: 'rgba(63, 63, 70, 0.35)',
          container_id: containerId,
        })
        widgetRef.current = widget
        // give the iframe time to inject
        setTimeout(() => { if (!cancelled) setLoading(false) }, 1500)
      } catch (e) {
        if (!cancelled) { setFailed(true); setLoading(false) }
      }
    }

    loadTvScript()
      .then(createWidget)
      .catch(() => { if (!cancelled) { setFailed(true); setLoading(false) } })

    return () => {
      cancelled = true
      if (widgetRef.current) {
        try { widgetRef.current.remove?.() } catch { /* ignore */ }
        widgetRef.current = null
      }
    }
  }, [tvSymbol, containerId])

  return (
    <Panel
      title="Live Chart"
      subtitle={`${activeSymbol} · Bitget · 1m`}
      icon={<CandlestickChart className="h-4 w-4" />}
      actions={
        <div className="flex items-center gap-2">
          {tick && (
            <span className="text-[11px] tabular-nums text-zinc-400">
              Sim: <span className="text-zinc-200 font-mono">{tick.price.toFixed(2)}</span>
            </span>
          )}
          {latestDecision && (
            <span
              className={cn(
                'rounded border px-2 py-0.5 text-[10px] font-bold tracking-wide',
                signalBg(latestDecision.signal),
              )}
            >
              {latestDecision.signal}
            </span>
          )}
        </div>
      }
      noPad
      bodyClassName="relative p-0"
      className="h-[480px]"
    >
      <div id={containerId} className="absolute inset-0 h-full w-full" />
      {loading && (
        <div className="absolute inset-0 grid place-items-center bg-zinc-950/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2 text-zinc-400">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
            <span className="text-xs">Loading TradingView · {tvSymbol}</span>
          </div>
        </div>
      )}
      {failed && (
        <div className="absolute inset-0 grid place-items-center bg-zinc-950/80">
          <div className="text-center px-4">
            <div className="text-xs text-rose-300">TradingView widget failed to load.</div>
            <div className="text-[10px] text-zinc-500 mt-1">Check network access to s3.tradingview.com</div>
            <button
              onClick={() => location.reload()}
              className="mt-3 rounded border border-zinc-700 px-2 py-1 text-[10px] text-zinc-300 hover:bg-zinc-800"
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </Panel>
  )
}
