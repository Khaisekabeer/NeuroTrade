'use client'

import * as React from 'react'
import { Cpu, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'
import { useDashboard } from '@/lib/dashboard-store'
import { Panel, LiveDot } from './panel'
import { signalBg, signalColor, fmtPct, timeAgo } from './format'
import { cn } from '@/lib/utils'

export function OrchestratorDecision() {
  const activeSymbol = useDashboard((s) => s.activeSymbol)
  const decisions = useDashboard((s) => s.decisions)
  const portfolio = useDashboard((s) => s.portfolio)

  const decision = React.useMemo(
    () => decisions.find((d) => d.symbol === activeSymbol) ?? null,
    [decisions, activeSymbol],
  )

  const position = portfolio?.positions.find((p) => p.symbol === activeSymbol) ?? null
  const openedNote = position ? `${position.side} size ${position.size.toFixed(4)} @ ${position.entryPrice.toFixed(2)}` : null

  return (
    <Panel
      title="Orchestrator Decision"
      subtitle={`${activeSymbol} · latest`}
      icon={<Cpu className="h-4 w-4" />}
      actions={
        <span className="flex items-center gap-1 text-[10px] text-zinc-500">
          <LiveDot color="emerald" pulse />
          meta-reasoner
        </span>
      }
    >
      {!decision ? (
        <div className="grid place-items-center h-32 text-xs text-zinc-500">
          <div className="text-center">
            <Cpu className="h-5 w-5 mx-auto mb-1 text-zinc-600 animate-pulse" />
            Awaiting first orchestrator cycle…
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'grid place-items-center h-12 w-12 rounded-lg border-2',
                decision.signal === 'LONG'
                  ? 'border-emerald-500/50 bg-emerald-500/10'
                  : decision.signal === 'SHORT'
                    ? 'border-rose-500/50 bg-rose-500/10'
                    : 'border-amber-500/50 bg-amber-500/10',
              )}
            >
              {decision.signal === 'LONG' && <ArrowUpRight className="h-6 w-6 text-emerald-400" />}
              {decision.signal === 'SHORT' && <ArrowDownRight className="h-6 w-6 text-rose-400" />}
              {decision.signal === 'FLAT' && <Minus className="h-6 w-6 text-amber-400" />}
              {decision.signal === 'HOLD' && <Minus className="h-6 w-6 text-zinc-400" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={cn('rounded border px-2 py-0.5 text-xs font-bold tracking-wide', signalBg(decision.signal))}>
                  {decision.signal}
                </span>
                <span className="text-[11px] text-zinc-500">cycle</span>
                <span className="text-[11px] font-mono text-zinc-300">#{decision.cycle}</span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-[11px]">
                <span className="text-zinc-500">confidence</span>
                <span className={cn('font-mono font-semibold', signalColor(decision.signal))}>
                  {fmtPct(decision.confidence, 0)}
                </span>
                <span className="text-zinc-500">·</span>
                <span className="text-zinc-500">{timeAgo(decision.ts)}</span>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-zinc-300 leading-relaxed border-t border-zinc-800/70 pt-2">
            {decision.rationale}
          </p>
          {openedNote && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-2 py-1.5 text-[10px] text-emerald-300">
              <span className="text-zinc-500">Position:</span> {openedNote}
            </div>
          )}
        </div>
      )}
    </Panel>
  )
}
