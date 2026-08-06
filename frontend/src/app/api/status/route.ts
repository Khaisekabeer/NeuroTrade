import { NextResponse } from 'next/server'
import { pythonGet } from '@/lib/python-proxy'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function GET() {
  const data = await pythonGet('/api/status')
  return NextResponse.json(data || { engine: { running: false, predictors: 0, sentimentCache: 0 }, connected: false, cycle: 0, equity: 0, startedAt: 0, mode: 'paper', liveConfigured: false })
}
