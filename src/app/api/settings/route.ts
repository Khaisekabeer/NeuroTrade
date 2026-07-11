import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Read-only settings status. NEVER echo secrets.
export async function GET() {
  return NextResponse.json({
    bitget: {
      apiKey: process.env.BITGET_API_KEY ? 'configured' : 'not-set',
      apiSecret: process.env.BITGET_API_SECRET ? 'configured' : 'not-set',
      passphrase: process.env.BITGET_API_PASSPHRASE ? 'configured' : 'not-set',
      demoTrading: process.env.BITGET_DEMO === 'true',
    },
    tradingView: {
      widgetEnabled: true,
      note: 'TradingView embedded widget runs client-side; no keys required for the free charting widget.',
    },
    agentEngine: {
      intervalMs: 45000,
      symbols: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'],
    },
  })
}
