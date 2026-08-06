'use client'

import * as React from 'react'
import { ShieldCheck, AlertTriangle } from 'lucide-react'
import { useDashboard } from '@/lib/dashboard-store'
import { Panel, StatTile } from './panel'
import { fmtPct } from './format'
import { cn } from '@/lib/utils'

function Bar({
  value,
  max,
  label,
  sublabel,
  danger = false,
}: {
  value: number
  max: number
  label: string
  sublabel?: string
  danger?: boolean
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  const color = danger
    ? pct > 80
      ? 'bg-rose-500'
      : pct > 60
        ? 'bg-amber-500'
        : 'bg-emerald-500'
    : pct > 80
      ? 'bg-rose-500'
      : 'bg-emerald-500'
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-zinc-400">{label}</span>
        <span className="tabular-nums text-zinc-300 font-mono">
          {fmtPct(value, 1)} <span className="text-zinc-600">/ {fmtPct(max, 0)}</span>
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
        <div className={cn('h-full transition-all duration-500', color)} style={{ width: `${pct}%` }} />
      </div>
      {sublabel && <div className="text-[10px] text-zinc-500 mt-1">{sublabel}</div>}
    </div>
  )
}

export function RiskDashboard() {
  const portfolio = useDashboard((s) => s.portfolio)
  const risk = useDashboard((s) => s.risk)

  const exposure = portfolio?.exposure ?? 0
  const drawdown = portfolio?.drawdown ?? 0
  const winRate = portfolio?.winRate ?? 0
  const maxExposure = risk?.maxTotalExposure ?? 0.6
  const maxDrawdown = risk?.maxDrawdown ?? 0.15
  const maxRisk = risk?.maxRiskPerTrade ?? 0.02
  const levCap = risk?.leverageCap ?? 5

  const ddPct = maxDrawdown > 0 ? drawdown / maxDrawdown : 0

  return (
    <Panel
      title="Risk Dashboard"
      subtitle="live exposure vs limits"
      icon={<ShieldCheck className="h-4 w-4" />}
      actions={
        ddPct > 0.8 ? (
          <span className="flex items-center gap-1 text-[10px] text-rose-400">
            <AlertTriangle className="h-3 w-3" /> DD ALERT
          </span>
        ) : null
      }
    >
      <div className="space-y-3">
        <Bar
          label="Total Exposure"
          value={exposure}
          max={maxExposure}
          sublabel={exposure > maxExposure ? 'over limit — risk gate closed' : 'within limit'}
        />
        <Bar
          label="Drawdown"
          value={drawdown}
          max={maxDrawdown}
          danger
          sublabel={ddPct > 0.8 ? 'approaching max drawdown' : 'within limit'}
        />
        <div className="grid grid-cols-2 gap-2 pt-1">
          <StatTile
            label="Win Rate"
            value={<span className={winRate >= 0.5 ? 'text-emerald-400' : 'text-amber-300'}>{fmtPct(winRate, 1)}</span>}
          />
          <StatTile
            label="Max Risk / Trade"
            value={<span className="text-zinc-200">{fmtPct(maxRisk, 1)}</span>}
          />
          <StatTile
            label="Leverage Cap"
            value={<span className="text-zinc-200">{levCap}x</span>}
          />
          <StatTile
            label="Realized P&L"
            value={
              <span className={(portfolio?.realizedPnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {(portfolio?.realizedPnl ?? 0) >= 0 ? '+' : ''}${(portfolio?.realizedPnl ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            }
          />
        </div>
      </div>
    </Panel>
  )
}
