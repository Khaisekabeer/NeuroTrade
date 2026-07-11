// Next.js instrumentation — runs once when the server process starts.
// Boots the trading-state market connection, restores open positions from
// the database (so a restart doesn't wipe your trades), then starts the
// multi-agent engine.

export async function register() {
  // only run on the server (Node runtime), not during edge build
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

    // 2. restore open positions + cash + realized P/L from the database
    //    (CRITICAL: without this, a restart would wipe your open trades)
    restoreFromDb().catch(() => {})

    // 3. connect to the market-data microservice (or fall back to local
    //    tick generation if it's unreachable)
    connectMarket()

    // 4. start the multi-agent engine after a short delay to let the market
    //    connection establish + positions restore
    setTimeout(() => { startAgentEngine(90_000) }, 5000)
    console.log('[instrumentation] trading bot bootstrapped: DB restore + market connection + agent engine starting')
  }
}
