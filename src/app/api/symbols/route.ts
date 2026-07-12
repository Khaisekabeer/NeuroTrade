import { NextResponse } from 'next/server'
import { TRADE_SYMBOLS, addSymbol, removeSymbol } from '@/lib/types'
import { fetchLiveTickers } from '@/lib/bitget-executor'
import { seedNewSymbol, manualClose } from '@/lib/trading-state'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET → returns the current list of trading symbols
export async function GET() {
  return NextResponse.json({ symbols: TRADE_SYMBOLS })
}

// POST { action: 'add'|'remove', symbol: 'AVAX/USDT' }
//   add: fetches the live price from Bitget, adds to the list
//   remove: removes from the list (also closes any open position)
export async function POST(req: Request) {
  const { action, symbol } = await req.json().catch(() => ({}))
  if (!symbol || !symbol.includes('/')) {
    return NextResponse.json({ ok: false, error: 'symbol must be like "AVAX/USDT"' }, { status: 400 })
  }
  const base = symbol.split('/')[0]
  const bgSym = symbol.replace('/', '')  // AVAXUSDT

  if (action === 'remove') {
    // Close any open position for this symbol BEFORE removing it from the list.
    // This prevents the bot from trading a removed symbol via leftover positions.
    try {
      await manualClose(symbol)
    } catch (e) {
      // ignore — may not have an open position
    }
    removeSymbol(symbol)
    return NextResponse.json({ ok: true, symbols: TRADE_SYMBOLS, message: `Removed ${symbol} (position closed if open)` })
  }

  if (action === 'add') {
    // Check it's not already present
    if (TRADE_SYMBOLS.find((s) => s.symbol === symbol)) {
      return NextResponse.json({ ok: false, error: `${symbol} is already in the list` }, { status: 400 })
    }
    // Fetch the live price from Bitget to verify the symbol exists
    try {
      let price = 0
      const spotTicks = await fetchLiveTickers([symbol], 'spot')
      if (spotTicks.length > 0) {
        price = spotTicks[0].price
      } else {
        const futTicks = await fetchLiveTickers([symbol], 'futures')
        if (futTicks.length === 0) {
          return NextResponse.json({ ok: false, error: `${symbol} not found on Bitget spot or futures` }, { status: 400 })
        }
        price = futTicks[0].price
      }
      addSymbol({
        symbol,
        name: base,
        base,
        price,
        change24h: 0,
        volume24h: 0,
      })
      // seed the in-memory tick + candle buffer so the dashboard shows it
      seedNewSymbol(symbol, price)
      return NextResponse.json({ ok: true, symbols: TRADE_SYMBOLS, message: `Added ${symbol} at $${price}` })
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: `Failed to verify ${symbol}: ${e?.message}` }, { status: 502 })
    }
  }

  return NextResponse.json({ ok: false, error: 'action must be add or remove' }, { status: 400 })
}
