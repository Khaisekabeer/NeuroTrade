// Bitget Executor — high-level functions for LIVE trading.
// Called by trading-state.ts when mode === 'live'. In paper mode these are
// not called. Each function hits the /api/bitget route (which signs + sends
// the real HTTP request to Bitget).
//
// Exchange-side SL/TP: when opening a live position, we place TWO plan orders
// on Bitget (one stop-loss, one take-profit). Both are reduce-only triggers
// that the EXCHANGE honors even if your bot goes offline. We store their
// orderIds on the Position row so we can cancel them when manually closing.

const SYMBOL_TO_BITGET_SPOT: Record<string, string> = {
  'BTC/USDT': 'BTCUSDT',
  'ETH/USDT': 'ETHUSDT',
  'SOL/USDT': 'SOLUSDT',
  'XRP/USDT': 'XRPUSDT',
  'DOGE/USDT': 'DOGEUSDT',
  'ADA/USDT': 'ADAUSDT',
}

export function toBitgetSymbol(symbol: string): string {
  return SYMBOL_TO_BITGET_SPOT[symbol] ?? symbol.replace('/', '')
}

export interface LiveOrderResult {
  ok: boolean
  orderId?: string
  data?: any
  error?: string
}

async function postBitget(body: any): Promise<any> {
  // This runs server-side (Node.js), so we need an absolute URL.
  // Relative URLs like '/api/bitget' only work in the browser.
  const baseUrl = process.env.NODE_ENV === 'production'
    ? `http://localhost:${process.env.PORT || 3000}`
    : 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/bitget`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return data
}

// Place a market entry order. side = 'buy' for LONG, 'sell' for SHORT.
// For futures, pass product='futures' + marginMode.
export async function placeMarketEntry(
  symbol: string,
  side: 'LONG' | 'SHORT',
  size: number,
  opts?: { product?: 'spot' | 'futures'; tradeSide?: 'open' | 'close'; marginMode?: 'isolated' | 'cross' },
): Promise<LiveOrderResult> {
  try {
    const bgSym = toBitgetSymbol(symbol)
    const bitgetSide = side === 'LONG' ? 'buy' : 'sell'
    const data = await postBitget({
      kind: 'market',
      symbol: bgSym,
      side: bitgetSide,
      orderType: 'market',
      size: String(size),
      product: opts?.product || 'spot',
      tradeSide: opts?.tradeSide || (bitgetSide === 'buy' ? 'open' : 'close'),
      marginMode: opts?.marginMode || 'isolated',
    })
    if (!data?.live) return { ok: false, error: data?.message || data?.error || 'order rejected (no live response)' }
    // Bitget success: { code: "00000", msg: "success", data: { orderId } }
    // Bitget error:   { code: "11001", msg: "size too small", data: null }
    const bg = data?.data
    if (bg?.code && bg.code !== '00000') {
      return { ok: false, error: `Bitget ${bg.code}: ${bg.msg || 'rejected'}`, data: bg }
    }
    const orderId = bg?.data?.orderId || bg?.orderId || bg?.result?.orderId
    if (!orderId) {
      return { ok: false, error: `Bitget response missing orderId: ${JSON.stringify(bg).slice(0, 200)}`, data: bg }
    }
    return { ok: true, orderId, data: bg }
  } catch (e: any) {
    return { ok: false, error: e?.message }
  }
}

// Set leverage for a futures symbol (1-125x). MUST be called before the first
// futures order on each symbol.
export async function setLeverage(symbol: string, leverage: number, marginMode: 'isolated' | 'cross' = 'isolated'): Promise<LiveOrderResult> {
  try {
    const bgSym = toBitgetSymbol(symbol)
    const baseUrl = 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/bitget?action=set-leverage&product=futures&symbol=${bgSym}&leverage=${leverage}&marginMode=${marginMode}`, { cache: 'no-store' })
    const data = await res.json().catch(() => ({}))
    if (!data?.live) return { ok: false, error: data?.message || data?.error || 'set-leverage failed' }
    return { ok: true, data: data.data }
  } catch (e: any) {
    return { ok: false, error: e?.message }
  }
}

// Set margin mode (isolated/crossed) for a futures symbol.
export async function setMarginMode(symbol: string, marginMode: 'isolated' | 'cross'): Promise<LiveOrderResult> {
  try {
    const bgSym = toBitgetSymbol(symbol)
    const baseUrl = 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/bitget?action=set-margin-mode&product=futures&symbol=${bgSym}&marginMode=${marginMode}`, { cache: 'no-store' })
    const data = await res.json().catch(() => ({}))
    if (!data?.live) return { ok: false, error: data?.message || data?.error || 'set-margin-mode failed' }
    return { ok: true, data: data.data }
  } catch (e: any) {
    return { ok: false, error: e?.message }
  }
}

// Place an exchange-side stop-loss or take-profit plan order.
// For a LONG position, the SL/TP are SELL orders triggered when price hits the level.
// For a SHORT position, they are BUY orders.
export async function placeStopOrder(
  symbol: string,
  positionSide: 'LONG' | 'SHORT',
  size: number,
  triggerPrice: number,
  kind: 'sl' | 'tp',
  opts?: { product?: 'spot' | 'futures'; marginMode?: 'isolated' | 'cross' },
): Promise<LiveOrderResult> {
  try {
    const bgSym = toBitgetSymbol(symbol)
    const orderSide = positionSide === 'LONG' ? 'sell' : 'buy'
    const data = await postBitget({
      kind: 'plan',
      symbol: bgSym,
      side: orderSide,
      orderType: 'market',
      triggerPrice: String(triggerPrice),
      size: String(size),
      triggerType: 'fill_price',
      product: opts?.product || 'spot',
      marginMode: opts?.marginMode || 'isolated',
    })
    if (!data?.live) return { ok: false, error: data?.message || data?.error || 'plan order rejected' }
    const orderId = data?.data?.orderId || data?.data?.data?.orderId || data?.data?.result?.orderId
    return { ok: true, orderId, data: data.data }
  } catch (e: any) {
    return { ok: false, error: e?.message }
  }
}

// Cancel an existing plan order (used when manually closing a position before SL/TP hit)
export async function cancelOrder(symbol: string, orderId: string, opts?: { product?: 'spot' | 'futures' }): Promise<LiveOrderResult> {
  try {
    const bgSym = toBitgetSymbol(symbol)
    const data = await postBitget({ kind: 'cancel', symbol: bgSym, orderId, product: opts?.product || 'spot' })
    if (!data?.live) return { ok: false, error: data?.message || data?.error || 'cancel failed' }
    return { ok: true, orderId, data: data.data }
  } catch (e: any) {
    return { ok: false, error: e?.message }
  }
}

// Place a market closing order (opposite side of the entry)
export async function placeMarketClose(symbol: string, positionSide: 'LONG' | 'SHORT', size: number): Promise<LiveOrderResult> {
  // To close a LONG, sell. To close a SHORT, buy.
  const closeSide: 'LONG' | 'SHORT' = positionSide === 'LONG' ? 'SHORT' : 'LONG'
  return placeMarketEntry(symbol, closeSide, size, { tradeSide: 'close' })
}

// Fetch the contract specs (sizeMultiplier, minTradeNum) for futures symbols.
// Bitget's minimum order size varies per symbol:
//   BTC: 0.0001 contracts, ETH: 0.01, SOL: 0.1, XRP/ADA/DOGE: 1
// We must round the order size to the symbol's sizeMultiplier.
const contractSpecsCache = new Map<string, { sizeMultiplier: number; minTradeNum: number }>()
let contractSpecsLoaded = false

export async function loadContractSpecs(): Promise<void> {
  if (contractSpecsLoaded) return
  try {
    const res = await fetch('https://api.bitget.com/api/v2/mix/market/contracts?productType=USDT-FUTURES', { cache: 'no-store' })
    const json = await res.json()
    for (const c of (json?.data || [])) {
      contractSpecsCache.set(c.symbol, {
        sizeMultiplier: parseFloat(c.sizeMultiplier) || 1,
        minTradeNum: parseFloat(c.minTradeNum) || 1,
      })
    }
    contractSpecsLoaded = true
    console.log(`[bitget-executor] loaded ${contractSpecsCache.size} contract specs`)
  } catch (e) {
    console.warn('[bitget-executor] failed to load contract specs:', (e as Error).message)
  }
}

// Round a size to the symbol's contract multiplier + enforce minimum.
// e.g. for SOL (multiplier 0.1, min 0.1): size=0.57 → 0.5, size=0.05 → 0.1 (min)
export function roundToContractSize(symbol: string, size: number): number {
  const bgSym = toBitgetSymbol(symbol)
  const spec = contractSpecsCache.get(bgSym)
  if (!spec) return Math.max(1, Math.floor(size))  // fallback
  const { sizeMultiplier, minTradeNum } = spec
  const rounded = Math.floor(size / sizeMultiplier) * sizeMultiplier
  return Math.max(minTradeNum, rounded)
}


// Supports BOTH spot and futures — pass product='futures' to hit the mix endpoint.
export async function fetchLiveTickers(symbols: string[], product: 'spot' | 'futures' = 'spot'): Promise<Array<{ symbol: string; price: number; ts: number; volume24h: number; change24h: number }>> {
  try {
    const bgSyms = symbols.map(toBitgetSymbol).join(',')
    // spot:  /api/v2/spot/market/tickers?symbols=BTCUSDT,ETHUSDT  (returns array)
    // futures: /api/v2/mix/market/tickers?productType=USDT-FUTURES&symbol=BTCUSDT  (returns single object per call)
    if (product === 'futures') {
      // futures endpoint takes one symbol at a time, so we fetch in parallel
      const results = await Promise.all(symbols.map(async (sym) => {
        const bgSym = toBitgetSymbol(sym)
        try {
          const res = await fetch(`https://api.bitget.com/api/v2/mix/market/tickers?productType=USDT-FUTURES&symbol=${bgSym}`, { cache: 'no-store' })
          const json = await res.json()
          const t = Array.isArray(json?.data) ? json.data[0] : json?.data
          if (!t) return null
          return {
            symbol: sym,
            price: parseFloat(t.lastPr || t.last),
            ts: Date.now(),
            volume24h: parseFloat(t.baseVolume24h || t.quoteVolume24h) || 0,
            change24h: parseFloat(t.change24h) || 0,
          }
        } catch { return null }
      }))
      return results.filter((t): t is NonNullable<typeof t> => t !== null && !isNaN(t.price) && t.price > 0)
    }
    // spot — try batch first, fall back to per-symbol if batch fails/partial
    const reverseMap: Record<string, string> = {}
    for (const k in SYMBOL_TO_BITGET_SPOT) reverseMap[SYMBOL_TO_BITGET_SPOT[k]] = k

    const mapTicker = (t: any) => ({
      symbol: reverseMap[t.symbol] || t.symbol,
      price: parseFloat(t.lastPr),
      ts: Date.now(),
      volume24h: parseFloat(t.quoteVolume24h) || 0,
      change24h: parseFloat(t.change24h) || 0,
    })

    // Try batch request — do NOT use encodeURIComponent (it encodes the comma
    // to %2C which Bitget doesn't parse, causing only the first symbol to return)
    try {
      const res = await fetch(`https://api.bitget.com/api/v2/spot/market/tickers?symbols=${bgSyms}`, { cache: 'no-store' })
      const json = await res.json()
      const arr = (json?.data || []).filter((t: any) => t)
      const mapped = arr.map(mapTicker).filter((t: any) => !isNaN(t.price) && t.price > 0)
      // If we got all symbols, return. Otherwise fall back to per-symbol for missing ones.
      if (mapped.length === symbols.length) return mapped
      // Fall through to per-symbol fetch for missing symbols
      const gotSymbols = new Set(mapped.map((t: any) => t.symbol))
      const missing = symbols.filter(s => !gotSymbols.has(s))
      const extra = await Promise.all(missing.map(async (sym) => {
        try {
          const bgSym = toBitgetSymbol(sym)
          const r = await fetch(`https://api.bitget.com/api/v2/spot/market/tickers?symbols=${bgSym}`, { cache: 'no-store' })
          const j = await r.json()
          const t = Array.isArray(j?.data) ? j.data[0] : j?.data
          if (!t) return null
          return mapTicker(t)
        } catch { return null }
      }))
      return [...mapped, ...extra.filter((t): t is NonNullable<typeof t> => t !== null && !isNaN(t.price) && t.price > 0)]
    } catch {
      // batch failed entirely — fetch each symbol individually
      const results = await Promise.all(symbols.map(async (sym) => {
        try {
          const bgSym = toBitgetSymbol(sym)
          const r = await fetch(`https://api.bitget.com/api/v2/spot/market/tickers?symbols=${bgSym}`, { cache: 'no-store' })
          const j = await r.json()
          const t = Array.isArray(j?.data) ? j.data[0] : j?.data
          if (!t) return null
          return mapTicker(t)
        } catch { return null }
      }))
      return results.filter((t): t is NonNullable<typeof t> => t !== null && !isNaN(t.price) && t.price > 0)
    }
  } catch (e) {
    return []
  }
}

// Fetch real live klines from Bitget (for bootstrapping candle history)
// Supports BOTH spot and futures.
export async function fetchLiveKlines(symbol: string, limit = 200, product: 'spot' | 'futures' = 'spot'): Promise<Array<{ openTime: number; open: number; high: number; low: number; close: number; volume: number }>> {
  try {
    const bgSym = toBitgetSymbol(symbol)
    const path = product === 'futures'
      ? `https://api.bitget.com/api/v2/mix/market/candles?productType=USDT-FUTURES&symbol=${bgSym}&granularity=1m&limit=${limit}`
      : `https://api.bitget.com/api/v2/spot/market/candles?symbol=${bgSym}&granularity=1m&limit=${limit}`
    const res = await fetch(path, { cache: 'no-store' })
    const json = await res.json()
    const arr = json?.data || []
    // Bitget returns [ts, open, high, low, close, volume, ...] newest-first
    return arr.reverse().map((k: any[]) => ({
      openTime: parseInt(k[0]),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    })).filter((k: any) => !isNaN(k.close))
  } catch (e) {
    return []
  }
}
