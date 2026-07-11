import { NextResponse } from 'next/server'
import { getTicks } from '@/lib/trading-state'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json(getTicks())
}
