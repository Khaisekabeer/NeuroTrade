'use client'

import * as React from 'react'
import { Terminal } from 'lucide-react'
import { useDashboard } from '@/lib/dashboard-store'
import { Panel, LiveDot } from './panel'
import { fmtTime } from './format'
import { cn } from '@/lib/utils'

export function DeliberationLog() {
  const decisions = useDashboard((s) => s.decisions)

  const lines = React.useMemo(() => {
    const out: { ts: number; line: React.ReactNode; key: string }[] = []
    for (const d of decisions) {
      out.push({
        ts: d.ts,
        key: `${d.cycle}-orch`,
        line: (
          <div className="leading-relaxed">
            <span className="text-emerald-400 font-bold">[ORCH #{d.cycle}]</span>{' '}
            <span className="text-zinc-500">{d.symbol}</span>{' '}
            <span
              className={cn(
                'font-bold',
                d.signal === 'LONG' ? 'text-emerald-400' : d.signal === 'SHORT' ? 'text-rose-400' : 'text-amber-400',
              )}
            >
              {d.signal}
            </span>{' '}
            <span className="text-zinc-500">conf {(d.confidence * 100).toFixed(0)}%</span>{' '}
            <span className="text-zinc-300">{d.rationale}</span>
          </div>
        ),
      })
      for (const a of d.agents) {
        out.push({
          ts: a.ts,
          key: `${d.cycle}-${a.agent}`,
          line: (
            <div className="leading-relaxed pl-3 border-l border-zinc-800 ml-2">
              <span className="text-zinc-500">└</span>{' '}
              <span className="text-sky-300 font-semibold">{a.agent}</span>{' '}
              <span
                className={cn(
                  'font-bold',
                  a.signal === 'LONG' ? 'text-emerald-400' : a.signal === 'SHORT' ? 'text-rose-400' : 'text-amber-400',
                )}
              >
                {a.signal}
              </span>{' '}
              <span className="text-zinc-500">({(a.confidence * 100).toFixed(0)}%)</span>{' '}
              <span className="text-zinc-400">{a.rationale}</span>
            </div>
          ),
        })
      }
    }
    return out
  }, [decisions])

  return (
    <Panel
      title="Agent Deliberation Log"
      subtitle={`${decisions.length} cycles · newest first`}
      icon={<Terminal className="h-4 w-4" />}
      actions={
        <span className="flex items-center gap-1 text-[10px] text-zinc-500">
          <LiveDot color="emerald" pulse /> stream
        </span>
      }
      bodyClassName="p-0"
    >
      <div className="max-h-80 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-700 [&::-webkit-scrollbar-track]:bg-transparent bg-zinc-950/80 font-mono text-[11px]">
        {lines.length === 0 ? (
          <div className="grid place-items-center h-32 text-xs text-zinc-600">
            <div className="text-center">
              <Terminal className="h-4 w-4 mx-auto mb-1 opacity-50" />
              awaiting orchestrator decisions…
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-900">
            {lines.map((l) => (
              <li key={l.key} className="px-3 py-1.5 hover:bg-zinc-900/60">
                <div className="flex gap-2">
                  <span className="text-zinc-600 shrink-0 tabular-nums">{fmtTime(l.ts)}</span>
                  <div className="min-w-0 flex-1">{l.line}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  )
}
