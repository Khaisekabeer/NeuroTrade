import { NextResponse } from 'next/server'
import { pythonGet, pythonPost } from '@/lib/python-proxy'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function GET() {
  const data = await pythonGet('/api/status')
  return NextResponse.json(data?.engine || { running: false, predictors: 0, sentimentCache: 0 })
}
export async function POST(req: Request) {
  const { action } = await req.json()
  const data = await pythonPost(`/api/engine/${action}`, {})
  return NextResponse.json(data)
}
