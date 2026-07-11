'use client'

import * as React from 'react'
import { LineChart as LineChartIcon, ExternalLink, Check } from 'lucide-react'
import { Panel, LiveDot } from './panel'
import { useDashboard } from '@/lib/dashboard-store'

export function TradingViewCard() {
  const wsConnected = useDashboard((s) => s.wsConnected)
  return (
    <Panel
      title="TradingView"
      subtitle="embedded advanced chart"
      icon={<LineChartIcon className="h-4 w-4" />}
      actions={
        <span className="flex items-center gap-1 text-[10px] text-zinc-500">
          <LiveDot color="sky" pulse /> live
        </span>
      }
    >
      <div className="space-y-3">
        <div className="rounded-md border border-sky-500/30 bg-sky-500/5 px-3 py-2 text-[11px] text-sky-200 flex items-start gap-2">
          <Check className="h-3.5 w-3.5 shrink-0 mt-0.5 text-sky-400" />
          <span>
            TradingView Advanced Chart widget is live in the chart card above, streaming real Bitget spot candles.
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-md border border-zinc-800 bg-zinc-950/50 px-2 py-1.5">
            <div className="text-[10px] uppercase text-zinc-500">Widget</div>
            <div className="text-zinc-200 font-mono">tv.js</div>
          </div>
          <div className="rounded-md border border-zinc-800 bg-zinc-950/50 px-2 py-1.5">
            <div className="text-[10px] uppercase text-zinc-500">Interval</div>
            <div className="text-zinc-200 font-mono">1m</div>
          </div>
          <div className="rounded-md border border-zinc-800 bg-zinc-950/50 px-2 py-1.5">
            <div className="text-[10px] uppercase text-zinc-500">Theme</div>
            <div className="text-zinc-200 font-mono">dark</div>
          </div>
          <div className="rounded-md border border-zinc-800 bg-zinc-950/50 px-2 py-1.5">
            <div className="text-[10px] uppercase text-zinc-500">Feed</div>
            <div className="text-zinc-200 font-mono">{wsConnected ? 'live' : 'cached'}</div>
          </div>
        </div>
        <a
          href="https://www.tradingview.com"
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700/60 min-h-[40px] transition-colors"
        >
          Open tradingview.com <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </Panel>
  )
}
