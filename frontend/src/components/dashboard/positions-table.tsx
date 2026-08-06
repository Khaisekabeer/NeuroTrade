'use client'

import * as React from 'react'
import { Wallet, X } from 'lucide-react'
import { useDashboard } from '@/lib/dashboard-store'
import { Panel } from './panel'
import { fmtPrice, fmtUsd, pnlColor } from './format'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Position } from '@/lib/types'

export function PositionsTable() {
  const portfolio = useDashboard((s) => s.portfolio)
  const ticks = useDashboard((s) => s.ticks)
  const [closing, setClosing] = React.useState<string | null>(null)

  const positions: Position[] = portfolio?.positions ?? []

  async function closePosition(symbol: string) {
    setClosing(symbol)
    try {
      const res = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close', symbol }),
      })
      const data = await res.json().catch(() => ({}))
      if (data?.ok) {
        toast.success(`Closed ${symbol}`, {
          description: data.trade ? `Realized P&L ${data.trade.pnl >= 0 ? '+' : ''}$${data.trade.pnl.toFixed(2)}` : undefined,
        })
      } else {
        toast.error(`Failed to close ${symbol}`, { description: data?.error ?? 'No open position' })
      }
    } catch (e: any) {
      toast.error('Close failed', { description: e?.message })
    } finally {
      setClosing(null)
    }
  }

  return (
    <Panel
      title="Open Positions"
      subtitle={`${positions.length} active`}
      icon={<Wallet className="h-4 w-4" />}
      bodyClassName="p-0"
    >
      {positions.length === 0 ? (
        <div className="grid place-items-center h-32 text-xs text-zinc-500 px-4 text-center">
          <div>
            <Wallet className="h-5 w-5 mx-auto mb-1 text-zinc-600" />
            No open positions — agents are scanning
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-zinc-900/60 text-zinc-500 border-b border-zinc-800">
              <tr>
                <th className="text-left font-medium px-3 py-2">Symbol</th>
                <th className="text-left font-medium px-2 py-2">Side</th>
                <th className="text-right font-medium px-2 py-2">Size</th>
                <th className="text-right font-medium px-2 py-2">Entry</th>
                <th className="text-right font-medium px-2 py-2">Current</th>
                <th className="text-right font-medium px-2 py-2">Unrealized</th>
                <th className="text-right font-medium px-2 py-2">SL</th>
                <th className="text-right font-medium px-2 py-2">TP</th>
                <th className="text-right font-medium px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => {
                const tick = ticks[p.symbol]
                const current = tick?.price ?? p.entryPrice
                const upnl = p.unrealized
                const sideLong = p.side === 'LONG'
                return (
                  <tr key={p.symbol} className="border-b border-zinc-800/60 hover:bg-zinc-800/30">
                    <td className="px-3 py-2 font-semibold text-zinc-100">{p.symbol}</td>
                    <td className="px-2 py-2">
                      <span className={cn('rounded border px-1.5 py-0.5 text-[10px] font-bold', sideLong ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' : 'bg-rose-500/15 text-rose-300 border-rose-500/40')}>
                        {p.side}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right font-mono tabular-nums text-zinc-300">{p.size.toFixed(4)}</td>
                    <td className="px-2 py-2 text-right font-mono tabular-nums text-zinc-300">{fmtPrice(p.entryPrice)}</td>
                    <td className="px-2 py-2 text-right font-mono tabular-nums text-zinc-200">{fmtPrice(current)}</td>
                    <td className={cn('px-2 py-2 text-right font-mono tabular-nums font-semibold', pnlColor(upnl))}>
                      {upnl >= 0 ? '+' : ''}{fmtUsd(upnl)}
                    </td>
                    <td className="px-2 py-2 text-right font-mono tabular-nums text-rose-300/80">{fmtPrice(p.stopLoss)}</td>
                    <td className="px-2 py-2 text-right font-mono tabular-nums text-emerald-300/80">{fmtPrice(p.takeProfit)}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => closePosition(p.symbol)}
                        disabled={closing === p.symbol}
                        className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-[10px] font-semibold text-rose-300 hover:bg-rose-500/20 disabled:opacity-50 transition-colors"
                      >
                        <X className="h-3 w-3" />
                        {closing === p.symbol ? '…' : 'Close'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}
