'use client'

import * as React from 'react'
import { Activity, Cpu, Wifi, Radio, Gauge, TrendingUp, TrendingDown, Layers, FlaskConical, Zap, AlertTriangle } from 'lucide-react'
import { useDashboard } from '@/lib/dashboard-store'
import { LiveDot } from './panel'
import { fmtUsd, fmtPct, pnlColor } from './format'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

function Clock() {
  const [now, setNow] = React.useState<Date>(new Date())
  React.useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(iv)
  }, [])
  return (
    <span className="tabular-nums text-zinc-300 font-mono text-sm">
      {now.toLocaleTimeString('en-US', { hour12: false })}
    </span>
  )
}

function Pill({
  label,
  live,
  color = 'emerald',
  detail,
  icon,
}: {
  label: string
  live: boolean
  color?: 'emerald' | 'rose' | 'amber' | 'zinc' | 'sky'
  detail?: string
  icon?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/80 px-2 py-1">
      {icon}
      <span className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>
      <span className="text-[11px] font-medium text-zinc-300">{detail}</span>
      <LiveDot color={color} pulse={live} />
    </div>
  )
}

function ModeToggle() {
  const status = useDashboard((s) => s.status)
  const setStatus = useDashboard((s) => s.setStatus)
  const [busy, setBusy] = React.useState(false)

  const mode = status?.mode ?? 'paper'
  const liveConfigured = status?.liveConfigured ?? false
  const isLive = mode === 'live'

  async function switchTo(target: 'paper' | 'live') {
    if (target === mode) return
    setBusy(true)
    try {
      const res = await fetch('/api/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: target }),
      })
      const data = await res.json().catch(() => ({}))
      if (data?.ok) {
        // refresh status
        const sres = await fetch('/api/status')
        const sdata = await sres.json().catch(() => ({}))
        setStatus(sdata)
        toast.success(target === 'live' ? 'Switched to LIVE trading' : 'Switched to PAPER trading', {
          description: target === 'live'
            ? 'Real Bitget prices + real signed orders. Trade carefully.'
            : 'Simulated prices + in-memory execution. No real funds at risk.',
        })
      } else {
        toast.error('Cannot switch mode', { description: data?.error || 'Unknown error' })
      }
    } catch (e: any) {
      toast.error('Mode switch failed', { description: e?.message })
    } finally {
      setBusy(false)
    }
  }

  if (isLive) {
    // In live mode — show a red "LIVE" pill + a quick switch-back button
    return (
      <button
        onClick={() => switchTo('paper')}
        disabled={busy}
        title="Click to switch back to paper trading"
        className="flex items-center gap-1.5 rounded-md border border-rose-500/60 bg-rose-500/15 px-2 py-1 hover:bg-rose-500/25 transition-colors"
      >
        <Zap className="h-3 w-3 text-rose-400" />
        <span className="text-[10px] uppercase tracking-wider text-rose-300">LIVE</span>
        <LiveDot color="rose" pulse />
      </button>
    )
  }

  // Paper mode — show amber pill; clicking tries to go live (with confirm dialog if keys configured)
  if (!liveConfigured) {
    return (
      <div
        title="Set BITGET_API_KEY / SECRET / PASSPHRASE in .env to enable live trading"
        className="flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 opacity-80"
      >
        <FlaskConical className="h-3 w-3 text-amber-400" />
        <span className="text-[10px] uppercase tracking-wider text-amber-300">PAPER</span>
      </div>
    )
  }

  // Paper mode but live is configured — show clickable toggle with confirm dialog
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          disabled={busy}
          title="Click to switch to LIVE trading with real Bitget orders"
          className="flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 hover:bg-amber-500/20 transition-colors"
        >
          <FlaskConical className="h-3 w-3 text-amber-400" />
          <span className="text-[10px] uppercase tracking-wider text-amber-300">PAPER</span>
          <span className="text-[9px] text-zinc-500 hidden sm:inline">→ LIVE</span>
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-zinc-900 border-rose-700">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-rose-200 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Switch to LIVE trading?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-zinc-400">
            This will:
            <br />• Switch the price feed to <span className="text-zinc-200">real Bitget market data</span>
            <br />• Route new orders through <span className="text-zinc-200">real signed Bitget API calls</span> (real money)
            <br />• Place <span className="text-zinc-200">exchange-side stop-loss & take-profit orders</span> on Bitget
            <br /><br />
            <span className="text-rose-300 font-medium">Real funds will be at risk.</span> Start with a small amount. Make sure your API keys have correct permissions and IP whitelist. You can switch back to paper anytime.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700">Stay on Paper</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => switchTo('live')}
            className="bg-rose-600 hover:bg-rose-700 text-white border-rose-600"
          >
            {busy ? 'Switching…' : 'Go LIVE'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function Header() {
  const portfolio = useDashboard((s) => s.portfolio)
  const status = useDashboard((s) => s.status)
  const wsConnected = useDashboard((s) => s.wsConnected)
  const bitgetStatus = useDashboard((s) => s.bitgetStatus)

  const equity = portfolio?.equity ?? 100000
  const dayPnl = portfolio?.dayPnl ?? 0
  const dayPnlPct = portfolio?.dayPnlPct ?? 0
  const exposure = portfolio?.exposure ?? 0
  const drawdown = portfolio?.drawdown ?? 0
  const cycle = portfolio?.cycle ?? 0
  const engineRunning = status?.engine?.running ?? false
  const connected = portfolio?.connected ?? false

  const dayPnlPos = dayPnl >= 0

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/80">
      <div className="mx-auto max-w-[1800px] px-3 sm:px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Logo + title */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="relative grid place-items-center h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-500/30 to-zinc-800 border border-emerald-500/40">
            <Activity className="h-4 w-4 text-emerald-400" />
            <span className="absolute -bottom-0.5 -right-0.5">
              <LiveDot color="emerald" />
            </span>
          </div>
          <div className="leading-tight">
            <div className="text-[15px] font-bold tracking-tight text-zinc-50">
              NEURO <span className="text-emerald-400">TRADE</span>
            </div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 hidden sm:block">
              Multi-Agent Crypto Trading Terminal
            </div>
          </div>
        </div>

        {/* Equity cluster */}
        <div className="flex items-center gap-4 sm:gap-6 ml-1 sm:ml-3 flex-1 min-w-0">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">Equity</div>
            <div className="text-xl sm:text-2xl font-bold tabular-nums text-zinc-50 leading-tight">
              {fmtUsd(equity)}
            </div>
          </div>
          <div className="hidden md:block min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">Day P&amp;L</div>
            <div className={`text-base font-semibold tabular-nums leading-tight flex items-center gap-1 ${pnlColor(dayPnl)}`}>
              {dayPnlPos ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {fmtUsd(dayPnl)}
              <span className="text-xs">({dayPnlPos ? '+' : ''}{fmtPct(dayPnlPct)})</span>
            </div>
          </div>
          <div className="hidden lg:block min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">Exposure</div>
            <div className="text-base font-semibold tabular-nums text-amber-300 leading-tight">
              {fmtPct(exposure)}
            </div>
          </div>
          <div className="hidden lg:block min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">Drawdown</div>
            <div className={`text-base font-semibold tabular-nums leading-tight ${drawdown > 0.1 ? 'text-rose-400' : 'text-zinc-300'}`}>
              {fmtPct(drawdown)}
            </div>
          </div>
        </div>

        {/* Right: status pills + clock */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap justify-end">
          <ModeToggle />
          <Pill
            label="Bitget"
            live={!!bitgetStatus?.connected}
            color={bitgetStatus?.connected ? 'emerald' : 'amber'}
            detail={bitgetStatus?.connected ? 'AUTH' : 'PUBLIC'}
            icon={<Radio className="h-3 w-3 text-zinc-500" />}
          />
          <Pill
            label="TV"
            live
            color="sky"
            detail="LIVE"
            icon={<Layers className="h-3 w-3 text-zinc-500" />}
          />
          <Pill
            label="Engine"
            live={engineRunning}
            color={engineRunning ? 'emerald' : 'rose'}
            detail={engineRunning ? 'RUN' : 'IDLE'}
            icon={<Cpu className="h-3 w-3 text-zinc-500" />}
          />
          <div className="hidden sm:flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/80 px-2 py-1">
            <Gauge className="h-3 w-3 text-zinc-500" />
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">Cycle</span>
            <span className="text-[11px] font-mono text-zinc-200 tabular-nums">{cycle}</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/80 px-2 py-1">
            <Wifi className={`h-3 w-3 ${wsConnected ? 'text-emerald-400' : connected ? 'text-amber-400' : 'text-rose-400'}`} />
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">WS</span>
            <span className={`text-[11px] font-medium ${wsConnected ? 'text-emerald-300' : 'text-amber-300'}`}>
              {wsConnected ? 'LIVE' : connected ? 'FALLBACK' : 'OFF'}
            </span>
          </div>
          <div className="rounded-md border border-zinc-800 bg-zinc-900/80 px-2 py-1">
            <Clock />
          </div>
        </div>
      </div>
    </header>
  )
}
