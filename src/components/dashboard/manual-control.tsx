'use client'

import * as React from 'react'
import { Gamepad2, TrendingUp, TrendingDown, X, RotateCcw, Loader2, Power, Play, Square } from 'lucide-react'
import { useDashboard } from '@/lib/dashboard-store'
import { Panel } from './panel'
import { toast } from 'sonner'
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
import { cn } from '@/lib/utils'

export function ManualControl() {
  const activeSymbol = useDashboard((s) => s.activeSymbol)
  const status = useDashboard((s) => s.status)
  const setStatus = useDashboard((s) => s.setStatus)
  const [busy, setBusy] = React.useState<string | null>(null)
  const [engineBusy, setEngineBusy] = React.useState(false)

  const engineRunning = status?.engine?.running ?? false

  async function toggleEngine() {
    setEngineBusy(true)
    const action = engineRunning ? 'stop' : 'start'
    try {
      const res = await fetch('/api/engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json().catch(() => ({}))
      // refresh status immediately
      const sres = await fetch('/api/status')
      const sdata = await sres.json().catch(() => ({}))
      setStatus(sdata)
      if (action === 'stop') {
        toast.success('Bot paused', {
          description: 'No new trades will be taken. Open positions are still monitored for SL/TP.',
        })
      } else {
        toast.success('Bot resumed', { description: 'Agent cycle restarted — scanning markets.' })
      }
    } catch (e: any) {
      toast.error('Engine control failed', { description: e?.message })
    } finally {
      setEngineBusy(false)
    }
  }

  async function act(action: 'open' | 'close', side?: 'LONG' | 'SHORT') {
    const key = side ? `${action}-${side}` : action
    setBusy(key)
    try {
      const body: any = { action, symbol: activeSymbol }
      if (side) body.side = side
      const res = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (action === 'open') {
        if (data?.ok && data?.trade) {
          toast.success(`Opened ${side} ${activeSymbol}`, {
            description: `size ${data.trade.size.toFixed(4)} @ ${data.trade.entryPrice.toFixed(2)}`,
          })
        } else {
          toast.error(`Open ${side} failed`, { description: data?.error || 'Unknown error — check API Monitor panel' })
        }
      } else {
        if (data?.ok) {
          toast.success(`Closed ${activeSymbol}`, {
            description: data.trade ? `P&L ${data.trade.pnl >= 0 ? '+' : ''}$${data.trade.pnl.toFixed(2)}` : 'No open position',
          })
        } else {
          toast.error(`Close failed`, { description: data?.error || 'No open position to close' })
        }
      }
    } catch (e: any) {
      toast.error('Action failed', { description: e?.message })
    } finally {
      setBusy(null)
    }
  }

  async function closeAll() {
    setBusy('closeAll')
    try {
      const res = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'closeAll' }),
      })
      const data = await res.json().catch(() => ({}))
      if (data?.ok) {
        toast.success(`Closed ${data.closed} position(s)`, {
          description: data.errors?.length ? `Errors: ${data.errors.join('; ')}` : 'All positions closed',
        })
      } else {
        toast.error('Close all failed', { description: data?.error })
      }
    } catch (e: any) {
      toast.error('Close all failed', { description: e?.message })
    } finally {
      setBusy(null)
    }
  }

  async function reset() {
    setBusy('reset')
    try {
      const res = await fetch('/api/reset', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (data?.ok) {
        toast.success('Paper account reset', { description: 'Equity restored to $100,000' })
      } else {
        toast.error('Reset failed')
      }
    } catch (e: any) {
      toast.error('Reset failed', { description: e?.message })
    } finally {
      setBusy(null)
    }
  }

  const btn =
    'inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-all disabled:opacity-50 min-h-[40px]'

  return (
    <Panel
      title="Manual Control"
      subtitle={`${activeSymbol} · operator override`}
      icon={<Gamepad2 className="h-4 w-4" />}
    >
      {/* === BOT ON/OFF KILL SWITCH === */}
      <div
        className={cn(
          'mb-3 rounded-lg border p-3 flex items-center justify-between gap-3',
          engineRunning
            ? 'border-emerald-500/40 bg-emerald-500/5'
            : 'border-rose-500/40 bg-rose-500/5',
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Power className={cn('h-4 w-4 shrink-0', engineRunning ? 'text-emerald-400' : 'text-rose-400')} />
          <div className="min-w-0">
            <div className="text-xs font-bold text-zinc-100">
              Bot {engineRunning ? 'Running' : 'Paused'}
            </div>
            <div className="text-[10px] text-zinc-500 leading-tight">
              {engineRunning
                ? 'Agents scanning · SL/TP active'
                : 'No new trades · SL/TP still monitoring'}
            </div>
          </div>
        </div>
        <button
          onClick={toggleEngine}
          disabled={engineBusy}
          className={cn(
            'inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-bold transition-all min-h-[40px] shrink-0',
            engineRunning
              ? 'bg-rose-600 hover:bg-rose-700 text-white'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white',
          )}
        >
          {engineBusy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : engineRunning ? (
            <Square className="h-3.5 w-3.5" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          {engineRunning ? 'Stop Bot' : 'Start Bot'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => act('open', 'LONG')}
          disabled={!!busy}
          className={cn(btn, 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20')}
        >
          {busy === 'open-LONG' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TrendingUp className="h-3.5 w-3.5" />}
          Open LONG
        </button>
        <button
          onClick={() => act('open', 'SHORT')}
          disabled={!!busy}
          className={cn(btn, 'border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20')}
        >
          {busy === 'open-SHORT' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TrendingDown className="h-3.5 w-3.5" />}
          Open SHORT
        </button>
        <button
          onClick={() => act('close')}
          disabled={!!busy}
          className={cn(btn, 'border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20')}
        >
          {busy === 'close' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
          Close {activeSymbol}
        </button>
        <button
          onClick={closeAll}
          disabled={!!busy}
          className={cn(btn, 'border border-rose-600/60 bg-rose-600/20 text-rose-200 hover:bg-rose-600/30 font-bold')}
        >
          {busy === 'closeAll' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
          Close ALL
        </button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              disabled={!!busy}
              className={cn(btn, 'col-span-2 border border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700/60')}
            >
              {busy === 'reset' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              Reset Paper Account
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-zinc-900 border-zinc-700">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-zinc-100">Reset paper account?</AlertDialogTitle>
              <AlertDialogDescription className="text-zinc-400">
                This closes all positions, clears trade history + decisions, and restores equity to $100,000. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={reset}
                className="bg-rose-600 hover:bg-rose-700 text-white border-rose-600"
              >
                Reset
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <p className="text-[10px] text-zinc-500 mt-2 leading-relaxed">
        Manual trades use 2% risk sizing with a 1% stop. They bypass agent consensus but still respect the leverage cap.
      </p>
    </Panel>
  )
}
