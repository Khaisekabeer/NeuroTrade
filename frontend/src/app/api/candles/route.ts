import { NextResponse } from 'next/server'
import { pythonGet } from '@/lib/python-proxy'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get('symbol') || ''
  const limit = searchParams.get('limit') || 200
  const data = await pythonGet(`/api/candles?symbol=${encodeURIComponent(symbol)}&limit=${limit}`)
  return NextResponse.json(data || [])
}
