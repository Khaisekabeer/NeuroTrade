'use client'

import * as React from 'react'
import { Activity, RefreshCw, Loader2, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { Panel, LiveDot } from './panel'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface ApiLogEntry {
  ts: number
  method: string
  endpoint: string
  product: string
  kind: string
  request: any
  response: any
  ok: boolean
  durationMs: number
}

interface DebugData {
  entries: ApiLogEntry[]
  total: number
  bitgetConfigured: boolean
  bitgetDemo: boolean
}

function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s
}

export function ApiMonitor() {
  const [data, setData] = React.useState<DebugData | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [expanded, setExpanded] = React.useState<Set<number>>(new Set())

  async function fetchLog() {
    setLoading(true)
    try {
      const res = await fetch('/api/debug', { cache: 'no-store' })
      const d = await res.json().catch(() => ({}))
      setData(d)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  async function clearLog() {
    try {
      await fetch('/api/debug', { method: 'DELETE' })
      setData(null)
      toast.success('API log cleared')
    } catch {
      toast.error('Clear failed')
    }
  }

  React.useEffect(() => {
    fetchLog()
    const iv = setInterval(fetchLog, 3000)
    return () => clearInterval(iv)
  }, [])

  function toggle(i: number) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  const entries = data?.entries ?? []

  return (
    <Panel
      title="API Monitor"
      subtitle={`${entries.length} Bitget calls · ${data?.bitgetConfigured ? (data?.bitgetDemo ? 'demo' : 'LIVE') : 'no keys'}`}
      icon={<Activity className="h-4 w-4" />}
      actions={
        <div className="flex items-center gap-1">
          <button
            onClick={fetchLog}
            disabled={loading}
            className="text-[10px] text-emerald-400 hover:text-emerald-300 disabled:opacity-40 p-1"
            title="Refresh"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          </button>
          <button
            onClick={clearLog}
            className="text-[10px] text-rose-400 hover:text-rose-300 p-1"
            title="Clear log"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      }
      bodyClassName="p-0"
    >
      <div className="max-h-96 overflow-y-auto custom-scroll">
        {entries.length === 0 ? (
          <div className="px-3 py-6 text-center text-[11px] text-zinc-500">
            No Bitget API calls yet. Click "Fetch Live Bitget Tickers" or "Refresh" in the Bitget panel to see calls here.
          </div>
        ) : (
          <div className="divide-y divide-zinc-900">
            {entries.map((e, i) => {
              const isOpen = expanded.has(i)
              return (
                <div key={i} className="px-2 py-1.5 hover:bg-zinc-900/40">
                  <button
                    onClick={() => toggle(i)}
                    className="w-full flex items-center gap-2 text-left"
                  >
                    {isOpen ? <ChevronDown className="h-3 w-3 text-zinc-500 shrink-0" /> : <ChevronRight className="h-3 w-3 text-zinc-500 shrink-0" />}
                    <span className={cn(
                      'text-[9px] font-bold px-1 rounded shrink-0',
                      e.method === 'GET' ? 'bg-sky-500/15 text-sky-300' : 'bg-amber-500/15 text-amber-300'
                    )}>
                      {e.method}
                    </span>
                    <span className={cn(
                      'text-[9px] font-bold px-1 rounded shrink-0',
                      e.product === 'futures' ? 'bg-purple-500/15 text-purple-300' : 'bg-zinc-700 text-zinc-300'
                    )}>
                      {e.product}
                    </span>
                    <span className={cn(
                      'text-[9px] font-bold shrink-0',
                      e.kind === 'signed' ? 'text-emerald-400' : 'text-zinc-500'
                    )}>
                      {e.kind}
                    </span>
                    <span className="text-[10px] text-zinc-300 font-mono truncate flex-1">
                      {truncate(e.endpoint.replace('/api/v2/', ''), 40)}
                    </span>
                    <span className={cn(
                      'text-[9px] font-bold shrink-0',
                      e.ok ? 'text-emerald-400' : 'text-rose-400'
                    )}>
                      {e.ok ? 'OK' : 'ERR'}
                    </span>
                    <span className="text-[9px] text-zinc-600 shrink-0 tabular-nums">{e.durationMs}ms</span>
                    <span className="text-[9px] text-zinc-600 shrink-0">{timeAgo(e.ts)}</span>
                  </button>
                  {isOpen && (
                    <div className="mt-1.5 ml-5 space-y-1.5 text-[10px]">
                      {e.request && (
                        <div>
                          <div className="text-zinc-500 uppercase tracking-wider text-[9px] mb-0.5">Request body:</div>
                          <pre className="bg-zinc-950 border border-zinc-800 rounded p-1.5 text-zinc-300 overflow-x-auto max-h-32">
                            {JSON.stringify(e.request, null, 2)}
                          </pre>
                        </div>
                      )}
                      <div>
                        <div className="text-zinc-500 uppercase tracking-wider text-[9px] mb-0.5">Response:</div>
                        <pre className={cn(
                          'bg-zinc-950 border rounded p-1.5 overflow-x-auto max-h-40',
                          e.ok ? 'border-zinc-800 text-zinc-300' : 'border-rose-500/30 text-rose-300'
                        )}>
                          {JSON.stringify(e.response, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Panel>
  )
}
