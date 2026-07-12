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
  const res = await fetch('/api/bitget', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return data
}

// Place a market entry order. side = 'buy' for LONG, 'sell' for SHORT.
// Returns the Bitget orderId so we can track it.
export async function placeMarketEntry(symbol: string, side: 'LONG' | 'SHORT', size: number): Promise<LiveOrderResult> {
  try {
    const bgSym = toBitgetSymbol(symbol)
    const bitgetSide = side === 'LONG' ? 'buy' : 'sell'
    const data = await postBitget({ kind: 'market', symbol: bgSym, side: bitgetSide, orderType: 'market', size: String(size) })
    if (!data?.live) return { ok: false, error: data?.message || data?.error || 'order rejected' }
    // Bitget returns orderId in data.data.orderId
    const orderId = data?.data?.orderId || data?.data?.data?.orderId || data?.data?.result?.orderId
    return { ok: true, orderId, data: data.data }
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
    })
    if (!data?.live) return { ok: false, error: data?.message || data?.error || 'plan order rejected' }
    const orderId = data?.data?.orderId || data?.data?.data?.orderId || data?.data?.result?.orderId
    return { ok: true, orderId, data: data.data }
  } catch (e: any) {
    return { ok: false, error: e?.message }
  }
}

// Cancel an existing plan order (used when manually closing a position before SL/TP hit)
export async function cancelOrder(symbol: string, orderId: string): Promise<LiveOrderResult> {
  try {
    const bgSym = toBitgetSymbol(symbol)
    const data = await postBitget({ kind: 'cancel', symbol: bgSym, orderId })
    if (!data?.live) return { ok: false, error: data?.message || data?.error || 'cancel failed' }
    return { ok: true, orderId, data: data.data }
  } catch (e: any) {
    return { ok: false, error: e?.message }
  }
}

// Place a market closing order (opposite side of the entry)
export async function placeMarketClose(symbol: string, positionSide: 'LONG' | 'SHORT', size: number): Promise<LiveOrderResult> {
  const closeSide = positionSide === 'LONG' ? 'sell' : 'buy'
  return placeMarketEntry(symbol, closeSide === 'LONG' ? 'LONG' : 'SHORT', size)
  // (placeMarketEntry translates LONG→buy, SHORT→sell; for a close we pass the
  //  opposite side, so a LONG close sends a 'sell' market order.)
}

// Fetch real live tickers from Bitget public API (no auth needed).
// Used by the live price-polling loop in trading-state when LIVE_PRICES=true.
export async function fetchLiveTickers(symbols: string[]): Promise<Array<{ symbol: string; price: number; ts: number; volume24h: number; change24h: number }>> {
  try {
    const bgSyms = symbols.map(toBitgetSymbol).join(',')
    const res = await fetch(`https://api.bitget.com/api/v2/spot/market/tickers?symbols=${encodeURIComponent(bgSyms)}`, { cache: 'no-store' })
    const json = await res.json()
    const arr = json?.data || []
    // reverse-map Bitget symbol → our symbol
    const reverseMap: Record<string, string> = {}
    for (const k in SYMBOL_TO_BITGET_SPOT) reverseMap[SYMBOL_TO_BITGET_SPOT[k]] = k
    return arr.map((t: any) => ({
      symbol: reverseMap[t.symbol] || t.symbol,
      price: parseFloat(t.lastPr),
      ts: Date.now(),
      volume24h: parseFloat(t.quoteVolume24h) || 0,
      change24h: parseFloat(t.change24h) || 0,
    })).filter((t: any) => !isNaN(t.price) && t.price > 0)
  } catch (e) {
    return []
  }
}

// Fetch real live klines from Bitget (for bootstrapping candle history)
export async function fetchLiveKlines(symbol: string, limit = 200): Promise<Array<{ openTime: number; open: number; high: number; low: number; close: number; volume: number }>> {
  try {
    const bgSym = toBitgetSymbol(symbol)
    const res = await fetch(`https://api.bitget.com/api/v2/spot/market/candles?symbol=${bgSym}&granularity=1m&limit=${limit}`, { cache: 'no-store' })
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
