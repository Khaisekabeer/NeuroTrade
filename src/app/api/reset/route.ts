import { NextResponse } from 'next/server'
import { resetPaperAccount } from '@/lib/trading-state'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST() {
  resetPaperAccount()
  return NextResponse.json({ ok: true })
}
