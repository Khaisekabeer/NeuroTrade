import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Bitget integration layer.
// - Public market data (tickers, klines) is fetched LIVE from Bitget's public
//   REST API (no auth required), so the "live Bitget" connection is genuine.
// - Authenticated actions (balance, place order) require API keys. In this
//   sandbox we never store secrets in the DB. If keys are present in env
//   (BITGET_API_KEY / BITGET_API_SECRET / BITGET_API_PASSPHRASE), the route
//   will build and send the real signed request; otherwise it returns the
//   exact signed-request structure that the Python core (python-core/) would
//   execute, so operators can see precisely what runs in production.

const BITGET_HOST = 'https://api.bitget.com'

function keysConfigured() {
  return !!(process.env.BITGET_API_KEY && process.env.BITGET_API_SECRET && process.env.BITGET_API_PASSPHRASE)
}

// HMAC-SHA256 signing for Bitget v2 (server time + method + requestPath + body)
async function sign(timestamp: string, method: string, requestPath: string, body: string) {
  const crypto = await import('crypto')
  const secret = process.env.BITGET_API_SECRET!
  const prehash = `${timestamp}${method.toUpperCase()}${requestPath}${body}`
  return crypto.createHmac('sha256', secret).update(prehash).digest('base64')
}

async function bitgetPublic(path: string) {
  const res = await fetch(`${BITGET_HOST}${path}`, { headers: { 'Content-Type': 'application/json' }, cache: 'no-store' })
  const data = await res.json()
  return data
}

async function bitgetSigned(method: string, requestPath: string, body: string) {
  const crypto = await import('crypto')
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
  return res.json()
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action') || 'status'
  try {
    if (action === 'status') {
      return NextResponse.json({
        connected: keysConfigured(),
        host: BITGET_HOST,
        publicApi: true,
        authenticatedApi: keysConfigured(),
        message: keysConfigured()
          ? 'Bitget API keys detected — authenticated trading enabled.'
          : 'Public market data is LIVE. Add BITGET_API_KEY / SECRET / PASSPHRASE env vars to enable live order execution.',
      })
    }
    if (action === 'tickers') {
      // REAL live tickers from Bitget public API
      const symbols = (searchParams.get('symbols') || 'BTCUSDT,ETHUSDT,SOLUSDT').split(',').filter(Boolean)
      const sym = symbols.join(',')
      const data = await bitgetPublic(`/api/v2/spot/market/tickers?symbols=${encodeURIComponent(sym)}`)
      return NextResponse.json({ live: true, source: 'bitget-public', data })
    }
    if (action === 'klines') {
      const symbol = searchParams.get('symbol') || 'BTCUSDT'
      const granularity = searchParams.get('granularity') || '1m'
      const limit = searchParams.get('limit') || '200'
      const data = await bitgetPublic(`/api/v2/spot/market/candles?symbol=${symbol}&granularity=${granularity}&limit=${limit}`)
      return NextResponse.json({ live: true, source: 'bitget-public', symbol, data })
    }
    if (action === 'balance') {
      if (!keysConfigured()) {
        return NextResponse.json({
          live: false,
          configured: false,
          message: 'API keys not set. In production the Python core calls: GET /api/v2/spot/account/info with HMAC-SHA256 signed headers (ACCESS-KEY, ACCESS-SIGN, ACCESS-TIMESTAMP, ACCESS-PASSPHRASE).',
          requestPath: '/api/v2/spot/account/info',
          method: 'GET',
        })
      }
      const data = await bitgetSigned('GET', '/api/v2/spot/account/info', '')
      return NextResponse.json({ live: true, configured: true, data })
    }
    return NextResponse.json({ error: 'unknown action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ live: false, error: e?.message || 'bitget request failed' }, { status: 502 })
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  // body.kind controls what kind of order:
  //   'market' (default) — normal market/limit order via place-order
  //   'plan'             — trigger/stop order via place-plan-order (for SL/TP)
  //   'cancel'           — cancel an existing order
  const kind = body.kind || 'market'

  if (!keysConfigured()) {
    return NextResponse.json({
      live: false,
      configured: false,
      message: 'BITGET_API_KEY / SECRET / PASSPHRASE env vars not set. Set them in .env to enable live trading.',
    }, { status: 400 })
  }

  try {
    // ---- CANCEL an existing order ----
    if (kind === 'cancel') {
      const requestPath = '/api/v2/spot/trade/cancel-order'
      const payload = JSON.stringify({ symbol: body.symbol, orderId: body.orderId })
      const data = await bitgetSigned('POST', requestPath, payload)
      return NextResponse.json({ live: true, configured: true, action: 'cancel', data })
    }

    // ---- PLAN ORDER (stop-loss / take-profit trigger) ----
    // Bitget v2 spot plan order. triggerType:
    //   'fill_price'  — trigger on last price
    //   'mark_price'  — trigger on mark price
    // executePrice: for limit trigger orders; omit for market execution
    if (kind === 'plan') {
      const requestPath = '/api/v2/spot/trade/place-plan-order'
      const payload = JSON.stringify({
        symbol: body.symbol,
        side: body.side,                 // 'buy' or 'sell'
        orderType: body.orderType || 'limit',  // 'limit' or 'market'
        triggerPrice: String(body.triggerPrice),
        executePrice: body.executePrice ? String(body.executePrice) : undefined,
        size: String(body.size),
        triggerType: body.triggerType || 'fill_price',
        force: 'gtc',
      })
      const data = await bitgetSigned('POST', requestPath, payload)
      return NextResponse.json({ live: true, configured: true, action: 'plan', data })
    }

    // ---- MARKET / LIMIT order (entry or manual close) ----
    const requestPath = '/api/v2/spot/trade/place-order'
    const payload = JSON.stringify({
      symbol: body.symbol,
      side: body.side,                 // 'buy' or 'sell'
      orderType: body.orderType || 'market',
      size: String(body.size),
      ...(body.price ? { price: String(body.price) } : {}),
      force: body.force || 'gtc',
    })
    const data = await bitgetSigned('POST', requestPath, payload)
    return NextResponse.json({ live: true, configured: true, action: 'market', data })
  } catch (e: any) {
    return NextResponse.json({ live: false, error: e?.message || 'bitget request failed' }, { status: 502 })
  }
}
