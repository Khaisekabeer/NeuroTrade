'use client'

import * as React from 'react'
import { useDashboard, SYMBOLS } from '@/lib/dashboard-store'
import { fmtPrice, fmtPctRaw } from './format'
import { LiveDot } from './panel'
import { cn } from '@/lib/utils'

export function SymbolTabs() {
  const activeSymbol = useDashboard((s) => s.activeSymbol)
  const setActiveSymbol = useDashboard((s) => s.setActiveSymbol)
  const ticks = useDashboard((s) => s.ticks)

  return (
    <div className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-[57px] z-30">
      <div className="mx-auto max-w-[1800px] px-3 sm:px-4 py-2 flex items-center gap-2 overflow-x-auto">
        {SYMBOLS.map((symbol) => {
          const tick = ticks[symbol]
          const price = tick?.price ?? 0
          const change = tick?.change24h ?? 0
          const active = activeSymbol === symbol
          const up = change >= 0
          return (
            <button
              key={symbol}
              onClick={() => setActiveSymbol(symbol)}
              className={cn(
                'group flex items-center gap-2.5 rounded-lg border px-3 py-1.5 min-w-[150px] transition-all shrink-0',
                active
                  ? 'border-emerald-500/60 bg-emerald-500/10 shadow-md shadow-emerald-500/10'
                  : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 hover:bg-zinc-800/60',
              )}
            >
              <div className="flex flex-col items-start leading-tight">
                <span className={cn('text-xs font-bold tracking-wide', active ? 'text-emerald-300' : 'text-zinc-200')}>
                  {symbol}
                </span>
                <span className="text-[10px] text-zinc-500 tabular-nums">
                  {price ? fmtPrice(price) : '—'}
                </span>
              </div>
              <div className="ml-auto flex flex-col items-end leading-tight">
                <span className={cn('text-[11px] font-semibold tabular-nums', up ? 'text-emerald-400' : 'text-rose-400')}>
                  {up ? '+' : ''}{fmtPctRaw(change)}
                </span>
                <span className="flex items-center gap-1">
                  <LiveDot color={active ? 'emerald' : 'zinc'} pulse={active} />
                  <span className="text-[9px] uppercase text-zinc-500">live</span>
                </span>
              </div>
            </button>
          )
        })}
        <div className="ml-auto hidden md:flex items-center gap-2 text-[10px] text-zinc-600">
          <span className="px-2 py-1 rounded border border-zinc-800 bg-zinc-900/60">SPOT · 1m</span>
        </div>
      </div>
    </div>
  )
}
