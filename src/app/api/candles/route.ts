import { NextResponse } from 'next/server'
import { getCandles } from '@/lib/trading-state'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get('symbol') || 'BTC/USDT'
  const limit = Number(searchParams.get('limit') || 200)
  return NextResponse.json(getCandles(symbol, limit))
}
