import { NextResponse } from 'next/server'
import { pythonGet } from '@/lib/python-proxy'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function GET() {
  const data = await pythonGet('/api/debug')
  return NextResponse.json(data || { entries: [], total: 0, bitgetConfigured: false, bitgetDemo: true })
}
