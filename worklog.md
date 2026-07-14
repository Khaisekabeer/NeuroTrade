# Multi-Agent Crypto Trading Bot — Worklog

This file is the shared worklog for all agents working on the multi-agent crypto trading bot dashboard.

---
Task ID: 1
Agent: orchestrator (main)
Task: Foundation — Prisma schema, db client, core types, ML engine, agent engine, shared libs

Work Log:
- Defined Prisma schema: Candle, Trade, Position, AgentDecision, PortfolioSnapshot, RiskSettings
- Created lib/db.ts (already present)
- Created lib/types.ts with shared trading types
- Created lib/nn.ts — real TypeScript feed-forward neural net (2 hidden layers, tanh/sigmoid) for next-return prediction, trained online via SGD
- Created lib/indicators.ts — RSI, MACD, Bollinger, EMA, ATR, OBV
- Created lib/agent-engine.ts — orchestrator that runs the 5-agent loop, uses LLM skill for deliberation, web-search for sentiment, persists decisions
- Created lib/trading-state.ts — in-memory market + portfolio state shared by WS service + API routes

Stage Summary:
- Foundation complete. Subagents must import from @/lib/types, @/lib/nn, @/lib/indicators, @/lib/agent-engine, @/lib/trading-state.
- DB schema pushed. Trading state is in-memory (singleton) seeded with $100,000 paper balance.

---
Task ID: 3
Agent: frontend-developer
Task: Build the complete multi-agent crypto trading dashboard frontend

Work Log:
- Read worklog.md to understand the foundation (types, agent-engine, trading-state, API routes, market microservice on port 3003)
- Inspected existing shadcn/ui components (Card, Button, Table, Progress, AlertDialog, Tooltip, Input, Label, Skeleton, Badge, Sonner) and confirmed they should be reused as-is
- Inspected the backend API contract by reading every route file under src/app/api/* and the lib/trading-state.ts + lib/agent-engine.ts to understand exact response shapes
- Created src/lib/dashboard-store.ts — zustand store holding activeSymbol, ticks map, candles per symbol, portfolio, trades, decisions, agentsBySymbol, mlBySymbol + rolling mlHistory (last 60 probUp values), risk, status, bitgetStatus, bitgetTickers, wsConnected. Actions: applyTick (merges full Tick fields + updates last candle OHLC), applyCandle, applyHistory, setML (also appends to history), etc.
- Created src/components/dashboard/format.ts — fmtUsd, fmtNum, fmtPct, fmtPctRaw, fmtPrice, fmtTime, fmtClock, timeAgo, pnlColor, signalColor, signalBg, clamp
- Created src/components/dashboard/panel.tsx — shared Panel wrapper (framer-motion fade-in, dark zinc-900 card, optional title/subtitle/icon/actions header, noPad option), StatTile, LiveDot (pulsing dot in emerald/rose/amber/zinc/sky)
- Created src/components/dashboard/hydrator.tsx — DashboardHydrator client component. Connects socket.io to the market microservice via io('/', { path:'/', transports:['websocket'], query:{ XTransformPort:'3003' } }) and handles tick/candle/history events. Runs staggered REST polling: portfolio 4s, trades 5s, decisions 4s, agents (all 3 symbols) 5s, ml (all 3 symbols) 6s, risk 8s, status 4s, bitget status 15s, ticks 2.5s (REST fallback so prices always flow even if WS can't reach the gateway). All fetches are no-store and silent-fail (null on error) so the page never crashes if an endpoint is slow.
- Created src/components/dashboard/header.tsx — sticky header with logo mark, "NEURAL DESK" title + subtitle, big equity number, day P&L (colored, with %), exposure %, drawdown %, Bitget pill (PUBLIC/AUTH), TradingView pill, Engine pill (RUN/IDLE), cycle counter, WS status pill, 1-second live clock. Responsive: equity cluster hides sub-stats on mobile.
- Created src/components/dashboard/symbol-tabs.tsx — sticky tab bar (top-[57px]) for BTC/USDT, ETH/USDT, SOL/USDT. Each tab shows live price + 24h change % (colored) + live dot. Active tab highlighted with emerald border. Clicking sets activeSymbol in the store.
- Created src/components/dashboard/trading-view-chart.tsx — TradingView Advanced Chart widget (480px). Loads s3.tradingview.com/tv.js once (cached promise), then `new window.TradingView.widget({ autosize, symbol: BITGET:BTCUSDT etc, interval:'1', theme:'dark', style:'1', toolbar_bg, backgroundColor, gridColor })`. Reloads when symbol changes (destroys + recreates). Shows loading spinner, failed-state fallback, and overlays the latest orchestrator signal badge + simulated price.
- Created src/components/dashboard/ml-prediction.tsx — Neural Network Forecast panel. Shows P(up) big stat (emerald if >0.5, rose if <0.5), E[return] %, confidence, trainedSteps. Big bidirectional probability bar (BEAR|0|BULL with center divider). recharts LineChart sparkline of the rolling probUp history (last 60 values) with a 50% reference line.
- Created src/components/dashboard/technical-panel.tsx — reads the latest TECHNICAL agent output from /api/agents and renders RSI(14), MACD Hist, EMA Cross, Boll %B, ATR, Trend Score as StatTiles (color-coded), plus a -1..+1 trend score bar and the agent rationale.
- Created src/components/dashboard/agent-roster.tsx — 5-agent roster (SENTIMENT, TECHNICAL, ML, RISK, ORCHESTRATOR) with lucide icons, status, signal badge (emerald/rose/amber/zinc), confidence %, time-ago, one-line rationale (line-clamp-2 with title tooltip). Orchestrator row gets a pulsing "live" dot when engine.running. Fetches the 4 specialists from /api/agents and the orchestrator from the latest decision for the active symbol.
- Created src/components/dashboard/orchestrator-decision.tsx — latest orchestrator decision for the active symbol: big signal icon (ArrowUpRight/ArrowDownRight/Minus), signal badge, cycle #, confidence, time-ago, full rationale text, and a note if a position is open.
- Created src/components/dashboard/risk-dashboard.tsx — exposure vs max bar, drawdown vs max bar (turns amber→rose approaching limit), win rate, max risk/trade, leverage cap, realized P&L. DD ALERT badge in header when drawdown > 80% of max.
- Created src/components/dashboard/positions-table.tsx — open positions table (symbol, side badge, size, entry, current, unrealized P&L colored, SL, TP, close button). Empty state: "No open positions — agents are scanning". Close button calls POST /api/trade {action:'close'} with sonner toast.
- Created src/components/dashboard/trade-history.tsx — scrollable table (max-h-80, custom webkit-scrollbar) of recent trades: time, symbol, side badge, size, entry, exit, P&L colored + %, confidence, rationale truncated. OPEN trades flagged amber.
- Created src/components/dashboard/deliberation-log.tsx — terminal-style streaming log (monospace, dark bg, max-h-80) of orchestrator decisions + each agent's rationale as timestamped, color-coded lines. Newest on top. Tree-style indentation for agent sub-decisions.
- Created src/components/dashboard/manual-control.tsx — operator override buttons: Open LONG (emerald), Open SHORT (rose), Close [symbol] (amber), Reset Paper Account (zinc, with AlertDialog confirm). All call POST /api/trade or /api/reset with sonner toasts. 40px+ touch targets.
- Created src/components/dashboard/bitget-panel.tsx — Bitget connection status (from /api/bitget?action=status), PUBLIC/AUTH pill, "Fetch Live Bitget Tickers" button (calls /api/bitget?action=tickers for BTCUSDT,ETHUSDT,SOLUSDT) and displays a live-vs-simulated price comparison table with diff %. API key requirement note linking to bitget API docs.
- Created src/components/dashboard/trading-view-card.tsx — small card confirming the TradingView widget is live above, with widget/interval/theme/feed stat tiles and a link to tradingview.com.
- Created src/components/dashboard/risk-settings.tsx — editable inputs (shadcn Input + Label) for maxRiskPerTrade, maxTotalExposure, maxDrawdown, leverageCap with % / x suffixes. Save button POSTs to /api/risk. Uses a ref to avoid clobbering in-progress edits when the server re-broadcasts unchanged settings.
- Created src/components/dashboard/footer.tsx — mt-auto sticky-footer with "PAPER TRADING SIMULATION" warning + full disclaimer, engine status, agent count, NN predictors, sentiment cache, WS status, live uptime counter.
- Created src/app/page.tsx — composes everything inside <div className="bg-zinc-950 text-zinc-100 min-h-screen flex flex-col">. Mounts SonnerToaster (dark theme, bottom-right) + DashboardHydrator + Header + SymbolTabs + main grid (lg:grid-cols-3: chart/ML/technical spanning 2 cols | roster/decision/risk in right rail) + lower grid (lg:grid-cols-3: positions/history/deliberation) + control row (sm:grid-cols-2 lg:grid-cols-4: manual/bitget/tv/risk-settings) + Footer.
- Ran `bun run lint` — initially 1 warning (unused eslint-disable directive in risk-settings.tsx); removed the redundant useEffect. Re-ran lint → clean (0 errors, 0 warnings).
- Verified the page server-renders all sections (curl grep confirmed NEURAL DESK, Equity, Agent Roster, Bitget, TradingView, Manual Control, Open Positions, Trade History, Deliberation, Orchestrator, Risk Dashboard, Technical Indicators, Neural Network all present in SSR HTML).
- Verified all REST endpoints are hit by the hydrator on initial load (portfolio, agents x3, ml x3, trades, decisions, risk, status, bitget, ticks all return 200 in dev.log).

Stage Summary:
- Files produced (all under src/):
  - lib/dashboard-store.ts (zustand store + types: PortfolioSnapshot, MLPrediction, EngineStatus, BitgetStatus, BitgetTicker; SYMBOLS, SYMBOL_TO_TV, SYMBOL_TO_BITGET, AGENT_ORDER constants)
  - components/dashboard/format.ts, panel.tsx, hydrator.tsx, header.tsx, symbol-tabs.tsx, trading-view-chart.tsx, ml-prediction.tsx, technical-panel.tsx, agent-roster.tsx, orchestrator-decision.tsx, risk-dashboard.tsx, positions-table.tsx, trade-history.tsx, deliberation-log.tsx, manual-control.tsx, bitget-panel.tsx, trading-view-card.tsx, risk-settings.tsx, footer.tsx
  - app/page.tsx (overwritten with the full dashboard composition)
- Key decisions:
  - Used a single zustand store + a single DashboardHydrator (simpler than TanStack Query for this use case). Polling intervals are staggered to avoid request bursts.
  - Added REST /api/ticks polling (2.5s) as a supplement to the WebSocket so prices always flow even if the browser WS can't reach the market microservice via the Caddy gateway.
  - TradingView widget is keyed by symbol and recreated on tab switch; the tv.js script is loaded once and cached in a module-level promise.
  - Used Tailwind arbitrary webkit-scrollbar variants for custom scrollbars (did not touch globals.css).
  - Sonner Toaster is mounted inside page.tsx (not layout.tsx, which is untouched) so toast() calls from manual-control / positions-table / bitget-panel / risk-settings render correctly.
  - All colors use zinc/emerald/rose/amber/neutral palette per spec — no indigo/blue primary.
  - Sticky header (top-0 z-40) + sticky symbol tabs (top-[57px] z-30) + mt-auto footer inside min-h-screen flex flex-col wrapper.
  - Mobile-first responsive: grids collapse to single column on mobile, sub-stats hide on small screens, 40px+ touch targets on all buttons.
- Lint passes clean (0 errors, 0 warnings). Page SSRs all sections; hydrator fires all initial fetches on cold load.

---
Task ID: 4
Agent: orchestrator (main)
Task: API routes, instrumentation bootstrap, Bitget integration, bug fixes, Python core

Work Log:
- Created 12 API routes under src/app/api/ (portfolio, trades, decisions, agents, candles, ticks, ml, risk, trade, reset, status, bitget, settings)
- Created src/instrumentation.ts to bootstrap market connection + agent engine on server start
- Built Bitget integration route with REAL live public ticker fetch + signed-order request structure
- Created complete Python trading-core reference under python-core/ (orchestrator.py, agents/*, models/lstm_price_model.py, train.py, backtest.py, bitget_client.py, config.py, README.md)
- Fixed rsi() indicator alignment bug (was returning shorter array → undefined.toFixed crash)
- Fixed portfolio accounting: switched from spot model (debiting notional) to margin/derivative model (cash = collateral, equity = cash + unrealized, only realized P/L settles) — equity now correctly positive
- Fixed zustand infinite-loop: two selectors returned new [] each call (agentsBySymbol[sym] ?? [], mlHistory[sym] ?? []) → replaced with stable EMPTY constants
- Fixed HMR module-split: hoisted trading-state `state` + agent-engine (started/timers/predictors/sentimentCache) to globalThis so instrumentation's instance == API routes' instance
- Fixed sentiment cache logic (cached path now returns instead of falling through)
- Batched WS ticks in hydrator (700ms coalescing) to eliminate React 19 "getSnapshot should be cached" warnings under rapid updates

Stage Summary:
- Backend complete and verified. Agent engine produces real LLM-driven decisions (6+ per run with rationales like "Technical analysis and risk management agents support a LONG position despite neutral sentiment").
- Equity stays positive ($100,000 → ~$100,156 from realized P/L). 0 cycle errors.
- Lint clean. All APIs respond 200. Market service (3003) + dev server (3000) both running.
- Python core is deployable reference code (ccxt + PyTorch LSTM + XGBoost + AutoGen).

---
Task ID: 5
Agent: orchestrator (main)
Task: Agent Browser end-to-end verification

Work Log:
- Used agent-browser to open http://localhost:3000, wait for networkidle, snapshot, eval, screenshot
- Verified: page renders all dashboard sections (NEURAL DESK header, Agent Roster, Positions, Deliberation Log, PAPER TRADING footer) — eval returned true for all
- Verified: symbol tabs render live prices (BTC 66,777 +0.36%, ETH 3,498 +0.47%, SOL 169.14 +0.44% LIVE)
- Verified: clicking ETH/USDT tab updates the chart subtitle to "ETH/USDT · Bitget" (interactivity works)
- Verified: 0 "getSnapshot"/"Maximum update depth" console errors after batching fix
- Verified: /api/decisions returns 6 real orchestrator decisions with LLM rationales; /api/status shows engine.running=true, connected=true
- Verified: equity positive ($100,156), 0 cycle errors in dev.log
- Full-page screenshot saved (343KB) confirming rich rendered content

Stage Summary:
- Dashboard is interactive and runnable. Multi-agent system genuinely deliberates via LLM + web-search, neural net trains online, TradingView chart loads, Bitget public data fetches live.
- Note: sandbox reaps background processes between tool calls; services are restarted for the user's preview. The trading-state fallback ensures the dashboard works even if the market microservice is briefly down.

---
Task ID: 6
Agent: orchestrator (main)
Task: Fix TradingView load failure + write comprehensive report

Work Log:
- Diagnosed TradingView failure: tv.js loaded (HTTP 200, window.TradingView defined) but 0 iframes injected. Root cause: `container` (DOM ref) option unreliable in current tv.js build; module-level scriptPromise broke under HMR (tv.js fetched 9x).
- Fixed trading-view-chart.tsx: switched to `container_id` (string), moved script promise to window.__tvScriptPromise (HMR-proof), added container-ready retry loop (20x @ 150ms), added retry button on failure.
- Verified fix: 1 iframe now injected pointing to s.tradingview.com/widgetembed/, 0 console errors, chart reloads on tab switch.
- Wrote comprehensive REPORT.md (~900 lines) covering: architecture, all 6 agents, neural net spec (10 features, 16-8-1 architecture, online backprop), Python LSTM+XGBoost ensemble, trading strategy, risk management, Bitget/TradingView integration, user guide, developer extension guide, file map, limitations, risk disclaimer.

Stage Summary:
- TradingView chart now renders reliably.
- REPORT.md is the single source of truth for the entire system — hand it to any developer or user.
