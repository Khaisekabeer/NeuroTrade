import { NextResponse } from 'next/server'
import { getTrades } from '@/lib/trading-state'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const limit = Number(searchParams.get('limit') || 50)
  return NextResponse.json(getTrades(limit))
}
