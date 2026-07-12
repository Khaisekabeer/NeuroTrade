import { NextResponse } from 'next/server'
import { startAgentEngine, stopAgentEngine, getEngineStatus } from '@/lib/agent-engine'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Bot on/off control — the kill switch + resume.
// GET  → current engine status
// POST → { action: 'start' | 'stop' } to start or halt the agent loop.
//        'stop' does NOT close open positions — it just pauses new decisions.
//        Open positions continue to be monitored for SL/TP only if you also
//        keep the exit-checker running. See note below.

export async function GET() {
  return NextResponse.json(getEngineStatus())
}

export async function POST(req: Request) {
  const { action } = await req.json().catch(() => ({}))
  if (action === 'start') {
    startAgentEngine(60_000)
    return NextResponse.json({ ok: true, ...getEngineStatus() })
  }
  if (action === 'stop') {
    stopAgentEngine()
    return NextResponse.json({ ok: true, ...getEngineStatus(), message: 'Engine stopped. Open positions remain — monitor them manually or close via the Positions panel.' })
  }
  return NextResponse.json({ ok: false, error: 'unknown action' }, { status: 400 })
}
