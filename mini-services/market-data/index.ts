// Market-data microservice — DYNAMIC symbol management.
// No hardcoded symbols. The main app adds/removes symbols at runtime via
// the 'add-symbol' / 'remove-symbol' Socket.IO events. On connect, the app
// sends the current list. Prices are simulated using GBM + mean reversion.
//
// IMPORTANT: path MUST be '/' so the Caddy gateway forwards correctly.

import { createServer } from 'http'
import { Server } from 'socket.io'

const PORT = 3003

interface Sym {
  symbol: string
  price: number
  base: string
  drift: number
  vol: number
  meanRevert: number
  anchor: number
  history: number[]
  candles: any[]
  currentCandle: any
  volume24h: number
  open24h: number
}

const SYMS: Map<string, Sym> = new Map()
const CANDLE_MS = 60_000

// Default seed prices for common coins (used when adding a symbol that
// hasn't been seen before). For unknown coins, price = 1.0.
const SEED_PRICES: Record<string, number> = {
  'BTC': 67000, 'ETH': 3500, 'SOL': 170, 'XRP': 0.62, 'DOGE': 0.14,
  'ADA': 0.45, 'AVAX': 35, 'LINK': 14, 'MATIC': 0.8, 'DOT': 7,
  'LTC': 80, 'TRX': 0.12, 'ATOM': 9, 'NEAR': 5, 'APT': 8,
  'ARB': 1.0, 'OP': 2.0, 'INJ': 25, 'SUI': 1.2, 'BNB': 600,
}

function createSym(symbol: string, price?: number): Sym {
  const base = symbol.split('/')[0]
  const p = price || SEED_PRICES[base] || 1.0
  return {
    symbol,
    base,
    price: p,
    drift: 0.00003 + Math.random() * 0.00002,
    vol: 0.0010 + Math.random() * 0.0008,
    meanRevert: 0.002,
    anchor: p,
    history: [],
    candles: [],
    currentCandle: null,
    volume24h: 1e9,
    open24h: p * 0.99,
  }
}

function seedSym(s: Sym) {
  const now = Date.now()
  let p = s.price * 0.985
  for (let i = 299; i >= 0; i--) {
    const open = p
    const shock = (Math.random() - 0.5) * 2
    const ret = s.drift + s.vol * shock + (s.anchor - p) / s.anchor * s.meanRevert
    const close = Math.max(0.01, open * (1 + ret))
    const high = Math.max(open, close) * (1 + Math.random() * 0.0012)
    const low = Math.min(open, close) * (1 - Math.random() * 0.0012)
    const volume = 1e6 * (0.6 + Math.random())
    s.candles.push({ symbol: s.symbol, timeframe: '1m', openTime: now - i * CANDLE_MS, open, high, low, close, volume })
    p = close
  }
  s.price = s.candles[s.candles.length - 1].close
  s.anchor = s.price
  s.currentCandle = null
}

function addSymbol(symbol: string, price?: number) {
  if (SYMS.has(symbol)) return
  const s = createSym(symbol, price)
  seedSym(s)
  SYMS.set(symbol, s)
  console.log(`[market-data] added symbol ${symbol} @ ${s.price}`)
}

function removeSymbol(symbol: string) {
  if (SYMS.delete(symbol)) {
    console.log(`[market-data] removed symbol ${symbol}`)
  }
}

function newCandle(s: Sym, t: number) {
  const open = s.price
  s.currentCandle = { symbol: s.symbol, timeframe: '1m', openTime: t, open, high: open, low: open, close: open, volume: 0 }
}

function step(s: Sym) {
  const t = Date.now()
  const minuteStart = Math.floor(t / CANDLE_MS) * CANDLE_MS
  if (!s.currentCandle || s.currentCandle.openTime !== minuteStart) {
    if (s.currentCandle) {
      s.candles.push(s.currentCandle)
      if (s.candles.length > 500) s.candles.shift()
      s.history.push(s.currentCandle.close)
      if (s.history.length > 50) s.history.shift()
    }
    newCandle(s, minuteStart)
  }
  const recent = s.history.slice(-20)
  let realized = 0
  if (recent.length > 1) {
    const rets = recent.slice(1).map((c, i) => Math.log(c / recent[i]))
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length
    realized = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length)
  }
  const volScale = Math.max(0.5, Math.min(2.2, realized / s.vol || 1))
  const shock = Math.random() < 0.012 ? (Math.random() - 0.5) * 8 : 0
  const z = (Math.random() - 0.5) * 2 + shock
  const ret = s.drift + s.vol * volScale * z + (s.anchor - s.price) / s.anchor * s.meanRevert
  let newPrice = Math.max(0.01, s.price * (1 + ret))
  s.anchor = s.anchor * (1 + s.drift * 0.5) + newPrice * 0.0005
  s.price = newPrice
  s.currentCandle.close = newPrice
  s.currentCandle.high = Math.max(s.currentCandle.high, newPrice)
  s.currentCandle.low = Math.min(s.currentCandle.low, newPrice)
  s.currentCandle.volume += Math.random() * 5000
  s.volume24h = 0.97 * s.volume24h + 0.03 * (s.currentCandle.volume * CANDLE_MS / 1000)
  io.emit('tick', { symbol: s.symbol, price: newPrice, ts: t })
  io.emit('candle', s.currentCandle)
}

const httpServer = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.url && req.url.startsWith('/api/history')) {
    const u = new URL(req.url, 'http://localhost')
    const symbol = u.searchParams.get('symbol') || ''
    const s = SYMS.get(symbol)
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ symbol, candles: s ? s.candles.slice(-300) : [] }))
    return
  }
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ ok: true, service: 'market-data', symbols: Array.from(SYMS.keys()) }))
})

const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

io.on('connection', (socket) => {
  // Send current symbols snapshot
  for (const [sym, s] of SYMS) {
    socket.emit('history', { symbol: sym, candles: s.candles.slice(-300) })
    if (s.currentCandle) socket.emit('candle', s.currentCandle)
    socket.emit('tick', { symbol: sym, price: s.price, ts: Date.now() })
  }

  // App sends the initial symbol list on connect
  socket.on('init-symbols', (data: { symbols: Array<{ symbol: string; price?: number }> }) => {
    if (!data?.symbols) return
    for (const s of data.symbols) {
      addSymbol(s.symbol, s.price)
    }
    console.log(`[market-data] init-symbols: ${data.symbols.map(s => s.symbol).join(', ')}`)
  })

  socket.on('add-symbol', (data: { symbol: string; price?: number }) => {
    if (data?.symbol) addSymbol(data.symbol, data.price)
  })

  socket.on('remove-symbol', (data: { symbol: string }) => {
    if (data?.symbol) removeSymbol(data.symbol)
  })

  socket.on('get-history', ({ symbol }: { symbol: string }) => {
    const s = SYMS.get(symbol)
    if (s) socket.emit('history', { symbol, candles: s.candles.slice(-300) })
  })
})

// Tick every 1.2s per symbol (staggered)
let tickTimer: NodeJS.Timeout | null = null
function startTicker() {
  if (tickTimer) clearInterval(tickTimer)
  let i = 0
  tickTimer = setInterval(() => {
    const syms = Array.from(SYMS.values())
    if (syms.length === 0) return
    const s = syms[i % syms.length]
    step(s)
    i++
  }, 200) // 200ms per symbol = 5 symbols/sec, each gets ticked every ~1s
}
startTicker()

httpServer.listen(PORT, () => {
  console.log(`market-data service running on port ${PORT} (dynamic symbols — no defaults)`)
})
