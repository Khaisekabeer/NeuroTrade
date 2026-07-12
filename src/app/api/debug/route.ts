import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// In-memory log of all Bitget API requests/responses made during this session.
// The bitget-executor + bitget route append entries here so the dashboard's
// API Monitor panel can show exactly what was sent and received.

interface ApiLogEntry {
  ts: number
  method: string
  endpoint: string
  product: string
  kind: string
  request: any
  response: any
  ok: boolean
  durationMs: number
}

const g = globalThis as unknown as { __ND_API_LOG__?: ApiLogEntry[] }
if (!g.__ND_API_LOG__) g.__ND_API_LOG__ = []
const log: ApiLogEntry[] = g.__ND_API_LOG__

export function logApiCall(entry: Omit<ApiLogEntry, 'ts'>) {
  log.unshift({ ...entry, ts: Date.now() })
  if (log.length > 100) log.pop()
}

export async function GET() {
  return NextResponse.json({
    entries: log,
    total: log.length,
    bitgetConfigured: !!(process.env.BITGET_API_KEY && process.env.BITGET_API_SECRET && process.env.BITGET_API_PASSPHRASE),
    bitgetDemo: process.env.BITGET_DEMO === 'true',
  })
}

export async function DELETE() {
  g.__ND_API_LOG__ = []
  log.length = 0
  return NextResponse.json({ ok: true, cleared: true })
}
