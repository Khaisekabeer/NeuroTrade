import { NextResponse } from 'next/server'
import { pythonGet } from '@/lib/python-proxy'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function GET() {
  const data = await pythonGet('/api/ticks')
  return NextResponse.json(data || [])
}
