'use client'

import * as React from 'react'
import { Plus, X, Loader2, Search, ChevronDown } from 'lucide-react'
import { Panel } from './panel'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface SymbolMeta {
  symbol: string
  name: string
  base: string
  price: number
}

interface BitgetSymbol {
  symbol: string    // "BTC/USDT"
  base: string      // "BTC"
  name: string
  price: number
  product: string
  futures?: boolean
}

export function ManageTickers() {
  const [symbols, setSymbols] = React.useState<SymbolMeta[]>([])
  const [busy, setBusy] = React.useState(false)
  const [loading, setLoading] = React.useState(true)

  // Search dropdown state
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [searchResults, setSearchResults] = React.useState<BitgetSymbol[]>([])
  const [searching, setSearching] = React.useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

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
    const iv = setInterval(fetchSymbols, 5000)
    return () => clearInterval(iv)
  }, [])

  // Search Bitget symbols with debounce
  React.useEffect(() => {
    if (!searchOpen) return
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/bitget-symbols?q=${encodeURIComponent(searchQuery)}`, { cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        if (data?.ok) setSearchResults(data.symbols || [])
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, searchOpen])

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function addSymbol(sym: string) {
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
        setSearchOpen(false)
        setSearchQuery('')
        fetchSymbols()
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
      } else {
        toast.error(`Failed to remove ${symbol}`, { description: data?.error || 'Unknown error' })
      }
    } catch (e: any) {
      toast.error('Remove failed', { description: e?.message })
    } finally {
      setBusy(false)
    }
  }

  const addedSet = new Set(symbols.map(s => s.symbol))

  return (
    <Panel
      title="Manage Tickers"
      subtitle={`${symbols.length} symbols`}
      icon={<Search className="h-4 w-4" />}
    >
      <div className="space-y-3">
        {/* Searchable dropdown to add tickers */}
        <div className="relative" ref={dropdownRef}>
          <div
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-950/60 px-2.5 py-2 cursor-text hover:border-zinc-600"
          >
            <Search className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true) }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search Bitget symbols (e.g. BTC, ETH, AVAX...)"
              className="flex-1 bg-transparent text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
            />
            <ChevronDown className="h-3 w-3 text-zinc-500 shrink-0" />
          </div>

          {/* Dropdown results */}
          {searchOpen && (
            <div className="absolute z-50 mt-1 w-full max-h-72 overflow-y-auto rounded-md border border-zinc-700 bg-zinc-900 shadow-xl custom-scroll">
              {searching ? (
                <div className="px-3 py-4 text-center text-[11px] text-zinc-500">
                  <Loader2 className="h-3 w-3 animate-spin inline mr-1" /> Searching...
                </div>
              ) : searchResults.length === 0 ? (
                <div className="px-3 py-4 text-center text-[11px] text-zinc-500">
                  No symbols found. Try a different search.
                </div>
              ) : (
                searchResults.map((s) => {
                  const isAdded = addedSet.has(s.symbol)
                  return (
                    <button
                      key={s.symbol}
                      onClick={() => !isAdded && !busy && addSymbol(s.symbol)}
                      disabled={isAdded || busy}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2 text-left text-[11px] border-b border-zinc-800 last:border-0 transition-colors',
                        isAdded ? 'opacity-40 cursor-not-allowed' : 'hover:bg-zinc-800'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-200">{s.base}</span>
                        <span className="text-zinc-500">/USDT</span>
                        {s.futures && (
                          <span className="text-[8px] px-1 rounded bg-amber-500/15 text-amber-300 font-bold">FUT</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono tabular-nums text-zinc-400">
                          ${s.price > 1 ? s.price.toFixed(2) : s.price.toFixed(6)}
                        </span>
                        {isAdded ? (
                          <span className="text-[9px] text-emerald-400 font-bold">ADDED</span>
                        ) : (
                          <Plus className="h-3 w-3 text-emerald-400" />
                        )}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          )}
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
            <div className="px-2 py-4 text-center text-[11px] text-zinc-500">
              No tickers added. Search above to add symbols.
            </div>
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
          {symbols.length === 0
            ? 'No tickers loaded. The bot will NOT trade until you add at least one symbol.'
            : 'Only the tickers above are traded. Adding fetches the live price from Bitget. Removing closes any open position.'}
        </p>
      </div>
    </Panel>
  )
}
