import { NextResponse } from 'next/server'
import { pythonGet } from '@/lib/python-proxy'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const limit = searchParams.get('limit') || 30
  const data = await pythonGet(`/api/decisions?limit=${limit}`)
  return NextResponse.json(data || [])
}
