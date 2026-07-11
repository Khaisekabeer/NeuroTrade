import { NextResponse } from 'next/server'
import { getAgentOutputs } from '@/lib/trading-state'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get('symbol') || 'BTC/USDT'
  const limit = Number(searchParams.get('limit') || 20)
  return NextResponse.json(getAgentOutputs(symbol, limit))
}
