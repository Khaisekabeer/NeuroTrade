import { NextResponse } from 'next/server'
import { pythonPost } from '@/lib/python-proxy'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function POST() {
  const data = await pythonPost('/api/reset', {})
  return NextResponse.json(data)
}
