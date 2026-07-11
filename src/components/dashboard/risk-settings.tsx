'use client'

import * as React from 'react'
import { Sliders, Save, Loader2 } from 'lucide-react'
import { useDashboard } from '@/lib/dashboard-store'
import { Panel } from './panel'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import type { RiskSettings } from '@/lib/types'

export function RiskSettings() {
  const risk = useDashboard((s) => s.risk)
  const setRisk = useDashboard((s) => s.setRisk)
  const [draft, setDraft] = React.useState<RiskSettings | null>(risk)
  const [saving, setSaving] = React.useState(false)
  const lastServerRef = React.useRef<string>('')

  // Sync the local draft from the server only when the server snapshot
  // actually changes (so we don't clobber the operator's in-progress edits).
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

  function update<K extends keyof RiskSettings>(k: K, v: number) {
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
          description: `max risk ${(data.maxRiskPerTrade * 100).toFixed(1)}% · max DD ${(data.maxDrawdown * 100).toFixed(0)}% · lev ${data.leverageCap}x`,
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
    { key: 'leverageCap', label: 'Leverage Cap', step: 1, min: 1, max: 20, suffix: 'x', pct: false },
  ]

  return (
    <Panel
      title="Risk Settings"
      subtitle="operator limits"
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
      <div className="grid grid-cols-2 gap-3">
        {fields.map((f) => {
          const val = draft[f.key]
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
        Changes are persisted to the database and respected by the RISK agent on the next cycle.
      </p>
    </Panel>
  )
}
