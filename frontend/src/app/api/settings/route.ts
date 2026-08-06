import { NextResponse } from 'next/server'
import { pythonGet } from '@/lib/python-proxy'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function GET() {
  const data = await pythonGet('/api/status')
  return NextResponse.json({
    bitget: { apiKey: data?.liveConfigured ? 'configured' : 'not-set', apiSecret: data?.liveConfigured ? 'configured' : 'not-set', passphrase: data?.liveConfigured ? 'configured' : 'not-set', demoTrading: false },
    tradingView: { widgetEnabled: true },
    agentEngine: { intervalMs: 60000, symbols: [] }
  })
}
