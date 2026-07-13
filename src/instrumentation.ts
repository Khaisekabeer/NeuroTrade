// Next.js instrumentation — runs once when the server process starts.
// Boots the trading-state market connection, restores open positions from
// the database (so a restart doesn't wipe your trades), then starts the
// multi-agent engine.

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { connectMarket, restoreFromDb } = await import('./lib/trading-state')
    const { startAgentEngine } = await import('./lib/agent-engine')
    const { db } = await import('./lib/db')

    // 1. seed default risk settings row
    db.riskSettings.upsert({
      where: { id: 'default' },
      create: { id: 'default' },
      update: {},
    }).catch(() => {})

    // 2. restore symbols + positions from DB — MUST finish before engine starts
    await restoreFromDb().catch((e: any) => console.error('[instrumentation] restoreFromDb failed:', e?.message))

    // 3. connect to the market-data microservice
    connectMarket()

    // 4. start the multi-agent engine AFTER symbols are loaded
    startAgentEngine(60_000)
    console.log('[instrumentation] trading bot bootstrapped: DB restored + market connected + agent engine started')
  }
}
