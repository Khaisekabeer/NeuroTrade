import { NextResponse } from 'next/server'
import { pythonGet, pythonPost } from '@/lib/python-proxy'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function GET() {
  const data = await pythonGet('/api/status')
  return NextResponse.json({ mode: data?.mode || 'paper', liveConfigured: data?.liveConfigured || false })
}
export async function POST(req: Request) {
  const body = await req.json()
  const data = await pythonPost('/api/mode', body)
  return NextResponse.json(data)
}
