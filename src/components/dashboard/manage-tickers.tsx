'use client'

import * as React from 'react'
import { Plus, X, Loader2, Search } from 'lucide-react'
import { Panel } from './panel'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface SymbolMeta {
  symbol: string
  name: string
  base: string
  price: number
}

export function ManageTickers() {
  const [symbols, setSymbols] = React.useState<SymbolMeta[]>([])
  const [input, setInput] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [loading, setLoading] = React.useState(true)

  async function fetchSymbols() {
    try {
      const res = await fetch('/api/symbols', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (data?.symbols) setSymbols(data.symbols)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    fetchSymbols()
    const iv = setInterval(fetchSymbols, 10000)
    return () => clearInterval(iv)
  }, [])

  async function addSymbol() {
    const sym = input.trim().toUpperCase()
    if (!sym) return
    if (!sym.includes('/')) {
      toast.error('Format must be like AVAX/USDT')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/symbols', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', symbol: sym }),
      })
      const data = await res.json().catch(() => ({}))
      if (data?.ok) {
        toast.success(`Added ${sym}`, { description: data.message })
        setInput('')
        fetchSymbols()
        // reload page after a short delay so the new tab appears
        setTimeout(() => location.reload(), 1000)
      } else {
        toast.error(`Failed to add ${sym}`, { description: data?.error || 'Unknown error' })
      }
    } catch (e: any) {
      toast.error('Add failed', { description: e?.message })
    } finally {
      setBusy(false)
    }
  }

  async function removeSymbol(symbol: string) {
    setBusy(true)
    try {
      const res = await fetch('/api/symbols', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', symbol }),
      })
      const data = await res.json().catch(() => ({}))
      if (data?.ok) {
        toast.success(`Removed ${symbol}`)
        fetchSymbols()
        setTimeout(() => location.reload(), 1000)
      } else {
        toast.error(`Failed to remove ${symbol}`, { description: data?.error })
      }
    } catch (e: any) {
      toast.error('Remove failed', { description: e?.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel
      title="Manage Tickers"
      subtitle={`${symbols.length} symbols · add/remove`}
      icon={<Search className="h-4 w-4" />}
    >
      <div className="space-y-3">
        {/* Add new ticker */}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addSymbol()}
            placeholder="e.g. AVAX/USDT"
            className="flex-1 rounded-md border border-zinc-700 bg-zinc-950/60 px-2 py-1.5 text-xs text-zinc-100 font-mono placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50"
          />
          <button
            onClick={addSymbol}
            disabled={busy || !input.trim()}
            className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50 min-h-[36px]"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            Add
          </button>
        </div>

        {/* Current tickers list */}
        <div className="rounded-md border border-zinc-800 bg-zinc-950/60 overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-2 py-1.5 text-[9px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
            <span>Symbol</span>
            <span className="text-right">Price</span>
            <span></span>
          </div>
          {loading ? (
            <div className="px-2 py-3 text-center text-[11px] text-zinc-500">
              <Loader2 className="h-3 w-3 animate-spin inline mr-1" /> Loading…
            </div>
          ) : symbols.length === 0 ? (
            <div className="px-2 py-3 text-center text-[11px] text-zinc-500">No symbols</div>
          ) : (
            symbols.map((s) => (
              <div key={s.symbol} className="grid grid-cols-[1fr_auto_auto] gap-2 px-2 py-1.5 text-[11px] border-b border-zinc-900 last:border-0 items-center">
                <span className="text-zinc-300 font-medium">{s.symbol}</span>
                <span className="text-right font-mono tabular-nums text-emerald-300">
                  ${s.price > 1 ? s.price.toFixed(2) : s.price.toFixed(6)}
                </span>
                <button
                  onClick={() => removeSymbol(s.symbol)}
                  disabled={busy}
                  className="text-rose-400 hover:text-rose-300 disabled:opacity-30 p-0.5"
                  title={`Remove ${s.symbol}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))
          )}
        </div>

        <p className="text-[10px] text-zinc-500 leading-relaxed">
          Adding a ticker fetches its live price from Bitget and starts trading it.
          Removing closes any open position for that symbol.
          The page reloads after add/remove so the new tab appears.
        </p>
      </div>
    </Panel>
  )
}
