'use client'

import * as React from 'react'
import { Brain, Zap } from 'lucide-react'
import { ResponsiveContainer, LineChart, Line, ReferenceLine, YAxis, Tooltip } from 'recharts'
import { useDashboard } from '@/lib/dashboard-store'
import { Panel, StatTile } from './panel'
import { fmtPct, fmtPctRaw } from './format'
import { cn } from '@/lib/utils'

const EMPTY_HISTORY: number[] = []

export function MLPrediction() {
  const activeSymbol = useDashboard((s) => s.activeSymbol)
  const ml = useDashboard((s) => s.mlBySymbol[s.activeSymbol])
  const history = useDashboard((s) => s.mlHistory[s.activeSymbol]) ?? EMPTY_HISTORY

  const probUp = ml?.probUp ?? 0.5
  const expectedReturn = ml?.expectedReturn ?? 0
  const confidence = ml?.confidence ?? 0
  const trainedSteps = ml?.trainedSteps ?? 0

  const bullish = probUp >= 0.5
  const barColor = bullish ? 'bg-emerald-500' : 'bg-rose-500'
  const barWidth = Math.max(2, Math.min(100, Math.abs(probUp - 0.5) * 200))

  const chartData = React.useMemo(
    () => history.map((v, i) => ({ i, v: Number((v * 100).toFixed(2)) })),
    [history],
  )

  return (
    <Panel
      title="Neural Network Forecast"
      subtitle="online-trained LSTM-style"
      icon={<Brain className="h-4 w-4" />}
      actions={
        <span className="flex items-center gap-1 text-[10px] text-zinc-500">
          <Zap className="h-3 w-3 text-amber-400" />
          {trainedSteps} steps
        </span>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        <StatTile
          label="P(up)"
          value={
            <span className={bullish ? 'text-emerald-400' : 'text-rose-400'}>
              {fmtPct(probUp, 1)}
            </span>
          }
          hint={bullish ? 'bullish bias' : 'bearish bias'}
        />
        <StatTile
          label="E[return]"
          value={
            <span className={expectedReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
              {expectedReturn >= 0 ? '+' : ''}{fmtPctRaw(expectedReturn, 3)}
            </span>
          }
          hint="next bar"
        />
        <StatTile
          label="Confidence"
          value={<span className="text-zinc-200">{fmtPct(confidence, 1)}</span>}
          hint="model agreement"
        />
      </div>

      {/* big prob bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1">
          <span>BEAR</span>
          <span className={bullish ? 'text-emerald-400' : 'text-rose-400'}>
            {bullish ? 'LONG BIAS' : 'SHORT BIAS'}
          </span>
          <span>BULL</span>
        </div>
        <div className="relative h-3 w-full rounded-full bg-zinc-800 overflow-hidden">
          <div className="absolute top-0 bottom-0 left-1/2 w-px bg-zinc-600 z-10" />
          {bullish ? (
            <div
              className="absolute top-0 bottom-0 left-1/2 transition-all duration-500"
              style={{ width: `${barWidth / 2}%` }}
            >
              <div className="h-full bg-emerald-500/80" />
            </div>
          ) : (
            <div
              className="absolute top-0 bottom-0 transition-all duration-500"
              style={{ right: '50%', width: `${barWidth / 2}%` }}
            >
              <div className="h-full bg-rose-500/80" />
            </div>
          )}
        </div>
      </div>

      {/* rolling probability history sparkline */}
      <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/50 p-2">
        <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1">
          <span>P(up) history · last {chartData.length}</span>
          <span className="text-zinc-600">online predictions</span>
        </div>
        <div className="h-16 w-full">
          {chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 2, right: 4, bottom: 2, left: 4 }}>
                <YAxis domain={[0, 100]} hide />
                <ReferenceLine y={50} stroke="#52525b" strokeDasharray="2 2" />
                <Tooltip
                  contentStyle={{
                    background: '#18181b',
                    border: '1px solid #3f3f46',
                    borderRadius: 6,
                    fontSize: 11,
                  }}
                  labelStyle={{ color: '#a1a1aa' }}
                  formatter={(v: any) => [`${v}%`, 'P(up)']}
                  labelFormatter={() => ''}
                />
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke={bullish ? '#10b981' : '#f43f5e'}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="grid place-items-center h-full text-[10px] text-zinc-600">
              collecting predictions…
            </div>
          )}
        </div>
      </div>
    </Panel>
  )
}
