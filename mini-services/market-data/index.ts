// Market-data microservice — single source of truth for simulated crypto prices.
// Streams 1m candles + ticks for BTC/USDT, ETH/USDT, SOL/USDT over Socket.IO
// on port 3003. Uses a geometric-brownian-motion + mean-reversion + occasional
// shock model so the price action looks realistic (trends, volatility clusters,
// news-like spikes) for the trading agents to react to.
//
// IMPORTANT: path MUST be '/' so the Caddy gateway forwards correctly.
// Frontend connects via io("/?XTransformPort=3003").

import { createServer } from 'http'
import { Server } from 'socket.io'

const PORT = 3003

interface Sym {
  symbol: string
  price: number
  base: string
  drift: number       // per-tick drift
  vol: number         // per-tick volatility
  meanRevert: number  // pull toward anchor
  anchor: number
  history: number[]   // recent closes for vol clustering
  candles: any[]
  currentCandle: any
  volume24h: number
  open24h: number
}

const SYMS: Sym[] = [
  { symbol: 'BTC/USDT', base: 'BTC', price: 67250, drift: 0.00002, vol: 0.0009, meanRevert: 0.002, anchor: 67000, history: [], candles: [], currentCandle: null, volume24h: 18e9, open24h: 66500 },
  { symbol: 'ETH/USDT', base: 'ETH', price: 3480, drift: 0.00003, vol: 0.0011, meanRevert: 0.002, anchor: 3460, history: [], candles: [], currentCandle: null, volume24h: 9e9, open24h: 3440 },
  { symbol: 'SOL/USDT', base: 'SOL', price: 168.4, drift: 0.00005, vol: 0.0016, meanRevert: 0.003, anchor: 167, history: [], candles: [], currentCandle: null, volume24h: 3.5e9, open24h: 164 },
  { symbol: 'XRP/USDT', base: 'XRP', price: 0.62, drift: 0.00004, vol: 0.0014, meanRevert: 0.003, anchor: 0.615, history: [], candles: [], currentCandle: null, volume24h: 1.2e9, open24h: 0.61 },
  { symbol: 'DOGE/USDT', base: 'DOGE', price: 0.14, drift: 0.00005, vol: 0.0018, meanRevert: 0.003, anchor: 0.139, history: [], candles: [], currentCandle: null, volume24h: 0.8e9, open24h: 0.138 },
  { symbol: 'ADA/USDT', base: 'ADA', price: 0.45, drift: 0.00004, vol: 0.0015, meanRevert: 0.003, anchor: 0.448, history: [], candles: [], currentCandle: null, volume24h: 0.6e9, open24h: 0.44 },
]

const CANDLE_MS = 60_000 // 1 minute

// seed initial candle history (300 candles)
function seed() {
  const now = Date.now()
  for (const s of SYMS) {
    let p = s.price * 0.985
    for (let i = 299; i >= 0; i--) {
      const open = p
      // GBM step
      const shock = (Math.random() - 0.5) * 2
      const ret = s.drift + s.vol * shock + (s.anchor - p) / s.anchor * s.meanRevert
      const close = Math.max(0.01, open * (1 + ret))
      const high = Math.max(open, close) * (1 + Math.random() * 0.0012)
      const low = Math.min(open, close) * (1 - Math.random() * 0.0012)
      const volume = (s.base === 'BTC' ? 8e5 : s.base === 'ETH' ? 4e6 : 5e7) * (0.6 + Math.random())
      s.candles.push({ symbol: s.symbol, timeframe: '1m', openTime: now - i * CANDLE_MS, open, high, low, close, volume })
      p = close
    }
    s.price = s.candles[s.candles.length - 1].close
    s.anchor = s.price
    s.open24h = s.candles[Math.max(0, s.candles.length - 1440)]?.open ?? s.price
    s.currentCandle = null
  }
}
seed()

function newCandle(s: Sym, t: number) {
  const open = s.price
  s.currentCandle = { symbol: s.symbol, timeframe: '1m', openTime: t, open, high: open, low: open, close: open, volume: 0 }
}

function step(s: Sym) {
  const t = Date.now()
  // ensure current candle exists for this minute
  const minuteStart = Math.floor(t / CANDLE_MS) * CANDLE_MS
  if (!s.currentCandle || s.currentCandle.openTime !== minuteStart) {
    // close previous candle, push, trim
    if (s.currentCandle) {
      s.candles.push(s.currentCandle)
      if (s.candles.length > 500) s.candles.shift()
      s.history.push(s.currentCandle.close)
      if (s.history.length > 50) s.history.shift()
    }
    newCandle(s, minuteStart)
  }
  // volatility clustering: scale vol by recent realized range
  const recent = s.history.slice(-20)
  let realized = 0
  if (recent.length > 1) {
    const rets = recent.slice(1).map((c, i) => Math.log(c / recent[i]))
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length
    realized = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length)
  }
  const volScale = Math.max(0.5, Math.min(2.2, realized / s.vol || 1))
  // occasional shock (news)
  const shock = Math.random() < 0.012 ? (Math.random() - 0.5) * 8 : 0
  const z = (Math.random() - 0.5) * 2 + shock
  const ret = s.drift + s.vol * volScale * z + (s.anchor - s.price) / s.anchor * s.meanRevert
  let newPrice = Math.max(0.01, s.price * (1 + ret))
  // slowly drift the anchor so we get trends
  s.anchor = s.anchor * (1 + s.drift * 0.5) + newPrice * 0.0005
  s.price = newPrice
  // update candle
  s.currentCandle.close = newPrice
  s.currentCandle.high = Math.max(s.currentCandle.high, newPrice)
  s.currentCandle.low = Math.min(s.currentCandle.low, newPrice)
  s.currentCandle.volume += Math.random() * (s.base === 'BTC' ? 5000 : s.base === 'ETH' ? 25000 : 3e5)
  s.volume24h = 0.97 * s.volume24h + 0.03 * (s.currentCandle.volume * CANDLE_MS / 1000)
  // broadcast
  io.emit('tick', { symbol: s.symbol, price: newPrice, ts: t })
  io.emit('candle', s.currentCandle)
}

const httpServer = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.url && req.url.startsWith('/api/history')) {
    const u = new URL(req.url, 'http://localhost')
    const symbol = u.searchParams.get('symbol') || 'BTC/USDT'
    const s = SYMS.find((x) => x.symbol === symbol)
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ symbol, candles: s ? s.candles.slice(-300) : [] }))
    return
  }
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ ok: true, service: 'market-data', symbols: SYMS.map((s) => s.symbol) }))
})

const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

io.on('connection', (socket) => {
  // send full snapshot on connect
  for (const s of SYMS) {
    socket.emit('history', { symbol: s.symbol, candles: s.candles.slice(-300) })
    if (s.currentCandle) socket.emit('candle', s.currentCandle)
    socket.emit('tick', { symbol: s.symbol, price: s.price, ts: Date.now() })
  }
  socket.on('get-history', ({ symbol }: { symbol: string }) => {
    const s = SYMS.find((x) => x.symbol === symbol)
    if (s) socket.emit('history', { symbol: s.symbol, candles: s.candles.slice(-300) })
  })
})

// tick every 1.2s per symbol (staggered)
SYMS.forEach((s, i) => {
  setTimeout(() => {
    setInterval(() => step(s), 1200)
  }, i * 400)
})

httpServer.listen(PORT, () => {
  console.log(`market-data service running on port ${PORT}`)
})
