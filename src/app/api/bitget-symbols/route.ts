import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Fetch ALL available Bitget symbols (spot + futures) for the searchable dropdown.
// Cached for 5 minutes to avoid hitting the API on every search.
const BITGET_HOST = 'https://api.bitget.com'

interface SymbolInfo {
  symbol: string      // "BTC/USDT"
  base: string        // "BTC"
  name: string        // "BTC"
  price: number
  product: 'spot' | 'futures'
}

let cache: { symbols: SymbolInfo[]; ts: number } | null = null
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const query = (searchParams.get('q') || '').toLowerCase().trim()
  const product = searchParams.get('product') || 'all' // spot | futures | all

  // Return from cache if fresh
  if (!cache || Date.now() - cache.ts > CACHE_TTL) {
    try {
      const symbols: SymbolInfo[] = []

      // Fetch spot symbols
      const spotRes = await fetch(`${BITGET_HOST}/api/v2/spot/market/tickers`, { cache: 'no-store' })
      const spotJson = await spotRes.json()
      for (const t of (spotJson?.data || [])) {
        if (t.symbol && t.symbol.endsWith('USDT')) {
          const base = t.symbol.replace('USDT', '')
          symbols.push({
            symbol: `${base}/USDT`,
            base,
            name: base,
            price: parseFloat(t.lastPr) || 0,
            product: 'spot',
          })
        }
      }

      // Fetch futures symbols (to mark which ones have futures)
      try {
        const futRes = await fetch(`${BITGET_HOST}/api/v2/mix/market/contracts?productType=USDT-FUTURES`, { cache: 'no-store' })
        const futJson = await futRes.json()
        const futBases = new Set((futJson?.data || []).map((c: any) => (c.symbol || '').replace('USDT', '')))
        // Mark spot symbols that also have futures
        for (const s of symbols) {
          if (futBases.has(s.base)) {
            (s as any).futures = true
          }
        }
      } catch {
        // ignore futures fetch failure
      }

      cache = { symbols, ts: Date.now() }
    } catch (e) {
      // If fetch fails and we have stale cache, use it
      if (cache) {
        // use stale cache
      } else {
        return NextResponse.json({ ok: false, error: 'Failed to fetch symbols from Bitget', symbols: [] }, { status: 502 })
      }
    }
  }

  let result = cache!.symbols

  // Filter by product
  if (product === 'futures') {
    result = result.filter(s => (s as any).futures)
  } else if (product === 'spot') {
    result = result.filter(s => s.product === 'spot')
  }

  // Filter by search query
  if (query) {
    result = result.filter(s =>
      s.symbol.toLowerCase().includes(query) ||
      s.base.toLowerCase().includes(query) ||
      s.name.toLowerCase().includes(query)
    )
  }

  // Sort: most popular first (BTC, ETH, SOL, XRP, etc.) then alphabetical
  const popular = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'BNB', 'AVAX', 'LINK', 'MATIC', 'DOT', 'LTC', 'TRX', 'ATOM', 'NEAR', 'APT', 'ARB', 'OP', 'INJ', 'SUI']
  result.sort((a, b) => {
    const aIdx = popular.indexOf(a.base)
    const bIdx = popular.indexOf(b.base)
    if (aIdx >= 0 && bIdx >= 0) return aIdx - bIdx
    if (aIdx >= 0) return -1
    if (bIdx >= 0) return 1
    return a.base.localeCompare(b.base)
  })

  // Limit to 100 results for performance
  return NextResponse.json({
    ok: true,
    symbols: result.slice(0, 100),
    total: result.length,
  })
}
