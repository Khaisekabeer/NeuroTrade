import { NextResponse } from 'next/server'
import { pythonGet } from '@/lib/python-proxy'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const queryString = searchParams.toString()
  const data = await pythonGet(`/api/bitget?${queryString}`)
  return NextResponse.json(data || { live: false, error: 'Python core offline' })
}
