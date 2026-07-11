import { NextResponse } from 'next/server'
import { getMode, setMode, isLiveConfigured } from '@/lib/trading-state'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET → { mode: 'paper'|'live', liveConfigured: boolean }
// POST { mode: 'paper'|'live' } → switch mode
//   Switching to 'live' requires BITGET_API_KEY/SECRET/PASSPHRASE env vars.
//   Switching to 'live' also flips the price feed from the simulated
//   microservice to REAL Bitget public tickers, and routes new orders through
//   the real Bitget signed-HTTP executor.

export async function GET() {
  return NextResponse.json({ mode: getMode(), liveConfigured: isLiveConfigured() })
}

export async function POST(req: Request) {
  const { mode } = await req.json().catch(() => ({}))
  if (mode !== 'paper' && mode !== 'live') {
    return NextResponse.json({ ok: false, error: 'mode must be paper or live' }, { status: 400 })
  }
  if (mode === 'live' && !isLiveConfigured()) {
    return NextResponse.json({
      ok: false,
      error: 'Cannot switch to LIVE — BITGET_API_KEY / BITGET_API_SECRET / BITGET_API_PASSPHRASE env vars are not set. Add them to .env and restart.',
    }, { status: 400 })
  }
  await setMode(mode)
  return NextResponse.json({ ok: true, mode: getMode(), liveConfigured: isLiveConfigured() })
}
