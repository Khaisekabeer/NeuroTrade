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
}

export interface SymbolMeta {
  symbol: string
  name: string
  base: string
  price: number
  change24h: number
  volume24h: number
}

export const TRADE_SYMBOLS: SymbolMeta[] = [
  { symbol: 'BTC/USDT', name: 'Bitcoin', base: 'BTC', price: 67250, change24h: 0, volume24h: 0 },
  { symbol: 'ETH/USDT', name: 'Ethereum', base: 'ETH', price: 3480, change24h: 0, volume24h: 0 },
  { symbol: 'SOL/USDT', name: 'Solana', base: 'SOL', price: 168.4, change24h: 0, volume24h: 0 },
  { symbol: 'XRP/USDT', name: 'XRP', base: 'XRP', price: 0.62, change24h: 0, volume24h: 0 },
  { symbol: 'DOGE/USDT', name: 'Dogecoin', base: 'DOGE', price: 0.14, change24h: 0, volume24h: 0 },
  { symbol: 'ADA/USDT', name: 'Cardano', base: 'ADA', price: 0.45, change24h: 0, volume24h: 0 },
]
