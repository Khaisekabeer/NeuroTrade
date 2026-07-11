// Small formatting helpers used across the dashboard.

export function fmtUsd(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return (
    '$' +
    v.toLocaleString('en-US', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
  )
}

export function fmtNum(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return v.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function fmtPct(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return (v * 100).toFixed(digits) + '%'
}

export function fmtPctRaw(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return v.toFixed(digits) + '%'
}

export function fmtPrice(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  if (v >= 1000) return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (v >= 1) return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
  return v.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 })
}

export function fmtTime(ts: number | null | undefined): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('en-US', { hour12: false })
}

export function fmtClock(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour12: false })
}

export function timeAgo(ts: number | null | undefined): string {
  if (!ts) return '—'
  const diff = Math.max(0, Date.now() - ts)
  const s = Math.floor(diff / 1000)
  if (s < 5) return 'just now'
  if (s < 60) return s + 's ago'
  const m = Math.floor(s / 60)
  if (m < 60) return m + 'm ago'
  const h = Math.floor(m / 60)
  if (h < 24) return h + 'h ago'
  return Math.floor(h / 24) + 'd ago'
}

export function pnlColor(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return 'text-zinc-400'
  if (v > 0) return 'text-emerald-400'
  if (v < 0) return 'text-rose-400'
  return 'text-zinc-300'
}

export function signalColor(signal: string | undefined | null): string {
  switch (signal) {
    case 'LONG':
      return 'text-emerald-400'
    case 'SHORT':
      return 'text-rose-400'
    case 'FLAT':
      return 'text-amber-400'
    case 'HOLD':
      return 'text-zinc-300'
    default:
      return 'text-zinc-400'
  }
}

export function signalBg(signal: string | undefined | null): string {
  switch (signal) {
    case 'LONG':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
    case 'SHORT':
      return 'bg-rose-500/15 text-rose-300 border-rose-500/40'
    case 'FLAT':
      return 'bg-amber-500/15 text-amber-300 border-amber-500/40'
    case 'HOLD':
      return 'bg-zinc-500/15 text-zinc-300 border-zinc-500/40'
    default:
      return 'bg-zinc-700/40 text-zinc-400 border-zinc-700'
  }
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}
