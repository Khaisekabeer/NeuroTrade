import { NextResponse } from 'next/server'
import { TRADE_SYMBOLS, addSymbol, removeSymbol } from '@/lib/types'
import { fetchLiveTickers } from '@/lib/bitget-executor'
import { seedNewSymbol, manualClose, notifySymbolRemoved } from '@/lib/trading-state'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET → returns the current list of trading symbols
export async function GET() {
  return NextResponse.json({ symbols: TRADE_SYMBOLS })
}

// POST { action: 'add'|'remove', symbol: 'AVAX/USDT' }
export async function POST(req: Request) {
  const { action, symbol } = await req.json().catch(() => ({}))
  if (!symbol || !symbol.includes('/')) {
    return NextResponse.json({ ok: false, error: 'symbol must be like "AVAX/USDT"' }, { status: 400 })
  }
  const base = symbol.split('/')[0]

  if (action === 'remove') {
    // Close any open position for this symbol BEFORE removing it.
    // Use try/catch so removal succeeds even if the position close fails
    // (e.g. no position, or Bitget API error) — the symbol should still be
    // removed from the trading list.
    try {
      await manualClose(symbol)
    } catch (e: any) {
      console.warn(`[symbols] close position failed for ${symbol}:`, e?.message)
      // Continue with removal anyway
    }
    removeSymbol(symbol)
    notifySymbolRemoved(symbol)  // tell market service to stop generating prices
    // Persist to DB — delete the row so it doesn't come back on restart
    await db.tradingSymbol.deleteMany({ where: { symbol } }).catch(() => {})
    return NextResponse.json({ ok: true, symbols: TRADE_SYMBOLS, message: `Removed ${symbol}` })
  }

  if (action === 'add') {
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
      addSymbol({ symbol, name: base, base, price, change24h: 0, volume24h: 0 })
      seedNewSymbol(symbol, price)
      // Persist to DB so it survives restarts
      await db.tradingSymbol.upsert({
        where: { symbol },
        create: { symbol, name: base, base, price },
        update: { symbol, name: base, base, price },
      }).catch(() => {})
      return NextResponse.json({ ok: true, symbols: TRADE_SYMBOLS, message: `Added ${symbol} at $${price}` })
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: `Failed to verify ${symbol}: ${e?.message}` }, { status: 502 })
    }
  }

  return NextResponse.json({ ok: false, error: 'action must be add or remove' }, { status: 400 })
}
