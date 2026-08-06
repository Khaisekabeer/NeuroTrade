import { NextResponse } from 'next/server'
import { pythonGet } from '@/lib/python-proxy'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get('symbol') || ''
  const data = await pythonGet(`/api/ml?symbol=${encodeURIComponent(symbol)}`)
  return NextResponse.json(data || { probUp: 0.5, expectedReturn: 0, confidence: 0, trainedSteps: 0 })
}
