// Shared trading types for the multi-agent bot

export type AgentName =
  | 'SENTIMENT'
  | 'TECHNICAL'
  | 'ML'
  | 'RISK'
  | 'ORCHESTRATOR'

export type Signal = 'LONG' | 'SHORT' | 'FLAT' | 'HOLD'
export type TradeSide = 'LONG' | 'SHORT'
export type TradeStatus = 'OPEN' | 'CLOSED'

export interface Candle {
  symbol: string
  timeframe: string
  openTime: number // epoch ms
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface Tick {
  symbol: string
  price: number
  bid: number
  ask: number
  volume24h: number
  change24h: number
  ts: number
}

export interface AgentOutput {
  agent: AgentName
  signal: Signal
  confidence: number // 0..1
  detail: Record<string, number | string>
  rationale: string
  ts: number
}

export interface OrchestratorDecision {
  cycle: number
  symbol: string
  signal: Signal
  confidence: number
  size: number
  stopLoss: number
  takeProfit: number
  rationale: string
  agents: AgentOutput[]
  ts: number
}

export interface Position {
  symbol: string
  side: TradeSide
  size: number
  entryPrice: number
  stopLoss: number
  takeProfit: number
  unrealized: number
  openedAt: number
}

export interface Trade {
  id: string
  symbol: string
  side: TradeSide
  size: number
  entryPrice: number
  exitPrice: number | null
  status: TradeStatus
  pnl: number | null
  pnlPct: number | null
  stopLoss: number
  takeProfit: number
  confidence: number
  rationale: string
  openedAt: number
  closedAt: number | null
}

export interface Portfolio {
  cash: number
  equity: number
  exposure: number // fraction of equity deployed
  openPnl: number
  realizedPnl: number
  dayPnl: number
  dayPnlPct: number
  winRate: number
}

export interface RiskSettings {
  maxRiskPerTrade: number
  maxTotalExposure: number
  maxDrawdown: number
  leverageCap: number
  product: 'spot' | 'futures'   // which Bitget market to trade
  marginMode: 'isolated' | 'cross'  // futures margin mode
  leverage: number              // actual leverage to use (1-125x, futures)
}

export interface SymbolMeta {
  symbol: string
  name: string
  base: string
  price: number
  change24h: number
  volume24h: number
}

// Mutable runtime list of trading symbols. Hoisted to globalThis so HMR
// doesn't create a new empty array on each reload — the same array
// survives across module re-evaluations.
const _g = globalThis as unknown as { __ND_TRADE_SYMBOLS__?: SymbolMeta[] }
export const TRADE_SYMBOLS: SymbolMeta[] = (_g.__ND_TRADE_SYMBOLS__ ??= [])

// Helper: add a new symbol to the list (if not already present)
export function addSymbol(sym: SymbolMeta) {
  if (!TRADE_SYMBOLS.find((s) => s.symbol === sym.symbol)) {
    TRADE_SYMBOLS.push(sym)
  }
}

// Helper: remove a symbol by its 'BTC/USDT' identifier
export function removeSymbol(symbol: string) {
  const idx = TRADE_SYMBOLS.findIndex((s) => s.symbol === symbol)
  if (idx >= 0) TRADE_SYMBOLS.splice(idx, 1)
}
