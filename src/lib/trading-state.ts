// In-memory trading state singleton shared across Next.js API routes + agent engine.
// The market microservice (mini-services/market-data, port 3003) is the single
// source of truth for prices. This module subscribes to it as a socket.io client,
// maintains rolling candle buffers + portfolio + positions + trades, and exposes
// synchronous getters for API routes. If the WS service is unreachable, it falls
// back to generating a local price feed so the dashboard always works.

import { io } from 'socket.io-client'
import { db } from './db'
import type {
  Candle, Position, Trade, Portfolio, RiskSettings, OrchestratorDecision,
  AgentOutput, Signal, TradeSide, TradeStatus,
} from './types'
import { TRADE_SYMBOLS } from './types'
import { placeMarketEntry, placeStopOrder, cancelOrder, fetchLiveTickers, fetchLiveKlines, roundToContractSize, loadContractSpecs } from './bitget-executor'

export type TradingMode = 'paper' | 'live'

const MAX_CANDLES = 300
const MARKET_URL = 'http://localhost:3003' // internal — only used server-side

interface State {
  candles: Map<string, Candle[]>
  ticks: Map<string, { price: number; ts: number; bid: number; ask: number; volume24h: number; change24h: number }>
  portfolio: Portfolio
  positions: Map<string, Position & { liveEntryOrderId?: string; liveSlOrderId?: string; liveTpOrderId?: string }>
  trades: Trade[]
  decisions: OrchestratorDecision[]
  agentOutputs: Map<string, AgentOutput[]> // symbol -> recent agent outputs
  risk: RiskSettings
  startedAt: number
  dayStartEquity: number
  peakEquity: number
  cycle: number
  connected: boolean
  mode: TradingMode
  livePriceTimer: NodeJS.Timeout | null
  liveBalanceTimer: NodeJS.Timeout | null
  liveTickerLoaded: boolean
  lastLiveError: string | null
}

function seedPrices(): Map<string, { price: number; ts: number; bid: number; ask: number; volume24h: number; change24h: number }> {
  const m = new Map<string, State['ticks'] extends Map<string, infer V> ? V : never>()
  for (const s of TRADE_SYMBOLS) {
    m.set(s.symbol, {
      price: s.price,
      ts: Date.now(),
      bid: s.price * 0.9999,
      ask: s.price * 1.0001,
      volume24h: 1.2e9,
      change24h: 0,
    })
  }
  return m
}

function seedCandles(): Map<string, Candle[]> {
  const m = new Map<string, Candle[]>()
  for (const s of TRADE_SYMBOLS) {
    const arr: Candle[] = []
    let price = s.price * 0.985
    const now = Date.now()
    for (let i = MAX_CANDLES - 1; i >= 0; i--) {
      const open = price
      const drift = (Math.random() - 0.48) * s.price * 0.002
      const close = Math.max(0.01, open + drift)
      const high = Math.max(open, close) * (1 + Math.random() * 0.0015)
      const low = Math.min(open, close) * (1 - Math.random() * 0.0015)
      const volume = (1e6 + Math.random() * 5e6) * (s.base === 'BTC' ? 1 : s.base === 'ETH' ? 5 : 50)
      arr.push({
        symbol: s.symbol, timeframe: '1m',
        openTime: now - i * 60_000,
        open, high, low, close, volume,
      })
      price = close
    }
    m.set(s.symbol, arr)
  }
  return m
}

// IMPORTANT: hoist state to globalThis so HMR in dev mode does not split the
// module instance between instrumentation (which starts the engine) and the
// API routes (which read state). Without this, the dashboard would see a fresh
// empty state separate from the one the engine is writing to.
const g = globalThis as unknown as { __ND_STATE__?: State; __ND_SOCKET__?: any; __ND_FALLBACK__?: NodeJS.Timeout | null }
const state: State = (g.__ND_STATE__ ??= {
  candles: seedCandles(),
  ticks: seedPrices(),
  portfolio: {
    cash: 100_000,
    equity: 100_000,
    exposure: 0,
    openPnl: 0,
    realizedPnl: 0,
    dayPnl: 0,
    dayPnlPct: 0,
    winRate: 0,
  },
  positions: new Map(),
  trades: [],
  decisions: [],
  agentOutputs: new Map(),
  risk: {
    maxRiskPerTrade: 0.02,
    maxTotalExposure: 0.6,
    maxDrawdown: 0.15,
    leverageCap: 20,
    product: 'spot',
    marginMode: 'isolated',
    leverage: 10,
  },
  startedAt: Date.now(),
  dayStartEquity: 100_000,
  peakEquity: 100_000,
  cycle: 0,
  connected: false,
  mode: 'paper',
  livePriceTimer: null,
  liveBalanceTimer: null,
  liveTickerLoaded: false,
  lastLiveError: null,
})

// wire up socket client to market microservice (also globalThis-guarded)
let socket: ReturnType<typeof io> | null = g.__ND_SOCKET__ ?? null
let fallbackTimer: NodeJS.Timeout | null = g.__ND_FALLBACK__ ?? null

function startFallback() {
  if (fallbackTimer) return
  // generate ticks locally every 1.5s so the dashboard keeps working
  g.__ND_FALLBACK__ = fallbackTimer = setInterval(() => {
    for (const s of TRADE_SYMBOLS) {
      const t = state.ticks.get(s.symbol)!
      const drift = (Math.random() - 0.5) * t.price * 0.0015
      const newPrice = Math.max(0.01, t.price + drift)
      applyTick(s.symbol, newPrice)
    }
  }, 1500)
}

function stopFallback() {
  if (fallbackTimer) { clearInterval(fallbackTimer); fallbackTimer = null; g.__ND_FALLBACK__ = null }
}

function applyTick(symbol: string, price: number) {
  const t = state.ticks.get(symbol)
  if (!t) return
  const prev = t.price
  t.price = price
  t.ts = Date.now()
  t.bid = price * 0.9999
  t.ask = price * 1.0001
  t.change24h = ((price - prev) / prev) * 100 + t.change24h * 0.999
  // update last candle close/high/low
  const arr = state.candles.get(symbol)
  if (arr && arr.length) {
    const last = arr[arr.length - 1]
    last.close = price
    last.high = Math.max(last.high, price)
    last.low = Math.min(last.low, price)
    last.volume += Math.random() * 1000
  }
  updateUnrealized()
}

function pushNewCandle(c: Candle) {
  const arr = state.candles.get(c.symbol)
  if (!arr) return
  arr.push(c)
  if (arr.length > MAX_CANDLES) arr.shift()
}

// ---- LIVE PRICE POLLING (real Bitget public API) ----
// When mode='live', we poll Bitget's public ticker endpoint every 2s and
// update the in-memory ticks + last candle. This replaces both the simulated
// microservice AND the local fallback generator.
async function pollLivePrices() {
  const symbols = TRADE_SYMBOLS.map((s) => s.symbol)
  const product = state.risk.product

  // ALWAYS fetch spot prices first — they're guaranteed to work for all symbols
  // and serve as the reliable base price feed.
  const spotTicks = await fetchLiveTickers(symbols, 'spot')
  const gotSymbols = new Set<string>()

  for (const t of spotTicks) {
    applyTick(t.symbol, t.price)
    const existing = state.ticks.get(t.symbol)
    if (existing) { existing.volume24h = t.volume24h; existing.change24h = t.change24h }
    gotSymbols.add(t.symbol)
  }

  // If in futures mode, try to overlay futures prices (they're slightly
  // different from spot due to funding). If futures fails for any symbol,
  // the spot price from above remains — so ALL symbols always get updated.
  if (product === 'futures' && spotTicks.length > 0) {
    const futTicks = await fetchLiveTickers(symbols, 'futures')
    for (const t of futTicks) {
      applyTick(t.symbol, t.price)  // override spot with futures price
      gotSymbols.add(t.symbol)
    }
  }

  // Log any symbols that didn't get any price (shouldn't happen now)
  const missing = symbols.filter(s => !gotSymbols.has(s))
  if (missing.length > 0) {
    console.warn(`[pollLivePrices] no price for: ${missing.join(', ')}`)
  }

  state.connected = true
}

async function startLivePricePolling() {
  if (state.livePriceTimer) return
  const product = state.risk.product
  // load futures contract specs (sizeMultiplier, minTradeNum) for order sizing
  if (product === 'futures') {
    await loadContractSpecs()
  }
  // bootstrap candle history from Bitget once
  if (!state.liveTickerLoaded) {
    state.liveTickerLoaded = true
    for (const s of TRADE_SYMBOLS) {
      const klines = await fetchLiveKlines(s.symbol, 200, product)
      if (klines.length) {
        const candles: Candle[] = klines.map((k) => ({
          symbol: s.symbol, timeframe: '1m',
          openTime: k.openTime, open: k.open, high: k.high, low: k.low, close: k.close, volume: k.volume,
        }))
        state.candles.set(s.symbol, candles.slice(-MAX_CANDLES))
      }
    }
    console.log(`[trading-state] live mode: bootstrapped ${product} candle history from Bitget`)
  }
  // initial poll
  pollLivePrices().catch(() => {})
  // then every 2s
  state.livePriceTimer = setInterval(() => { pollLivePrices().catch(() => {}) }, 2000)
  // re-sync the real Bitget balance every 30s so equity stays accurate
  // (picks up realized P/L from manual trades on Bitget, deposits, withdrawals)
  state.liveBalanceTimer = setInterval(() => { syncLiveBalance().catch(() => {}) }, 30_000)
  console.log(`[trading-state] live mode: polling real Bitget ${product} prices every 2s + balance every 30s`)
}

// Re-fetch the real Bitget USDT balance and update equity.
// This keeps the dashboard equity in sync with reality — picks up realized
// P/L from positions closed on Bitget directly, deposits, withdrawals, etc.
async function syncLiveBalance() {
  if (!isLiveConfigured()) return
  try {
    const product = state.risk.product
    const res = await fetch(`http://localhost:3000/api/bitget?action=balance&product=${product}`)
    const data = await res.json().catch(() => ({}))
    if (data?.live && Array.isArray(data?.assets)) {
      const usdt = data.assets.find((a: any) => a.coin === 'USDT')
      const realBalance = usdt?.total ?? 0
      if (realBalance > 0) {
        // Preserve unrealized P/L from open positions, but sync cash to real balance
        const openPnl = state.portfolio.openPnl
        state.portfolio.cash = realBalance
        state.portfolio.equity = realBalance + openPnl
        if (state.portfolio.equity > state.peakEquity) state.peakEquity = state.portfolio.equity
      }
    }
  } catch {
    // ignore — will retry in 30s
  }
}

function stopLivePricePolling() {
  if (state.livePriceTimer) { clearInterval(state.livePriceTimer); state.livePriceTimer = null }
  if (state.liveBalanceTimer) { clearInterval(state.liveBalanceTimer); state.liveBalanceTimer = null }
}

// ---- MODE SWITCH (paper <-> live) ----
export async function setMode(mode: TradingMode) {
  if (state.mode === mode) return
  if (mode === 'live') {
    // switching to live: stop simulated feed, start real polling
    stopFallback()
    if (socket) { try { socket.disconnect() } catch {} socket = null; g.__ND_SOCKET__ = null }
    state.mode = 'live'
    startLivePricePolling()

    // CRITICAL: sync the portfolio equity to the REAL Bitget balance.
    // Uses the selected product (spot or futures) for the balance fetch.
    try {
      const product = state.risk.product
      const res = await fetch(`http://localhost:3000/api/bitget?action=balance&product=${product}`)
      const data = await res.json().catch(() => ({}))
      if (data?.live && Array.isArray(data?.assets)) {
        const usdt = data.assets.find((a: any) => a.coin === 'USDT')
        const realBalance = usdt?.total ?? 0
        if (realBalance > 0) {
          state.portfolio.cash = realBalance
          state.portfolio.equity = realBalance
          state.portfolio.realizedPnl = 0
          state.portfolio.openPnl = 0
          state.portfolio.exposure = 0
          state.portfolio.dayPnl = 0
          state.portfolio.dayPnlPct = 0
          state.peakEquity = realBalance
          state.dayStartEquity = realBalance
          console.log(`[trading-state] LIVE mode: synced real Bitget balance $${realBalance.toFixed(2)} as equity`)
        } else {
          console.warn('[trading-state] LIVE mode: no USDT balance found in Bitget account')
        }
      }
    } catch (e) {
      console.error('[trading-state] LIVE mode: failed to sync Bitget balance:', (e as Error).message)
    }

    console.log('[trading-state] switched to LIVE mode — real Bitget prices + real orders + real balance')
  } else {
    // switching to paper: stop live polling, reconnect simulated feed
    stopLivePricePolling()
    state.mode = 'paper'
    state.connected = false
    // restore paper equity
    state.portfolio.cash = 100_000 + state.portfolio.realizedPnl
    updateUnrealized()
    state.peakEquity = Math.max(state.portfolio.equity, state.peakEquity)
    connectMarket()
    console.log('[trading-state] switched to PAPER mode — simulated prices')
  }
}

export function getMode(): TradingMode { return state.mode }

// Called when a new symbol is added at runtime — seeds its tick + candle buffer
export function seedNewSymbol(symbol: string, price: number) {
  if (!state.ticks.has(symbol)) {
    state.ticks.set(symbol, {
      price,
      ts: Date.now(),
      bid: price * 0.9999,
      ask: price * 1.0001,
      volume24h: 0,
      change24h: 0,
    })
  }
  if (!state.candles.has(symbol)) {
    const arr: Candle[] = []
    const now = Date.now()
    let p = price * 0.99
    for (let i = 19; i >= 0; i--) {
      const open = p
      const drift = (Math.random() - 0.5) * price * 0.002
      const close = Math.max(0.01, open + drift)
      arr.push({
        symbol, timeframe: '1m', openTime: now - i * 60_000,
        open, high: Math.max(open, close), low: Math.min(open, close), close, volume: 1000,
      })
      p = close
    }
    state.candles.set(symbol, arr)
  }
}

export function isLiveConfigured(): boolean {
  return !!(process.env.BITGET_API_KEY && process.env.BITGET_API_SECRET && process.env.BITGET_API_PASSPHRASE)
}

export function connectMarket() {
  // In LIVE mode, skip the simulated microservice and poll real Bitget prices.
  if (state.mode === 'live') { startLivePricePolling(); return }
  if (socket) return
  try {
    socket = io(MARKET_URL, { path: '/', transports: ['websocket'], reconnection: true, reconnectionAttempts: Infinity, timeout: 3000 })
    g.__ND_SOCKET__ = socket
    socket.on('connect', () => { state.connected = true; stopFallback() })
    socket.on('disconnect', () => { state.connected = false; startFallback() })
    socket.on('tick', (t: { symbol: string; price: number }) => applyTick(t.symbol, t.price))
    socket.on('candle', (c: Candle) => {
      // replace last candle if same openTime else push
      const arr = state.candles.get(c.symbol)
      if (arr && arr.length && arr[arr.length - 1].openTime === c.openTime) {
        arr[arr.length - 1] = c
      } else {
        pushNewCandle(c)
      }
      const t = state.ticks.get(c.symbol)
      if (t) { t.price = c.close; t.ts = Date.now() }
      updateUnrealized()
    })
    socket.on('history', (data: { symbol: string; candles: Candle[] }) => {
      if (data.candles?.length) state.candles.set(data.symbol, data.candles.slice(-MAX_CANDLES))
    })
    // request history
    socket.on('connect', () => {
      for (const s of TRADE_SYMBOLS) socket?.emit('get-history', { symbol: s.symbol })
    })
    // if no connect in 3s, fallback
    setTimeout(() => { if (!state.connected) startFallback() }, 3000)
  } catch {
    startFallback()
  }
}

function updateUnrealized() {
  let openPnl = 0
  let exposure = 0
  for (const pos of state.positions.values()) {
    const t = state.ticks.get(pos.symbol)
    const price = t?.price ?? pos.entryPrice
    const pnl = pos.side === 'LONG'
      ? (price - pos.entryPrice) * pos.size
      : (pos.entryPrice - price) * pos.size
    pos.unrealized = pnl
    openPnl += pnl
    exposure += pos.size * price
  }
  state.portfolio.openPnl = openPnl
  state.portfolio.equity = state.portfolio.cash + openPnl
  state.portfolio.exposure = state.portfolio.equity > 0 ? exposure / state.portfolio.equity : 0
  if (state.portfolio.equity > state.peakEquity) state.peakEquity = state.portfolio.equity
  state.portfolio.dayPnl = state.portfolio.equity - state.dayStartEquity
  state.portfolio.dayPnlPct = state.dayStartEquity > 0 ? state.portfolio.dayPnl / state.dayStartEquity : 0
}

// ---- Trading mutations (called by the agent engine) ----

export async function openPosition(symbol: string, side: TradeSide, size: number, stopLoss: number, takeProfit: number, confidence: number, rationale: string): Promise<Trade | null> {
  const t = state.ticks.get(symbol)
  if (!t) return null
  const price = side === 'LONG' ? t.ask : t.bid
  // Derivatives/margin model: cash is collateral, not debited by notional.
  // The max notional is equity × leverage (for futures) or equity (for spot).
  updateUnrealized()
  const equity = state.portfolio.equity
  if (equity <= 0) return null
  const leverage = state.risk.product === 'futures' ? Math.min(state.risk.leverage, state.risk.leverageCap) : 1
  let currentNotional = 0
  for (const p of state.positions.values()) {
    const px = state.ticks.get(p.symbol)?.price ?? p.entryPrice
    currentNotional += p.size * px
  }
  const maxNotional = equity * leverage
  const availableNotional = maxNotional - currentNotional
  if (availableNotional <= 0) return null
  let notional = size * price
  if (notional > availableNotional) {
    size = availableNotional / price
    notional = size * price
    if (size <= 0) return null
  }
  // For futures: round to the symbol's contract size multiplier (e.g. SOL=0.1, BTC=0.0001)
  if (state.risk.product === 'futures') {
    await loadContractSpecs()
    size = roundToContractSize(symbol, size)
    // Pre-flight check: if the rounded size is still below Bitget's minimum,
    // return an error instead of sending a doomed order to Bitget.
    const bgSym = symbol.replace('/', '')
    const spec = (await import('./bitget-executor'))._getSpec(bgSym)
    if (spec) {
      if (size < spec.minTradeNum) {
        // Try to bump up to the minimum if we have buying power
        const minNotional = spec.minTradeNum * price
        const buyingPower = equity * leverage
        if (minNotional <= buyingPower) {
          size = spec.minTradeNum
          console.log(`[openPosition] ${symbol}: bumped size to minimum ${spec.minTradeNum}`)
        } else {
          const msg = `Order size ${size} ${symbol.split('/')[0]} is below Bitget minimum (${spec.minTradeNum}). Need more capital or higher leverage. Equity=$${equity.toFixed(2)} lev=${leverage}x → buying power=$${buyingPower.toFixed(2)} → min order cost=$${minNotional.toFixed(2)}.`
          console.error('[openPosition]', msg)
          state.lastLiveError = msg
          return null
        }
      }
    } else {
      // Spec not loaded — hard floor at 1 to prevent tiny float orders
      size = Math.max(1, Math.floor(size))
      console.warn(`[openPosition] ${symbol}: no contract spec loaded, using floor=${size}`)
    }
  }

  // ---- LIVE MODE: place real orders on Bitget ----
  let liveEntryOrderId: string | undefined
  let liveSlOrderId: string | undefined
  let liveTpOrderId: string | undefined
  if (state.mode === 'live' && isLiveConfigured()) {
    const product = state.risk.product
    // For futures: set leverage + margin mode BEFORE placing the order.
    // Bitget requires this once per symbol; calling it repeatedly is safe.
    if (product === 'futures') {
      const lev = Math.min(state.risk.leverage, state.risk.leverageCap)
      const { setLeverage, setMarginMode } = await import('./bitget-executor')
      const levRes = await setLeverage(symbol, lev, state.risk.marginMode)
      if (!levRes.ok) console.warn('[live] set-leverage failed (continuing):', levRes.error)
      const mmRes = await setMarginMode(symbol, state.risk.marginMode)
      if (!mmRes.ok) console.warn('[live] set-margin-mode failed (continuing):', mmRes.error)
      console.log(`[live] futures ${symbol}: leverage=${lev}x margin=${state.risk.marginMode}`)
    }
    // 1. market entry order (with product + tradeSide + marginMode for futures)
    const entry = await placeMarketEntry(symbol, side, size, {
      product,
      tradeSide: 'open',
      marginMode: state.risk.marginMode,
    })
    if (!entry.ok) {
      console.error('[live] entry order failed:', entry.error)
      state.lastLiveError = entry.error || 'Bitget rejected the order'
      return null
    }
    liveEntryOrderId = entry.orderId
    // 2. exchange-side stop-loss (reduce-only trigger)
    const sl = await placeStopOrder(symbol, side, size, stopLoss, 'sl', { product, marginMode: state.risk.marginMode })
    if (sl.ok) liveSlOrderId = sl.orderId
    else console.warn('[live] SL plan order failed:', sl.error)
    // 3. exchange-side take-profit (reduce-only trigger)
    const tp = await placeStopOrder(symbol, side, size, takeProfit, 'tp', { product, marginMode: state.risk.marginMode })
    if (tp.ok) liveTpOrderId = tp.orderId
    else console.warn('[live] TP plan order failed:', tp.error)
    console.log(`[live] opened ${side} ${symbol} size=${size} entry=${liveEntryOrderId} sl=${liveSlOrderId} tp=${liveTpOrderId}`)
  }

  // cash is NOT debited (margin model); equity = cash + unrealized
  const pos: Position & { liveEntryOrderId?: string; liveSlOrderId?: string; liveTpOrderId?: string } = {
    symbol, side, size, entryPrice: price, stopLoss, takeProfit, unrealized: 0, openedAt: Date.now(),
    liveEntryOrderId, liveSlOrderId, liveTpOrderId,
  }
  state.positions.set(symbol, pos)
  const trade: Trade = {
    id: Math.random().toString(36).slice(2, 10),
    symbol, side, size, entryPrice: price, exitPrice: null, status: 'OPEN',
    pnl: null, pnlPct: null, stopLoss, takeProfit, confidence, rationale,
    openedAt: Date.now(), closedAt: null,
  }
  state.trades.unshift(trade)
  if (state.trades.length > 200) state.trades.pop()
  // persist
  db.trade.create({ data: {
    symbol, side, size, entryPrice: price, status: 'OPEN',
    stopLoss, takeProfit, confidence, rationale,
  } }).catch(() => {})
  db.position.upsert({ where: { symbol }, create: { symbol, side, size, entryPrice: price, stopLoss, takeProfit, unrealized: 0 }, update: { symbol, side, size, entryPrice: price, stopLoss, takeProfit, unrealized: 0 } }).catch(() => {})
  updateUnrealized()
  return trade
}

export async function closePosition(symbol: string, reason: string): Promise<Trade | null> {
  const pos = state.positions.get(symbol)
  if (!pos) return null
  const t = state.ticks.get(symbol)
  const price = pos.side === 'LONG' ? (t?.bid ?? pos.entryPrice) : (t?.ask ?? pos.entryPrice)

  // ---- LIVE MODE: cancel exchange-side SL/TP orders, then place closing market order ----
  if (state.mode === 'live' && isLiveConfigured()) {
    const product = state.risk.product
    // cancel the SL + TP plan orders so they don't trigger after we've closed
    if (pos.liveSlOrderId) { await cancelOrder(symbol, pos.liveSlOrderId, { product }) }
    if (pos.liveTpOrderId) { await cancelOrder(symbol, pos.liveTpOrderId, { product }) }
    // place a market close order (opposite side, tradeSide='close' for futures)
    const closeSide = pos.side === 'LONG' ? 'SHORT' : 'LONG'
    await placeMarketEntry(symbol, closeSide, pos.size, {
      product: state.risk.product,
      tradeSide: 'close',
      marginMode: state.risk.marginMode,
    })
    console.log(`[live] closed ${pos.side} ${symbol} reason=${reason}`)
  }

  const pnl = pos.side === 'LONG' ? (price - pos.entryPrice) * pos.size : (pos.entryPrice - price) * pos.size
  // margin model: only the realized P/L settles into cash (notional was never debited)
  state.portfolio.cash += pnl
  state.portfolio.realizedPnl += pnl
  state.positions.delete(symbol)
  // update trade
  const trade = state.trades.find((tr) => tr.symbol === symbol && tr.status === 'OPEN') ?? null
  if (trade) {
    trade.status = 'CLOSED'
    trade.exitPrice = price
    trade.pnl = pnl
    trade.pnlPct = pos.entryPrice > 0 ? pnl / (pos.size * pos.entryPrice) : 0
    trade.closedAt = Date.now()
    db.trade.updateMany({ where: { id: trade.id }, data: { status: 'CLOSED', exitPrice: price, pnl, pnlPct: trade.pnlPct, closedAt: new Date() } }).catch(() => {})
  }
  db.position.deleteMany({ where: { symbol } }).catch(() => {})
  updateUnrealized()
  // win rate
  const closed = state.trades.filter((tr) => tr.status === 'CLOSED')
  const wins = closed.filter((tr) => (tr.pnl ?? 0) > 0).length
  state.portfolio.winRate = closed.length ? wins / closed.length : 0
  return trade ?? null
}

// check stops/takes on each tick — returns closed trades
// In live mode, the EXCHANGE-side plan orders handle SL/TP directly, so this
// function is mostly a paper-mode safety net + a sync mechanism. It still runs
// so the dashboard reflects closures promptly when a soft SL/TP would trigger.
export async function checkExits(): Promise<string[]> {
  const closed: string[] = []
  for (const pos of state.positions.values()) {
    const t = state.ticks.get(pos.symbol)
    if (!t) continue
    const price = t.price
    const hitSL = pos.side === 'LONG' ? price <= pos.stopLoss : price >= pos.stopLoss
    const hitTP = pos.side === 'LONG' ? price >= pos.takeProfit : price <= pos.takeProfit
    if (hitSL) { await closePosition(pos.symbol, 'stop-loss'); closed.push(pos.symbol) }
    else if (hitTP) { await closePosition(pos.symbol, 'take-profit'); closed.push(pos.symbol) }
  }
  return closed
}

export function recordDecision(d: OrchestratorDecision) {
  state.decisions.unshift(d)
  if (state.decisions.length > 100) state.decisions.pop()
  state.cycle = d.cycle
  // persist orchestrator + each agent decision
  db.agentDecision.create({ data: { symbol: d.symbol, cycle: d.cycle, agent: 'ORCHESTRATOR', signal: d.signal, confidence: d.confidence, detail: JSON.stringify({ size: d.size, stopLoss: d.stopLoss, takeProfit: d.takeProfit }), rationale: d.rationale } }).catch(() => {})
  for (const a of d.agents) {
    db.agentDecision.create({ data: { symbol: d.symbol, cycle: d.cycle, agent: a.agent, signal: a.signal, confidence: a.confidence, detail: JSON.stringify(a.detail), rationale: a.rationale } }).catch(() => {})
    const list = state.agentOutputs.get(d.symbol) ?? []
    list.unshift(a)
    if (list.length > 50) list.pop()
    state.agentOutputs.set(d.symbol, list)
  }
}

export function snapshotPortfolio(): Portfolio & { positions: Position[]; startedAt: number; peakEquity: number; drawdown: number; cycle: number; connected: boolean } {
  updateUnrealized()
  const dd = state.peakEquity > 0 ? (state.peakEquity - state.portfolio.equity) / state.peakEquity : 0
  return { ...state.portfolio, positions: Array.from(state.positions.values()), startedAt: state.startedAt, peakEquity: state.peakEquity, drawdown: dd, cycle: state.cycle, connected: state.connected }
}

export function getTrades(limit = 50): Trade[] { return state.trades.slice(0, limit) }
export function getDecisions(limit = 30): OrchestratorDecision[] { return state.decisions.slice(0, limit) }
export function getAgentOutputs(symbol: string, limit = 20): AgentOutput[] { return (state.agentOutputs.get(symbol) ?? []).slice(0, limit) }
export function getCandles(symbol: string, limit = 200): Candle[] { return (state.candles.get(symbol) ?? []).slice(-limit) }
export function getTicks() { return Array.from(state.ticks.entries()).map(([symbol, t]) => ({ symbol, ...t })) }
export function getRisk(): RiskSettings { return state.risk }
export function setRisk(r: Partial<RiskSettings>) { state.risk = { ...state.risk, ...r } }
export function getCycle() { return state.cycle }
export function bumpCycle() { state.cycle++; return state.cycle }

// CRITICAL for robustness: restore open positions + cash + realized P/L from
// the database on startup so a process restart (wifi drop, crash, reboot,
// redeploy) does NOT silently wipe your open trades. Without this, the
// in-memory state would seed fresh ($100k, no positions) on every restart
// while the DB still held the real open positions — a dangerous mismatch.
export async function restoreFromDb() {
  try {
    // 0. Load persisted trading symbols from DB. If the DB is empty (first run),
    // seed it with the default symbols. This replaces the hardcoded list so
    // add/remove survives restarts.
    const dbSymbols = await db.tradingSymbol.findMany({ orderBy: { createdAt: 'asc' } })
    if (dbSymbols.length > 0) {
      // Clear the default hardcoded list and load from DB
      TRADE_SYMBOLS.length = 0
      for (const s of dbSymbols) {
        TRADE_SYMBOLS.push({
          symbol: s.symbol, name: s.name, base: s.base,
          price: s.price, change24h: 0, volume24h: 0,
        })
        // seed the tick + candle buffer for each persisted symbol
        seedNewSymbol(s.symbol, s.price || 1)
      }
      console.log(`[restoreFromDb] loaded ${dbSymbols.length} symbols from DB: ${TRADE_SYMBOLS.map(s => s.symbol).join(', ')}`)
    } else {
      // First run — persist the default symbols to DB
      for (const s of TRADE_SYMBOLS) {
        await db.tradingSymbol.upsert({
          where: { symbol: s.symbol },
          create: { symbol: s.symbol, name: s.name, base: s.base, price: s.price },
          update: {},
        }).catch(() => {})
      }
      console.log(`[restoreFromDb] seeded ${TRADE_SYMBOLS.length} default symbols to DB`)
    }

    // 1. reload open positions into memory — but only for symbols still in
    //    the active trading list. Positions for removed symbols are skipped
    //    (they should have been closed when the symbol was removed).
    const dbPositions = await db.position.findMany()
    for (const p of dbPositions) {
      // Skip positions for symbols that are no longer in the active list
      if (!TRADE_SYMBOLS.find((s) => s.symbol === p.symbol)) {
        console.log(`[restoreFromDb] skipping ${p.symbol} position — symbol removed from active list`)
        // delete the stale position from the DB
        await db.position.deleteMany({ where: { symbol: p.symbol } }).catch(() => {})
        continue
      }
      state.positions.set(p.symbol, {
        symbol: p.symbol,
        side: p.side as TradeSide,
        size: p.size,
        entryPrice: p.entryPrice,
        stopLoss: p.stopLoss,
        takeProfit: p.takeProfit,
        unrealized: 0,
        openedAt: p.openedAt.getTime(),
      })
    }
    // 2. reload recent trades (open + closed) for the trade-history panel
    const dbTrades = await db.trade.findMany({ orderBy: { openedAt: 'desc' }, take: 200 })
    state.trades = dbTrades.map((t) => ({
      id: t.id,
      symbol: t.symbol,
      side: t.side as TradeSide,
      size: t.size,
      entryPrice: t.entryPrice,
      exitPrice: t.exitPrice,
      status: t.status as TradeStatus,
      pnl: t.pnl,
      pnlPct: t.pnlPct,
      stopLoss: t.stopLoss,
      takeProfit: t.takeProfit,
      confidence: t.confidence,
      rationale: t.rationale,
      openedAt: t.openedAt.getTime(),
      closedAt: t.closedAt ? t.closedAt.getTime() : null,
    }))
    // 3. recompute realized P/L + win rate from closed trades
    const closed = state.trades.filter((t) => t.status === 'CLOSED')
    state.portfolio.realizedPnl = closed.reduce((s, t) => s + (t.pnl ?? 0), 0)
    const wins = closed.filter((t) => (t.pnl ?? 0) > 0).length
    state.portfolio.winRate = closed.length ? wins / closed.length : 0
    // 4. cash = starting capital + realized P/L (margin model: cash only
    //    changes by realized P/L, not by opening positions)
    state.portfolio.cash = 100_000 + state.portfolio.realizedPnl
    // 5. restore the cycle counter from the latest agent decision
    const lastDecision = await db.agentDecision.findFirst({ orderBy: { createdAt: 'desc' } })
    if (lastDecision) state.cycle = lastDecision.cycle
    // 6. restore risk settings
    const riskRow = await db.riskSettings.findUnique({ where: { id: 'default' } })
    if (riskRow) {
      state.risk = {
        maxRiskPerTrade: riskRow.maxRiskPerTrade,
        maxTotalExposure: riskRow.maxTotalExposure,
        maxDrawdown: riskRow.maxDrawdown,
        leverageCap: riskRow.leverageCap,
        product: (riskRow as any).product === 'futures' ? 'futures' : 'spot',
        marginMode: (riskRow as any).marginMode === 'cross' ? 'cross' : 'isolated',
        leverage: (riskRow as any).leverage ?? 3,
      }
    }
    updateUnrealized()
    if (state.positions.size > 0) {
      console.log(`[trading-state] restored ${state.positions.size} open position(s) + ${state.trades.length} trade(s) from DB`)
    }
  } catch (e) {
    console.error('[trading-state] restoreFromDb failed:', (e as Error).message)
  }
}

// manual override (for UI controls)
export async function manualClose(symbol: string) { return closePosition(symbol, 'manual') }

// Close ALL open positions at once — used by the "Close All" button +
// when removing tickers to clean up stuck positions.
export async function closeAllPositions(): Promise<{ ok: boolean; closed: number; errors: string[] }> {
  const errors: string[] = []
  let closed = 0
  const symbols = Array.from(state.positions.keys())
  for (const symbol of symbols) {
    try {
      const t = await closePosition(symbol, 'close-all')
      if (t) closed++
    } catch (e: any) {
      errors.push(`${symbol}: ${e?.message || 'failed'}`)
    }
  }
  return { ok: true, closed, errors }
}
export async function manualOpen(symbol: string, side: TradeSide, riskPct: number): Promise<{ ok: boolean; trade?: Trade | null; error?: string }> {
  const t = state.ticks.get(symbol)
  if (!t || !t.price || t.price <= 0) {
    return { ok: false, error: `No price data for ${symbol}. ${state.mode === 'live' ? 'Live price polling may not have started yet — wait 2-3 seconds and try again.' : 'Market service may be down — wait 3s for fallback to start.'}` }
  }
  const price = side === 'LONG' ? t.ask : t.bid
  if (!price || price <= 0) return { ok: false, error: 'Invalid price for ' + symbol }
  const leverage = state.risk.product === 'futures' ? Math.min(state.risk.leverage, state.risk.leverageCap) : 1
  const riskAmt = state.portfolio.equity * riskPct
  const stopDist = price * 0.01
  let size = (riskAmt / stopDist) * leverage
  // For futures: round to the symbol's contract size multiplier
  if (state.risk.product === 'futures') {
    await loadContractSpecs()
    size = roundToContractSize(symbol, size)
  }
  // NOTE: We do NOT block small orders here. Bitget has its own minimums
  // (spot: varies by symbol, futures: 1 contract). If the order is too small,
  // Bitget will reject it and the error will show in the API Monitor panel.
  // This allows trading with any capital — even $2 with high leverage.
  const sl = side === 'LONG' ? price - stopDist : price + stopDist
  const tp = side === 'LONG' ? price + stopDist * 2 : price - stopDist * 2
  const trade = await openPosition(symbol, side, size, sl, tp, 1, 'Manual override by operator')
  if (!trade) {
    if (state.mode === 'live' && state.lastLiveError) {
      const err = state.lastLiveError
      state.lastLiveError = null
      return { ok: false, error: err }
    }
    return { ok: false, error: state.mode === 'live' ? 'Bitget rejected the order — check API Monitor panel for details' : 'Open position failed — check equity, exposure, or drawdown limit' }
  }
  return { ok: true, trade }
}

export function resetPaperAccount() {
  state.positions.clear()
  state.trades = []
  state.decisions = []
  state.agentOutputs.clear()
  state.portfolio = { cash: 100_000, equity: 100_000, exposure: 0, openPnl: 0, realizedPnl: 0, dayPnl: 0, dayPnlPct: 0, winRate: 0 }
  state.peakEquity = 100_000
  state.dayStartEquity = 100_000
  state.cycle = 0
  db.trade.deleteMany({}).catch(() => {})
  db.position.deleteMany({}).catch(() => {})
  db.agentDecision.deleteMany({}).catch(() => {})
}

export type { Signal }
