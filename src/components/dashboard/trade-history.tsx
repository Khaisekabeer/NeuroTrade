'use client'

import * as React from 'react'
import { History } from 'lucide-react'
import { useDashboard } from '@/lib/dashboard-store'
import { Panel } from './panel'
import { fmtPrice, fmtUsd, fmtPct, pnlColor, signalBg, fmtTime } from './format'
import { cn } from '@/lib/utils'

export function TradeHistory() {
  const trades = useDashboard((s) => s.trades)

  return (
    <Panel
      title="Trade History"
      subtitle={`${trades.length} recent`}
      icon={<History className="h-4 w-4" />}
      bodyClassName="p-0"
    >
      <div className="max-h-80 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-700 [&::-webkit-scrollbar-track]:bg-transparent">
        {trades.length === 0 ? (
          <div className="grid place-items-center h-32 text-xs text-zinc-500">
            No trades yet — engine will record them here.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-zinc-900/80 text-zinc-500 border-b border-zinc-800 sticky top-0 z-10">
              <tr>
                <th className="text-left font-medium px-3 py-2">Time</th>
                <th className="text-left font-medium px-2 py-2">Symbol</th>
                <th className="text-left font-medium px-2 py-2">Side</th>
                <th className="text-right font-medium px-2 py-2">Size</th>
                <th className="text-right font-medium px-2 py-2">Entry</th>
                <th className="text-right font-medium px-2 py-2">Exit</th>
                <th className="text-right font-medium px-2 py-2">P&L</th>
                <th className="text-right font-medium px-2 py-2">Conf</th>
                <th className="text-left font-medium px-3 py-2 max-w-[180px]">Rationale</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => {
                const pnl = t.pnl
                const closed = t.status === 'CLOSED'
                return (
                  <tr key={t.id} className="border-b border-zinc-800/60 hover:bg-zinc-800/30">
                    <td className="px-3 py-1.5 font-mono text-[10px] text-zinc-500">{fmtTime(t.openedAt)}</td>
                    <td className="px-2 py-1.5 font-semibold text-zinc-200">{t.symbol}</td>
                    <td className="px-2 py-1.5">
                      <span className={cn('rounded border px-1 py-0.5 text-[9px] font-bold', signalBg(t.side))}>
                        {t.side}
                      </span>
                      {!closed && (
                        <span className="ml-1 text-[9px] text-amber-400">OPEN</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono tabular-nums text-zinc-400">{t.size.toFixed(4)}</td>
                    <td className="px-2 py-1.5 text-right font-mono tabular-nums text-zinc-400">{fmtPrice(t.entryPrice)}</td>
                    <td className="px-2 py-1.5 text-right font-mono tabular-nums text-zinc-400">
                      {t.exitPrice ? fmtPrice(t.exitPrice) : '—'}
                    </td>
                    <td className={cn('px-2 py-1.5 text-right font-mono tabular-nums font-semibold', pnlColor(pnl))}>
                      {pnl == null ? '—' : `${pnl >= 0 ? '+' : ''}${fmtUsd(pnl)}`}
                      {t.pnlPct != null && (
                        <span className="block text-[9px] opacity-70">
                          {t.pnlPct >= 0 ? '+' : ''}{fmtPct(t.pnlPct, 2)}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono tabular-nums text-zinc-400">
                      {fmtPct(t.confidence, 0)}
                    </td>
                    <td className="px-3 py-1.5 text-[10px] text-zinc-500 max-w-[180px] truncate" title={t.rationale}>
                      {t.rationale}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </Panel>
  )
}
