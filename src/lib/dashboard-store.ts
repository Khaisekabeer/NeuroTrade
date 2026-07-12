// Central zustand store for the multi-agent trading dashboard.
// Holds: active symbol, live ticks, candle buffers, portfolio, decisions,
// agent outputs, ML predictions (with rolling history), risk, engine status,
// Bitget connection state. A single DashboardHydrator component (see
// components/dashboard/hydrator.tsx) is responsible for feeding this store
// via socket.io + REST polling.

import { create } from 'zustand'
import type {
  Candle,
  Tick,
  Position,
  Trade,
  OrchestratorDecision,
  AgentOutput,
  AgentName,
  RiskSettings,
} from '@/lib/types'

export interface PortfolioSnapshot {
  cash: number
  equity: number
  exposure: number
  openPnl: number
  realizedPnl: number
  dayPnl: number
  dayPnlPct: number
  winRate: number
  positions: Position[]
  startedAt: number
  peakEquity: number
  drawdown: number
  cycle: number
  connected: boolean
}

export interface MLPrediction {
  probUp: number
  expectedReturn: number
  confidence: number
  trainedSteps: number
  features: Record<string, number> | null
}

export interface EngineStatus {
  engine: { running: boolean; predictors: number; sentimentCache: number }
  connected: boolean
  cycle: number
  equity: number
  startedAt: number
  mode?: 'paper' | 'live'
  liveConfigured?: boolean
}

export interface BitgetStatus {
  connected: boolean
  host: string
  publicApi: boolean
  authenticatedApi: boolean
  message: string
}

export interface BitgetTicker {
  symbol: string
  lastPr: string
  open24h: string
  high24h: string
  low24h: string
  change24h: string
  quoteVolume24h: string
}

export const SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT', 'DOGE/USDT', 'ADA/USDT'] as const
export type SymbolCode = (typeof SYMBOLS)[number]

export const SYMBOL_TO_TV: Record<string, string> = {
  'BTC/USDT': 'BITGET:BTCUSDT',
  'ETH/USDT': 'BITGET:ETHUSDT',
  'SOL/USDT': 'BITGET:SOLUSDT',
  'XRP/USDT': 'BITGET:XRPUSDT',
  'DOGE/USDT': 'BITGET:DOGEUSDT',
  'ADA/USDT': 'BITGET:ADAUSDT',
}

export const SYMBOL_TO_BITGET: Record<string, string> = {
  'BTC/USDT': 'BTCUSDT',
  'ETH/USDT': 'ETHUSDT',
  'SOL/USDT': 'SOLUSDT',
  'XRP/USDT': 'XRPUSDT',
  'DOGE/USDT': 'DOGEUSDT',
  'ADA/USDT': 'ADAUSDT',
}

export const AGENT_ORDER: AgentName[] = ['SENTIMENT', 'TECHNICAL', 'ML', 'RISK', 'ORCHESTRATOR']

interface DashboardState {
  // selection
  activeSymbol: string
  setActiveSymbol: (s: string) => void

  // live market data
  ticks: Record<string, Tick>
  candles: Record<string, Candle[]>
  wsConnected: boolean
  setWsConnected: (v: boolean) => void
  applyTick: (t: { symbol: string; price: number; ts: number; bid?: number; ask?: number; volume24h?: number; change24h?: number }) => void
  applyCandle: (c: Candle) => void
  applyHistory: (data: { symbol: string; candles: Candle[] }) => void

  // portfolio + trades
  portfolio: PortfolioSnapshot | null
  setPortfolio: (p: PortfolioSnapshot) => void
  trades: Trade[]
  setTrades: (t: Trade[]) => void

  // decisions + agents
  decisions: OrchestratorDecision[]
  setDecisions: (d: OrchestratorDecision[]) => void
  agentsBySymbol: Record<string, AgentOutput[]>
  setAgents: (symbol: string, agents: AgentOutput[]) => void

  // ML
  mlBySymbol: Record<string, MLPrediction>
  mlHistory: Record<string, number[]>
  setML: (symbol: string, m: MLPrediction) => void

  // risk + engine
  risk: RiskSettings | null
  setRisk: (r: RiskSettings) => void
  status: EngineStatus | null
  setStatus: (s: EngineStatus) => void

  // bitget
  bitgetStatus: BitgetStatus | null
  setBitgetStatus: (s: BitgetStatus) => void
  bitgetTickers: BitgetTicker[] | null
  setBitgetTickers: (t: BitgetTicker[] | null) => void
}

export const useDashboard = create<DashboardState>((set, get) => ({
  activeSymbol: 'BTC/USDT',
  setActiveSymbol: (s) => set({ activeSymbol: s }),

  ticks: {},
  candles: {},
  wsConnected: false,
  setWsConnected: (v) => set({ wsConnected: v }),
  applyTick: (t) => {
    const prev = get().ticks[t.symbol]
    const next: Tick = {
      symbol: t.symbol,
      price: t.price,
      ts: t.ts,
      bid: t.bid ?? prev?.bid ?? t.price * 0.9999,
      ask: t.ask ?? prev?.ask ?? t.price * 1.0001,
      volume24h: t.volume24h ?? prev?.volume24h ?? 0,
      change24h: t.change24h ?? prev?.change24h ?? 0,
    }
    // update last candle close/high/low
    const candles = { ...get().candles }
    const arr = candles[t.symbol]
    if (arr && arr.length) {
      const last = { ...arr[arr.length - 1] }
      last.close = t.price
      last.high = Math.max(last.high, t.price)
      last.low = Math.min(last.low, t.price)
      const newArr = arr.slice(0, -1)
      newArr.push(last)
      candles[t.symbol] = newArr
    }
    set({ ticks: { ...get().ticks, [t.symbol]: next }, candles })
  },
  applyCandle: (c) => {
    const candles = { ...get().candles }
    const arr = candles[c.symbol] ? [...candles[c.symbol]] : []
    if (arr.length && arr[arr.length - 1].openTime === c.openTime) {
      arr[arr.length - 1] = c
    } else {
      arr.push(c)
      if (arr.length > 320) arr.shift()
    }
    candles[c.symbol] = arr
    set({ candles })
  },
  applyHistory: (data) => {
    if (!data?.candles?.length) return
    const candles = { ...get().candles }
    candles[data.symbol] = data.candles.slice(-320)
    set({ candles })
  },

  portfolio: null,
  setPortfolio: (p) => set({ portfolio: p }),
  trades: [],
  setTrades: (t) => set({ trades: t }),

  decisions: [],
  setDecisions: (d) => set({ decisions: d }),
  agentsBySymbol: {},
  setAgents: (symbol, agents) =>
    set({ agentsBySymbol: { ...get().agentsBySymbol, [symbol]: agents } }),

  mlBySymbol: {},
  mlHistory: {},
  setML: (symbol, m) => {
    const mlBySymbol = { ...get().mlBySymbol, [symbol]: m }
    const mlHistory = { ...get().mlHistory }
    const prev = mlHistory[symbol] ?? []
    const next = [...prev, m.probUp].slice(-60)
    mlHistory[symbol] = next
    set({ mlBySymbol, mlHistory })
  },

  risk: null,
  setRisk: (r) => set({ risk: r }),
  status: null,
  setStatus: (s) => set({ status: s }),

  bitgetStatus: null,
  setBitgetStatus: (s) => set({ bitgetStatus: s }),
  bitgetTickers: null,
  setBitgetTickers: (t) => set({ bitgetTickers: t }),
}))
