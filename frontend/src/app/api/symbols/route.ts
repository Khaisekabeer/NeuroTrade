import { NextResponse } from 'next/server'
import { pythonGet, pythonPost } from '@/lib/python-proxy'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function GET() {
  const data = await pythonGet('/api/symbols')
  return NextResponse.json(data || { symbols: [] })
}
export async function POST(req: Request) {
  const body = await req.json()
  const data = await pythonPost('/api/symbols', body)
  return NextResponse.json(data)
}
