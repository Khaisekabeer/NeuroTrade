'use client'

import * as React from 'react'
import { LineChart as LineChartIcon } from 'lucide-react'
import { useDashboard } from '@/lib/dashboard-store'
import { Panel, StatTile } from './panel'
import type { AgentOutput } from '@/lib/types'
import { cn } from '@/lib/utils'

function findTechnical(agents: AgentOutput[] | undefined): AgentOutput | null {
  if (!agents) return null
  return agents.find((a) => a.agent === 'TECHNICAL') ?? null
}

function num(v: any): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function TrendBar({ score }: { score: number }) {
  // score in -1..1
  const s = Math.max(-1, Math.min(1, score))
  const bullish = s >= 0
  const width = Math.abs(s) * 50
  return (
    <div className="relative h-2.5 w-full rounded-full bg-zinc-800 overflow-hidden">
      <div className="absolute top-0 bottom-0 left-1/2 w-px bg-zinc-600 z-10" />
      <div
        className={cn('absolute top-0 bottom-0 transition-all duration-500', bullish ? 'bg-emerald-500' : 'bg-rose-500')}
        style={bullish ? { left: '50%', width: `${width}%` } : { right: '50%', width: `${width}%` }}
      />
    </div>
  )
}

export function TechnicalPanel() {
  const activeSymbol = useDashboard((s) => s.activeSymbol)
  const agents = useDashboard((s) => s.agentsBySymbol[s.activeSymbol])
  const tech = findTechnical(agents)

  const detail = tech?.detail ?? {}
  const rsi = num(detail.rsi)
  const macdHist = num(detail.macdHist)
  const emaCross = num(detail.emaCross)
  const bollPctB = num(detail.bollPercentB)
  const atr = num(detail.atr)
  const trendScore = num(detail.trendScore)

  const rsiColor = rsi > 70 ? 'text-rose-400' : rsi < 30 ? 'text-emerald-400' : 'text-zinc-200'
  const macdColor = macdHist >= 0 ? 'text-emerald-400' : 'text-rose-400'
  const emaColor = emaCross >= 0 ? 'text-emerald-400' : 'text-rose-400'
  const bollColor = bollPctB > 1 ? 'text-rose-400' : bollPctB < 0 ? 'text-emerald-400' : 'text-zinc-200'

  return (
    <Panel
      title="Technical Indicators"
      subtitle={`${activeSymbol} · TECHNICAL agent output`}
      icon={<LineChartIcon className="h-4 w-4" />}
      actions={
        tech ? (
          <span className="text-[10px] text-zinc-500">updated {new Date(tech.ts).toLocaleTimeString('en-US', { hour12: false })}</span>
        ) : null
      }
    >
      {!tech ? (
        <div className="grid place-items-center h-24 text-xs text-zinc-500">
          Awaiting technical agent cycle…
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatTile label="RSI(14)" value={<span className={rsiColor}>{rsi.toFixed(1)}</span>} hint={rsi > 70 ? 'overbought' : rsi < 30 ? 'oversold' : 'neutral'} />
            <StatTile label="MACD Hist" value={<span className={macdColor}>{macdHist >= 0 ? '+' : ''}{macdHist.toFixed(3)}</span>} hint={macdHist >= 0 ? 'bullish' : 'bearish'} />
            <StatTile label="EMA Cross" value={<span className={emaColor}>{emaCross >= 0 ? '+' : ''}{emaCross.toFixed(3)}</span>} hint="EMA12 − EMA26" />
            <StatTile label="Boll %B" value={<span className={bollColor}>{bollPctB.toFixed(2)}</span>} hint={bollPctB > 1 ? 'above upper' : bollPctB < 0 ? 'below lower' : 'in band'} />
            <StatTile label="ATR" value={<span className="text-zinc-200">{atr.toFixed(2)}</span>} hint="avg true range" />
            <StatTile
              label="Trend Score"
              value={<span className={trendScore >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{trendScore >= 0 ? '+' : ''}{trendScore.toFixed(2)}</span>}
              hint={trendScore > 0.25 ? 'up' : trendScore < -0.25 ? 'down' : 'flat'}
            />
          </div>
          <div>
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
              <span>Trend Score</span>
              <span className="text-zinc-600">-1 · 0 · +1</span>
            </div>
            <TrendBar score={trendScore} />
          </div>
          <p className="text-[11px] text-zinc-500 leading-relaxed line-clamp-2 border-t border-zinc-800/70 pt-2">
            {tech.rationale}
          </p>
        </div>
      )}
    </Panel>
  )
}
