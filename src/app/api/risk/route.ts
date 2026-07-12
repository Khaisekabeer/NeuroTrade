import { NextResponse } from 'next/server'
import { getRisk, setRisk } from '@/lib/trading-state'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json(getRisk())
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  setRisk(body)
  await db.riskSettings.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      maxRiskPerTrade: body.maxRiskPerTrade ?? 0.02,
      maxTotalExposure: body.maxTotalExposure ?? 0.6,
      maxDrawdown: body.maxDrawdown ?? 0.15,
      leverageCap: body.leverageCap ?? 5,
      product: body.product ?? 'spot',
      marginMode: body.marginMode ?? 'isolated',
      leverage: body.leverage ?? 3,
    },
    update: body,
  }).catch(() => {})
  return NextResponse.json(getRisk())
}
