import { NextResponse } from 'next/server'
import { snapshotPortfolio, getMode, isLiveConfigured } from '@/lib/trading-state'
import { getEngineStatus } from '@/lib/agent-engine'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const port = snapshotPortfolio()
  return NextResponse.json({
    engine: getEngineStatus(),
    connected: port.connected,
    cycle: port.cycle,
    equity: port.equity,
    startedAt: port.startedAt,
    mode: getMode(),
    liveConfigured: isLiveConfigured(),
  })
}
