import { NextResponse } from 'next/server'
import { getMLPrediction } from '@/lib/agent-engine'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get('symbol') || 'BTC/USDT'
  return NextResponse.json(getMLPrediction(symbol))
}
