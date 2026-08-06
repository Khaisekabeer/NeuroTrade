import { NextResponse } from 'next/server'
import { pythonPost } from '@/lib/python-proxy'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function POST(req: Request) {
  const body = await req.json()
  const data = await pythonPost('/api/trade', body)
  return NextResponse.json(data)
}
