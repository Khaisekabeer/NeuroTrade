import { NextResponse } from 'next/server'
import { logApiCall } from '../debug/route'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Bitget integration layer — supports BOTH spot and futures (USDT-margined
// swaps). The productType is selectable per request via ?product=spot|futures
// (default: spot). Public market data is fetched LIVE; authenticated actions
// (balance, place order) require API keys in env vars.
// EVERY call is logged to /api/debug so the dashboard's API Monitor panel
// can show exactly what was sent + received.

const BITGET_HOST = 'https://api.bitget.com'

function keysConfigured() {
  return !!(process.env.BITGET_API_KEY && process.env.BITGET_API_SECRET && process.env.BITGET_API_PASSPHRASE)
}

async function sign(timestamp: string, method: string, requestPath: string, body: string) {
  const crypto = await import('crypto')
  const secret = process.env.BITGET_API_SECRET!
  const prehash = `${timestamp}${method.toUpperCase()}${requestPath}${body}`
  return crypto.createHmac('sha256', secret).update(prehash).digest('base64')
}

async function bitgetPublic(path: string) {
  const t0 = Date.now()
  const res = await fetch(`${BITGET_HOST}${path}`, { headers: { 'Content-Type': 'application/json' }, cache: 'no-store' })
  const data = await res.json()
  logApiCall({
    method: 'GET', endpoint: path, product: path.includes('/mix/') ? 'futures' : 'spot',
    kind: 'public', request: null, response: data, ok: res.ok, durationMs: Date.now() - t0,
  })
  return data
}

async function bitgetSigned(method: string, requestPath: string, body: string) {
  const t0 = Date.now()
  const ts = Date.now().toString()
  const signStr = await sign(ts, method, requestPath, body)
  const headers = {
    'Content-Type': 'application/json',
    'ACCESS-KEY': process.env.BITGET_API_KEY!,
    'ACCESS-SIGN': signStr,
    'ACCESS-TIMESTAMP': ts,
    'ACCESS-PASSPHRASE': process.env.BITGET_API_PASSPHRASE!,
    'locale': 'en-US',
  }
  const res = await fetch(`${BITGET_HOST}${requestPath}`, { method, headers, body: body || undefined, cache: 'no-store' })
  const data = await res.json()
  logApiCall({
    method, endpoint: requestPath,
    product: requestPath.includes('/mix/') ? 'futures' : 'spot',
    kind: 'signed',
    request: body ? JSON.parse(body) : null,
    response: data, ok: res.ok, durationMs: Date.now() - t0,
  })
  return data
}

// Normalize the product param. Bitget v2 uses:
//   spot    → /api/v2/spot/...
//   futures → /api/v2/mix/...  (USDT-margined swaps, productType=USDT-FUTURES)
function productPath(product: string): 'spot' | 'mix' {
  return product === 'futures' ? 'mix' : 'spot'
}
function productType(product: string): string {
  return product === 'futures' ? 'USDT-FUTURES' : 'SPOT'
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action') || 'status'
  const product = searchParams.get('product') || 'spot' // spot | futures
  const p = productPath(product)
  const pt = productType(product)
  try {
    if (action === 'status') {
      return NextResponse.json({
        connected: keysConfigured(),
        host: BITGET_HOST,
        publicApi: true,
        authenticatedApi: keysConfigured(),
        product,
        message: keysConfigured()
          ? `Bitget API keys detected — ${product} trading enabled.`
          : `Public ${product} market data is LIVE. Add BITGET_API_KEY / SECRET / PASSPHRASE env vars to enable live order execution.`,
      })
    }
    if (action === 'tickers') {
      const symbols = (searchParams.get('symbols') || 'BTCUSDT,ETHUSDT,SOLUSDT').split(',').filter(Boolean)
      const sym = symbols.join(',')
      const path = p === 'spot'
        ? `/api/v2/spot/market/tickers?symbols=${encodeURIComponent(sym)}`
        : `/api/v2/mix/market/tickers?productType=${pt}&symbol=${encodeURIComponent(symbols[0])}`
      const data = await bitgetPublic(path)
      return NextResponse.json({ live: true, source: `bitget-public-${product}`, product, data })
    }
    if (action === 'klines') {
      const symbol = searchParams.get('symbol') || 'BTCUSDT'
      const granularity = searchParams.get('granularity') || '1m'
      const limit = searchParams.get('limit') || '200'
      const path = p === 'spot'
        ? `/api/v2/spot/market/candles?symbol=${symbol}&granularity=${granularity}&limit=${limit}`
        : `/api/v2/mix/market/candles?productType=${pt}&symbol=${symbol}&granularity=${granularity}&limit=${limit}`
      const data = await bitgetPublic(path)
      return NextResponse.json({ live: true, source: `bitget-public-${product}`, symbol, product, data })
    }
    if (action === 'balance') {
      if (!keysConfigured()) {
        return NextResponse.json({
          live: false,
          configured: false,
          message: `API keys not set. In production this calls GET /api/v2/${p}/account/${p === 'spot' ? 'info' : 'accounts'} with HMAC-SHA256 signed headers.`,
          product,
        }, { status: 400 })
      }
      // spot → /api/v2/spot/account/info (returns assets array)
      // futures → /api/v2/mix/account/accounts?productType=USDT-FUTURES (returns accounts)
      const requestPath = p === 'spot'
        ? '/api/v2/spot/account/info'
        : `/api/v2/mix/account/accounts?productType=${pt}`
      const data = await bitgetSigned('GET', requestPath, '')
      // Normalize the response into a simple { assets: [{coin, available, frozen, total}] } shape
      let assets: any[] = []
      if (p === 'spot' && Array.isArray(data?.data)) {
        // Bitget spot account/info returns: [{ coin, available, frozen, limitAvailable, borrowed, uTime }]
        // NOTE: there is NO 'total' field — total = available + frozen
        assets = data.data
          .map((a: any) => {
            const available = parseFloat(a.available || a.free || '0') || 0
            const frozen = parseFloat(a.frozen || a.locked || a.limitAvailable || '0') || 0
            return {
              coin: a.coin,
              available,
              frozen,
              total: available + frozen,
            }
          })
          // only show assets where you actually hold something (> 0)
          .filter((a: any) => a.total > 0)
      } else if (p === 'mix' && Array.isArray(data?.data)) {
        for (const a of data.data) {
          const available = parseFloat(a.available || '0') || 0
          const frozen = parseFloat(a.frozen || '0') || 0
          assets.push({
            coin: a.marginCoin || 'USDT',
            available,
            frozen,
            total: parseFloat(a.equity || '0') || available + frozen,
            margin: parseFloat(a.margin || '0') || 0,
            unrealizedPL: parseFloat(a.unrealizedPL || '0') || 0,
          })
        }
      }
      return NextResponse.json({ live: true, configured: true, product, assets, raw: data })
    }
    if (action === 'positions') {
      // futures only — open positions
      if (!keysConfigured()) {
        return NextResponse.json({ live: false, configured: false, message: 'API keys not set' }, { status: 400 })
      }
      const data = await bitgetSigned('GET', `/api/v2/mix/position/current-position?productType=${pt}`, '')
      return NextResponse.json({ live: true, configured: true, product, data })
    }
    if (action === 'set-leverage') {
      // futures only — set leverage for a symbol
      if (!keysConfigured()) {
        return NextResponse.json({ live: false, configured: false, message: 'API keys not set' }, { status: 400 })
      }
      const symbol = searchParams.get('symbol') || 'BTCUSDT'
      const leverage = searchParams.get('leverage') || '10'
      // Bitget expects 'isolated' or 'crossed' (NOT 'cross')
      const rawMarginMode = searchParams.get('marginMode') || 'isolated'
      const marginMode = rawMarginMode === 'cross' ? 'crossed' : rawMarginMode
      const requestPath = `/api/v2/mix/account/set-leverage?productType=${pt}`
      const payload = JSON.stringify({
        symbol,
        marginMode,  // 'isolated' or 'crossed'
        leverage: String(leverage),
        productType: pt,
      })
      const data = await bitgetSigned('POST', requestPath, payload)
      return NextResponse.json({ live: true, configured: true, product, action: 'set-leverage', data })
    }
    if (action === 'set-margin-mode') {
      // futures only — set margin mode (isolated/cross)
      if (!keysConfigured()) {
        return NextResponse.json({ live: false, configured: false, message: 'API keys not set' }, { status: 400 })
      }
      const symbol = searchParams.get('symbol') || 'BTCUSDT'
      const marginMode = searchParams.get('marginMode') === 'cross' ? 'crossed' : 'isolated'
      const requestPath = `/api/v2/mix/account/set-margin-mode?productType=${pt}`
      const payload = JSON.stringify({ symbol, marginMode, productType: pt })
      const data = await bitgetSigned('POST', requestPath, payload)
      return NextResponse.json({ live: true, configured: true, product, action: 'set-margin-mode', data })
    }
    return NextResponse.json({ error: 'unknown action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ live: false, error: e?.message || 'bitget request failed' }, { status: 502 })
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const product = body.product || 'spot'
  const p = productPath(product)
  const pt = productType(product)
  const kind = body.kind || 'market'

  if (!keysConfigured()) {
    return NextResponse.json({
      live: false,
      configured: false,
      message: 'BITGET_API_KEY / SECRET / PASSPHRASE env vars not set. Set them in .env to enable live trading.',
    }, { status: 400 })
  }

  try {
    if (kind === 'cancel') {
      const requestPath = p === 'spot'
        ? '/api/v2/spot/trade/cancel-order'
        : `/api/v2/mix/order/cancel-order?productType=${pt}`
      const payload = p === 'spot'
        ? JSON.stringify({ symbol: body.symbol, orderId: body.orderId })
        : JSON.stringify({ symbol: body.symbol, orderId: body.orderId, productType: pt })
      const data = await bitgetSigned('POST', requestPath, payload)
      return NextResponse.json({ live: true, configured: true, product, action: 'cancel', data })
    }

    if (kind === 'plan') {
      // SL/TP trigger order
      const requestPath = p === 'spot'
        ? '/api/v2/spot/trade/place-plan-order'
        : `/api/v2/mix/order/place-plan-order?productType=${pt}`
      // Bitget futures requires marginMode ('isolated' or 'crossed')
      const rawMm = body.marginMode || 'isolated'
      const futuresMarginMode = rawMm === 'cross' ? 'crossed' : rawMm
      const payload = p === 'spot'
        ? JSON.stringify({
            symbol: body.symbol, side: body.side,
            orderType: body.orderType || 'limit',
            triggerPrice: String(body.triggerPrice),
            executePrice: body.executePrice ? String(body.executePrice) : undefined,
            size: String(body.size),
            triggerType: body.triggerType || 'fill_price',
            force: 'gtc',
          })
        : JSON.stringify({
            symbol: body.symbol, side: body.side,
            orderType: body.orderType || 'limit',
            triggerPrice: String(body.triggerPrice),
            executePrice: body.executePrice ? String(body.executePrice) : undefined,
            size: String(body.size),
            triggerType: body.triggerType || 'fill_price',
            productType: pt,
            marginMode: futuresMarginMode,
            marginCoin: body.marginCoin || 'USDT',  // required for USDT-margined futures
            reduceOnly: true,  // SL/TP are always reduce-only
            force: 'gtc',
          })
      const data = await bitgetSigned('POST', requestPath, payload)
      return NextResponse.json({ live: true, configured: true, product, action: 'plan', data })
    }

    // market/limit entry order
    const requestPath = p === 'spot'
      ? '/api/v2/spot/trade/place-order'
      : `/api/v2/mix/order/place-order?productType=${pt}`
    // Bitget futures requires marginMode ('isolated' or 'crossed') + marginCoin ('USDT')
    const rawMm = body.marginMode || 'isolated'
    const futuresMarginMode = rawMm === 'cross' ? 'crossed' : rawMm
    const payload = p === 'spot'
      ? JSON.stringify({
          symbol: body.symbol, side: body.side,
          orderType: body.orderType || 'market',
          size: String(body.size),
          ...(body.price ? { price: String(body.price) } : {}),
          force: body.force || 'gtc',
        })
      : JSON.stringify({
          symbol: body.symbol, side: body.side,
          orderType: body.orderType || 'market',
          size: String(body.size),
          ...(body.price ? { price: String(body.price) } : {}),
          productType: pt,
          marginMode: futuresMarginMode,
          marginCoin: body.marginCoin || 'USDT',  // required for USDT-margined futures
          tradeSide: body.tradeSide || (body.side === 'buy' ? 'open' : 'close'),
          reduceOnly: body.tradeSide === 'close',  // closing orders are reduce-only
          force: body.force || 'gtc',
        })
    const data = await bitgetSigned('POST', requestPath, payload)
    return NextResponse.json({ live: true, configured: true, product, action: 'market', data })
  } catch (e: any) {
    return NextResponse.json({ live: false, error: e?.message || 'bitget request failed' }, { status: 502 })
  }
}
