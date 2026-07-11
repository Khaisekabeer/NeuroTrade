import { NextResponse } from 'next/server'
import { manualOpen, manualClose } from '@/lib/trading-state'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  const { action, symbol, side, riskPct } = await req.json().catch(() => ({}))
  if (action === 'close') {
    const t = await manualClose(symbol)
    return NextResponse.json({ ok: true, trade: t })
  }
  if (action === 'open') {
    const t = await manualOpen(symbol, side, riskPct ?? 0.02)
    return NextResponse.json({ ok: !!t, trade: t })
  }
  return NextResponse.json({ ok: false, error: 'unknown action' }, { status: 400 })
}
