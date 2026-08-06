import { NextResponse } from 'next/server'
import { pythonGet } from '@/lib/python-proxy'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function GET() {
  const data = await pythonGet('/api/portfolio')
  return NextResponse.json(data || { cash: 0, equity: 0, exposure: 0, openPnl: 0, realizedPnl: 0, dayPnl: 0, dayPnlPct: 0, winRate: 0, positions: [] })
}
