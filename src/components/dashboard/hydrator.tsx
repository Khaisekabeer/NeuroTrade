'use client'

// DashboardHydrator — invisible client component that owns the socket.io
// connection to the market microservice (port 3003 via Caddy gateway) and
// the staggered REST polling loop. It writes everything into the zustand
// store. Render it once near the top of the page.

import * as React from 'react'
import { io, type Socket } from 'socket.io-client'
import { useDashboard, SYMBOLS } from '@/lib/dashboard-store'
import type { PortfolioSnapshot, MLPrediction, EngineStatus } from '@/lib/dashboard-store'
import type {
  Candle,
  OrchestratorDecision,
  AgentOutput,
  Trade,
  RiskSettings,
} from '@/lib/types'

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export function DashboardHydrator() {
  React.useEffect(() => {
    let socket: Socket | null = null
    let mounted = true

    // ---- WebSocket to market microservice (port 3003 via gateway) ----
    let pendingTicks: Record<string, { symbol: string; price: number; ts: number }> = {}
    let tickFlushTimer: ReturnType<typeof setTimeout> | null = null
    try {
      socket = io('/', {
        path: '/',
        transports: ['websocket'],
        query: { XTransformPort: '3003' },
        reconnection: true,
        reconnectionAttempts: Infinity,
        timeout: 4000,
      })
      socket.on('connect', () => {
        if (mounted) useDashboard.getState().setWsConnected(true)
      })
      socket.on('disconnect', () => {
        if (mounted) useDashboard.getState().setWsConnected(false)
      })
      socket.on('connect_error', () => {
        if (mounted) useDashboard.getState().setWsConnected(false)
      })
      socket.on('tick', (t: { symbol: string; price: number; ts: number }) => {
        if (!mounted) return
        // Batch ticks: coalesce rapid WS ticks into a single store update per
        // ~700ms to avoid high-frequency re-renders that can trigger React 19
        // "getSnapshot should be cached" warnings under concurrent rendering.
        pendingTicks[t.symbol] = t
        if (tickFlushTimer == null) {
          tickFlushTimer = setTimeout(() => {
            tickFlushTimer = null
            const batch = pendingTicks
            pendingTicks = {}
            for (const sym in batch) useDashboard.getState().applyTick(batch[sym])
          }, 700)
        }
      })
      socket.on('candle', (c: Candle) => {
        if (mounted) useDashboard.getState().applyCandle(c)
      })
      socket.on('history', (data: { symbol: string; candles: Candle[] }) => {
        if (mounted) useDashboard.getState().applyHistory(data)
      })
    } catch {
      // socket.io client may throw if transport unsupported; ignore — polling still works
    }

    // ---- REST polling (staggered) ----
    const fetchPortfolio = async () => {
      const p = await getJson<PortfolioSnapshot>('/api/portfolio')
      if (mounted && p) useDashboard.getState().setPortfolio(p)
    }
    const fetchTrades = async () => {
      const t = await getJson<Trade[]>('/api/trades?limit=50')
      if (mounted && t) useDashboard.getState().setTrades(t)
    }
    const fetchDecisions = async () => {
      const d = await getJson<OrchestratorDecision[]>('/api/decisions?limit=30')
      if (mounted && d) useDashboard.getState().setDecisions(d)
    }
    const fetchAgentsFor = async (symbol: string) => {
      const a = await getJson<AgentOutput[]>(`/api/agents?symbol=${encodeURIComponent(symbol)}&limit=20`)
      if (mounted && a) useDashboard.getState().setAgents(symbol, a)
    }
    const fetchMLFor = async (symbol: string) => {
      const m = await getJson<MLPrediction>(`/api/ml?symbol=${encodeURIComponent(symbol)}`)
      if (mounted && m) useDashboard.getState().setML(symbol, m)
    }
    const fetchRisk = async () => {
      const r = await getJson<RiskSettings>('/api/risk')
      if (mounted && r) useDashboard.getState().setRisk(r)
    }
    const fetchStatus = async () => {
      const s = await getJson<EngineStatus>('/api/status')
      if (mounted && s) useDashboard.getState().setStatus(s)
    }
    const fetchBitgetStatus = async () => {
      const s = await getJson<any>('/api/bitget?action=status')
      if (mounted && s) useDashboard.getState().setBitgetStatus(s)
    }
    // Poll /api/ticks as a REST fallback / supplement to the WS feed.
    // The backend keeps ticks fresh (live market service OR its own local
    // fallback generator), so this guarantees the dashboard always has prices
    // even if the browser WS can't reach the gateway.
    const fetchTicks = async () => {
      const t = await getJson<Array<{ symbol: string; price: number; ts: number; bid: number; ask: number; volume24h: number; change24h: number }>>('/api/ticks')
      if (mounted && t) {
        for (const tk of t) {
          useDashboard.getState().applyTick({
            symbol: tk.symbol,
            price: tk.price,
            ts: tk.ts,
            bid: tk.bid,
            ask: tk.ask,
            volume24h: tk.volume24h,
            change24h: tk.change24h,
          })
        }
      }
    }

    // initial fetch (stagger to avoid burst)
    fetchPortfolio()
    const t1 = setTimeout(() => fetchTrades(), 200)
    const t2 = setTimeout(() => fetchDecisions(), 400)
    const t3 = setTimeout(() => fetchRisk(), 600)
    const t4 = setTimeout(() => fetchStatus(), 800)
    const t5 = setTimeout(() => fetchBitgetStatus(), 1000)
    const t6 = setTimeout(() => fetchTicks(), 300)
    SYMBOLS.forEach((s, i) => {
      setTimeout(() => fetchAgentsFor(s), 1200 + i * 150)
      setTimeout(() => fetchMLFor(s), 1600 + i * 150)
    })

    // staggered intervals
    const ivPortfolio = setInterval(fetchPortfolio, 4000)
    const ivTrades = setInterval(fetchTrades, 5000)
    const ivDecisions = setInterval(fetchDecisions, 4000)
    const ivRisk = setInterval(fetchRisk, 8000)
    const ivStatus = setInterval(fetchStatus, 4000)
    const ivBitget = setInterval(fetchBitgetStatus, 15000)
    const ivTicks = setInterval(fetchTicks, 2500)
    // poll agents + ML for ALL symbols so switching tabs is instant
    const ivAgents = setInterval(() => {
      SYMBOLS.forEach((s) => fetchAgentsFor(s))
    }, 5000)
    const ivML = setInterval(() => {
      SYMBOLS.forEach((s) => fetchMLFor(s))
    }, 6000)

    return () => {
      mounted = false
      if (tickFlushTimer) clearTimeout(tickFlushTimer)
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)
      clearTimeout(t5)
      clearTimeout(t6)
      clearInterval(ivPortfolio)
      clearInterval(ivTrades)
      clearInterval(ivDecisions)
      clearInterval(ivRisk)
      clearInterval(ivStatus)
      clearInterval(ivBitget)
      clearInterval(ivTicks)
      clearInterval(ivAgents)
      clearInterval(ivML)
      if (socket) {
        socket.removeAllListeners()
        socket.disconnect()
      }
    }
  }, [])

  return null
}
