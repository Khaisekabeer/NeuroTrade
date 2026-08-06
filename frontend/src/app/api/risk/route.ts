import { NextResponse } from 'next/server'
import { pythonGet, pythonPost } from '@/lib/python-proxy'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function GET() {
  const data = await pythonGet('/api/risk')
  return NextResponse.json(data || { maxRiskPerTrade: 0.02, maxTotalExposure: 0.6, maxDrawdown: 0.15, leverageCap: 20, product: 'futures', marginMode: 'isolated', leverage: 10 })
}
export async function POST(req: Request) {
  const body = await req.json()
  const data = await pythonPost('/api/risk', body)
  return NextResponse.json(data)
}
