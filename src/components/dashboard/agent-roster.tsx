'use client'

import * as React from 'react'
import { Newspaper, LineChart as LineChartIcon, Brain, ShieldCheck, Cpu } from 'lucide-react'
import { useDashboard, AGENT_ORDER } from '@/lib/dashboard-store'
import { Panel, LiveDot } from './panel'
import type { AgentName, AgentOutput } from '@/lib/types'
import { signalBg, signalColor, fmtPct, timeAgo } from './format'
import { cn } from '@/lib/utils'

const EMPTY_AGENTS: AgentOutput[] = []

const AGENT_META: Record<AgentName, { icon: React.ReactNode; label: string; desc: string }> = {
  SENTIMENT: { icon: <Newspaper className="h-4 w-4" />, label: 'Sentiment', desc: 'News + LLM scoring' },
  TECHNICAL: { icon: <LineChartIcon className="h-4 w-4" />, label: 'Technical', desc: 'RSI / MACD / EMA / Boll' },
  ML: { icon: <Brain className="h-4 w-4" />, label: 'Machine Learning', desc: 'Online-trained NN' },
  RISK: { icon: <ShieldCheck className="h-4 w-4" />, label: 'Risk', desc: 'Kelly + exposure gates' },
  ORCHESTRATOR: { icon: <Cpu className="h-4 w-4" />, label: 'Orchestrator', desc: 'LLM meta-reasoner' },
}

export function AgentRoster() {
  const activeSymbol = useDashboard((s) => s.activeSymbol)
  const agents = useDashboard((s) => s.agentsBySymbol[s.activeSymbol]) ?? EMPTY_AGENTS
  const decisions = useDashboard((s) => s.decisions)
  const status = useDashboard((s) => s.status)

  const engineRunning = status?.engine?.running ?? false

  // latest orchestrator decision for active symbol
  const latestDecision = React.useMemo(() => {
    return decisions.find((d) => d.symbol === activeSymbol) ?? null
  }, [decisions, activeSymbol])

  // map agent -> latest output for the active symbol
  const byAgent = React.useMemo(() => {
    const m: Record<string, AgentOutput> = {}
    for (const a of agents) {
      if (!m[a.agent]) m[a.agent] = a
    }
    return m
  }, [agents])

  const orchestratorRow: AgentOutput | null = latestDecision
    ? {
        agent: 'ORCHESTRATOR',
        signal: latestDecision.signal,
        confidence: latestDecision.confidence,
        detail: {},
        rationale: latestDecision.rationale,
        ts: latestDecision.ts,
      }
    : null

  const rows = AGENT_ORDER.map((name) => ({
    name,
    meta: AGENT_META[name],
    out: name === 'ORCHESTRATOR' ? orchestratorRow : byAgent[name] ?? null,
  }))

  return (
    <Panel
      title="Agent Roster"
      subtitle={`${activeSymbol} · 5 specialists + orchestrator`}
      icon={<Cpu className="h-4 w-4" />}
      bodyClassName="p-2"
    >
      <div className="flex flex-col gap-1">
        {rows.map(({ name, meta, out }) => {
          const sig = out?.signal ?? 'HOLD'
          const conf = out?.confidence ?? 0
          const isOrch = name === 'ORCHESTRATOR'
          return (
            <div
              key={name}
              className={cn(
                'flex items-start gap-2 rounded-lg px-2 py-2 transition-colors',
                isOrch ? 'bg-zinc-800/50 border border-zinc-700/60' : 'hover:bg-zinc-800/40',
              )}
            >
              <div
                className={cn(
                  'grid place-items-center h-7 w-7 rounded-md shrink-0',
                  isOrch ? 'bg-emerald-500/15 text-emerald-300' : 'bg-zinc-800 text-zinc-300',
                )}
              >
                {meta.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-zinc-100">{meta.label}</span>
                  {isOrch && engineRunning && (
                    <span className="flex items-center gap-1 text-[9px] uppercase text-emerald-400">
                      <LiveDot color="emerald" /> live
                    </span>
                  )}
                  <span className="ml-auto text-[10px] text-zinc-500 tabular-nums">
                    {out ? timeAgo(out.ts) : '—'}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={cn(
                      'rounded border px-1.5 py-0.5 text-[10px] font-bold tracking-wide',
                      signalBg(sig),
                    )}
                  >
                    {sig}
                  </span>
                  <span className="text-[10px] text-zinc-500">conf</span>
                  <span className={cn('text-[11px] font-mono tabular-nums', signalColor(sig))}>
                    {fmtPct(conf, 0)}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500 leading-snug mt-1 line-clamp-2" title={out?.rationale ?? ''}>
                  {out?.rationale ?? 'Awaiting first cycle…'}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}
