'use client'

import * as React from 'react'
import { Sliders, Save, Loader2 } from 'lucide-react'
import { useDashboard } from '@/lib/dashboard-store'
import { Panel } from './panel'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { RiskSettings } from '@/lib/types'

export function RiskSettings() {
  const risk = useDashboard((s) => s.risk)
  const setRisk = useDashboard((s) => s.setRisk)
  const [draft, setDraft] = React.useState<RiskSettings | null>(risk)
  const [saving, setSaving] = React.useState(false)
  const lastServerRef = React.useRef<string>('')

  React.useEffect(() => {
    if (!risk) return
    const sig = JSON.stringify(risk)
    if (sig !== lastServerRef.current) {
      lastServerRef.current = sig
      setDraft(risk)
    }
  }, [risk])

  if (!draft) {
    return (
      <Panel title="Risk Settings" subtitle="operator limits" icon={<Sliders className="h-4 w-4" />}>
        <div className="grid place-items-center h-24 text-xs text-zinc-500">Loading…</div>
      </Panel>
    )
  }

  function update<K extends keyof RiskSettings>(k: K, v: number | string) {
    setDraft({ ...(draft as RiskSettings), [k]: v })
  }

  async function save() {
    if (!draft) return
    setSaving(true)
    try {
      const res = await fetch('/api/risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const data = await res.json().catch(() => ({}))
      if (data?.maxRiskPerTrade !== undefined) {
        setRisk(data as RiskSettings)
        toast.success('Risk settings saved', {
          description: `${data.product} · lev ${data.leverage}x (${data.marginMode}) · max DD ${(data.maxDrawdown * 100).toFixed(0)}%`,
        })
      } else {
        toast.error('Save failed')
      }
    } catch (e: any) {
      toast.error('Save failed', { description: e?.message })
    } finally {
      setSaving(false)
    }
  }

  const fields: { key: keyof RiskSettings; label: string; step: number; min: number; max: number; suffix: string; pct: boolean }[] = [
    { key: 'maxRiskPerTrade', label: 'Max Risk / Trade', step: 0.005, min: 0.005, max: 0.1, suffix: '', pct: true },
    { key: 'maxTotalExposure', label: 'Max Total Exposure', step: 0.05, min: 0.1, max: 1, suffix: '', pct: true },
    { key: 'maxDrawdown', label: 'Max Drawdown', step: 0.01, min: 0.02, max: 0.5, suffix: '', pct: true },
    { key: 'leverageCap', label: 'Leverage Cap', step: 1, min: 1, max: 125, suffix: 'x', pct: false },
  ]

  return (
    <Panel
      title="Risk Settings"
      subtitle="operator limits + leverage"
      icon={<Sliders className="h-4 w-4" />}
      actions={
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          Save
        </button>
      }
    >
      {/* Product + margin mode + leverage row */}
      <div className="space-y-2 mb-3">
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1 block">Market</Label>
          <div className="flex gap-1 rounded-md border border-zinc-800 bg-zinc-950/60 p-1">
            {(['spot', 'futures'] as const).map((p) => (
              <button
                key={p}
                onClick={() => update('product', p)}
                className={cn(
                  'flex-1 rounded px-2 py-1 text-[11px] font-semibold capitalize transition-colors',
                  draft.product === p
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
                    : 'text-zinc-400 hover:text-zinc-200 border border-transparent',
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {draft.product === 'futures' && (
          <>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1 block">Margin Mode</Label>
              <div className="flex gap-1 rounded-md border border-zinc-800 bg-zinc-950/60 p-1">
                {(['isolated', 'cross'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => update('marginMode', m)}
                    className={cn(
                      'flex-1 rounded px-2 py-1 text-[11px] font-semibold capitalize transition-colors',
                      draft.marginMode === m
                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40'
                        : 'text-zinc-400 hover:text-zinc-200 border border-transparent',
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-[10px] uppercase tracking-wider text-zinc-500">Leverage</Label>
                <span className="text-[11px] font-mono tabular-nums text-emerald-300 font-bold">{draft.leverage}x</span>
              </div>
              <input
                type="range"
                min={1}
                max={Math.min(125, draft.leverageCap)}
                step={1}
                value={draft.leverage}
                onChange={(e) => update('leverage', Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
              <div className="flex justify-between text-[9px] text-zinc-600 mt-0.5">
                <span>1x</span>
                <span>{Math.min(125, draft.leverageCap)}x (cap)</span>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {fields.map((f) => {
          const val = draft[f.key] as number
          return (
            <div key={f.key} className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-zinc-500">{f.label}</Label>
              <div className="relative">
                <Input
                  type="number"
                  step={f.step}
                  min={f.min}
                  max={f.max}
                  value={val}
                  onChange={(e) => update(f.key, Number(e.target.value))}
                  className="bg-zinc-950/60 border-zinc-700 text-zinc-100 font-mono tabular-nums pr-8"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500">
                  {f.pct ? `${(val * 100).toFixed(f.key === 'leverageCap' ? 0 : 1)}%` : f.suffix}
                </span>
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-[10px] text-zinc-500 mt-3 leading-relaxed">
        {draft.product === 'futures'
          ? `Futures: ${draft.leverage}x ${draft.marginMode} margin. Leverage is set on Bitget before each order.`
          : 'Spot: no leverage. Buy/sell the actual asset.'}
        {' '}Changes apply on the next agent cycle.
      </p>
    </Panel>
  )
}
