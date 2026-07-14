// Next.js instrumentation — runs once when the server process starts.
// Boots the market-data microservice automatically (so you only need to
// run `npm run dev` — no separate terminal for the market service).
// Then restores symbols + positions from the database and starts the
// multi-agent engine.

import { spawn } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { connectMarket, restoreFromDb } = await import('./lib/trading-state')
    const { startAgentEngine } = await import('./lib/agent-engine')
    const { db } = await import('./lib/db')

    // 1. Auto-start the market-data microservice (port 3003) if not running.
    //    This means you only need ONE command: `npm run dev` — the dashboard
    //    starts the market service automatically as a child process.
    try {
      const res = await fetch('http://localhost:3003/').catch(() => null)
      if (!res) {
        const marketPath = path.join(process.cwd(), 'mini-services', 'market-data', 'index.ts')
        if (existsSync(marketPath)) {
          console.log('[instrumentation] auto-starting market-data service on port 3003...')
          const child = spawn('npx', ['tsx', marketPath], {
            stdio: 'ignore',
            detached: true,
            cwd: path.join(process.cwd(), 'mini-services', 'market-data'),
            env: { ...process.env, FORCE_COLOR: '0' },
          })
          child.unref()
          // wait for it to start
          await new Promise((resolve) => setTimeout(resolve, 3000))
          console.log('[instrumentation] market-data service started')
        }
      } else {
        console.log('[instrumentation] market-data service already running')
      }
    } catch {
      // ignore — the dashboard's fallback price generator will handle it
    }

    // 2. seed default risk settings row
    db.riskSettings.upsert({
      where: { id: 'default' },
      create: { id: 'default' },
      update: {},
    }).catch(() => {})

    // 3. restore symbols + positions from DB — MUST finish before engine starts
    await restoreFromDb().catch((e: any) => console.error('[instrumentation] restoreFromDb failed:', e?.message))

    // 4. connect to the market-data microservice (or use fallback if unavailable)
    connectMarket()

    // 5. start the multi-agent engine AFTER symbols are loaded
    startAgentEngine(60_000)
    console.log('[instrumentation] trading bot bootstrapped — everything running from ONE command')
  }
}
