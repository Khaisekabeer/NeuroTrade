# Neuro Trade

**Multi-Agent Crypto Trading Terminal** — a real-time trading dashboard with 5 specialist AI agents (Sentiment, Technical, ML, Risk, Orchestrator), an online-trained neural network, live Bitget integration, and TradingView charts.

![Neuro Trade](public/logo.svg)

---

## What is this?

Neuro Trade is a multi-agent crypto trading system with two deployable parts:

| Part | Stack | Purpose |
|------|-------|---------|
| **Dashboard** (this repo) | Next.js 16 + Bun + TypeScript + Tailwind + shadcn/ui | Real-time command center — agents deliberate live, neural net trains online, TradingView + Bitget integrated |
| **Python Core** (`python-core/`) | Python + ccxt + PyTorch + XGBoost + AutoGen | Live execution engine for real Bitget trading (deploy on VPS) |

### Features
- **5-agent orchestration** — Sentiment (web-search + LLM), Technical (RSI/MACD/EMA/Boll/ATR/OBV), ML (online neural net), Risk (Kelly + exposure/drawdown gates), Orchestrator (LLM meta-reasoner)
- **Real neural network** — 10→16→8→1 architecture, online backprop, trains every cycle
- **Live Bitget integration** — public market data + signed order placement + exchange-side SL/TP
- **TradingView chart** — live Bitget BTC/ETH/SOL candles
- **Paper / Live trading toggle** — switch between simulated and real-money trading from the UI
- **Bot on/off kill switch** — pause/resume the agent engine without losing SL/TP protection
- **Risk management** — per-trade risk cap, total exposure limit, drawdown circuit breaker, leverage cap
- **Position persistence** — open positions survive server restarts (stored in SQLite)

---

## Quick Start (Development)

### Prerequisites
- [Bun](https://bun.sh) (recommended) or Node.js 20+
- Git

### Install & Run
```bash
git clone https://github.com/Khaisekabeer/NeuroTrade.git
cd NeuroTrade
bun install
cp .env.example .env
bun run db:push

# Terminal 1: market-data microservice
cd mini-services/market-data
bun install
bun run dev

# Terminal 2: dashboard (from project root)
cd ../..
bun run dev
# → http://localhost:3000
```

Open `http://localhost:3000` in your browser. The dashboard runs in **PAPER mode** by default (simulated prices, no real money).

---

## Production Deployment

### Option A: VPS (recommended for 24/7 trading)

**Requirements**: Ubuntu 22.04+ VPS, 2GB RAM minimum.

```bash
# On your VPS:
curl -fsSL https://bun.sh/install | bash
git clone https://github.com/Khaisekabeer/NeuroTrade.git
cd NeuroTrade
bun install
cp .env.example .env
# edit .env with your Bitget API keys (optional for paper trading)
bun run db:push
bun run build

# Create systemd services for both the dashboard + market microservice
sudo tee /etc/systemd/system/neurotrade.service << 'EOF'
[Unit]
Description=Neuro Trade Dashboard
After=network.target
[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/home/YOUR_USERNAME/NeuroTrade
EnvironmentFile=/home/YOUR_USERNAME/NeuroTrade/.env
ExecStart=/home/YOUR_USERNAME/.bun/bin/bun run start
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
EOF

sudo tee /etc/systemd/system/neurotrade-market.service << 'EOF'
[Unit]
Description=Neuro Trade Market Data Service
After=network.target
[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/home/YOUR_USERNAME/NeuroTrade/mini-services/market-data
ExecStart=/home/YOUR_USERNAME/.bun/bin/bun run dev
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now neurotrade neurotrade-market
```

### Option B: Localhost (for personal trading)

Run the two `bun run dev` commands above and keep your computer on. The dashboard runs at `http://localhost:3000`. For remote access from your phone, use [Tailscale](https://tailscale.com) (free) or [Cloudflare Tunnel](https://cloudflared.com).

### Nginx + HTTPS (for domain access)
```nginx
server {
    server_name neurotrade.yourdomain.com;
    location / { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; }
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```
Then `sudo certbot --nginx -d neurotrade.yourdomain.com` for free SSL.

---

## Going Live with Real Money

1. **Get Bitget API keys** from https://www.bitget.com — start with **demo/testnet keys** first
2. Add to `.env`:
   ```
   BITGET_API_KEY=your_key
   BITGET_API_SECRET=your_secret
   BITGET_API_PASSPHRASE=your_passphrase
   BITGET_DEMO=true   # set to false for REAL trading
   ```
3. Restart the server
4. Click the amber **PAPER → LIVE** toggle in the dashboard header
5. Confirm the red warning dialog

When LIVE:
- ✅ Real Bitget prices (polled every 2s from public API)
- ✅ Real signed market orders on entry/exit
- ✅ **Exchange-side SL/TP plan orders** — Bitget protects your position even if your bot goes offline
- ✅ Switch back to paper anytime

---

## Architecture

```
Browser (Next.js dashboard) ─── REST + WebSocket ─── Next.js API
                                                         │
                                          ┌──────────────┴──────────────┐
                                          ▼                             ▼
                                  trading-state.ts              agent-engine.ts
                                  (in-memory + SQLite)          (5-agent loop)
                                          │                             │
                                          └──────────┬──────────────────┘
                                                     ▼
                                          market-data microservice (port 3003)
                                          + z-ai SDK (LLM + web-search)
                                          + Bitget public API
                                          + Bitget signed API (live mode)
```

### The 5 Agents (run every 90s per symbol)
1. **Sentiment** — web-searches crypto news + LLM scores sentiment -1..+1
2. **Technical** — RSI/MACD/EMA/Bollinger/ATR/OBV → trend score
3. **ML** — TypeScript neural network (10→16→8→1, online backprop) → P(up)
4. **Risk** — Kelly position sizing + exposure/drawdown gates
5. **Orchestrator** — LLM meta-reasoner weighs all 4 → final LONG/SHORT/FLAT

### Fund Management (4 layers)
- **Per-trade risk**: 2% of equity max (configurable)
- **Total exposure**: 60% of equity max (configurable)
- **Leverage cap**: 5× hard ceiling
- **Drawdown breaker**: halts at 15% drawdown (configurable)

All editable in the dashboard's Risk Settings card.

---

## Project Structure
```
src/
├── app/
│   ├── page.tsx                  # Dashboard (only route)
│   ├── layout.tsx                # Root layout + metadata
│   └── api/                      # REST endpoints (portfolio, trades, decisions, bitget, mode, engine, etc.)
├── components/dashboard/         # All UI panels (header, chart, agents, positions, etc.)
├── lib/
│   ├── types.ts                  # Shared TypeScript types
│   ├── indicators.ts             # RSI/MACD/EMA/Bollinger/ATR/OBV
│   ├── nn.ts                     # Neural network (online backprop)
│   ├── agent-engine.ts           # 5-agent orchestration loop
│   ├── trading-state.ts          # Portfolio + positions + price polling
│   └── bitget-executor.ts        # Real order placement + exchange SL/TP
└── instrumentation.ts            # Boots engine on server start

mini-services/market-data/        # Socket.IO price-feed microservice (port 3003)
python-core/                      # Python live-trading engine (ccxt + PyTorch + XGBoost)
prisma/schema.prisma              # SQLite schema (candles, trades, positions, decisions)
```

---

## LLM Provider

This project uses the **z-ai-web-dev-sdk** for the Sentiment + Orchestrator agents (LLM + web-search). It's pre-configured for the Z.ai cloud sandbox.

For your own deployment, you can either:
1. Keep z-ai (if deploying on Z.ai cloud), or
2. Swap to OpenAI/Anthropic — edit `src/lib/agent-engine.ts`, replace `import ZAI from 'z-ai-web-dev-sdk'` with your provider, and update the 2 call sites (`withZAI()` wrapper handles errors gracefully).

---

## ⚠️ Risk Disclaimer

**Cryptocurrency trading carries a substantial risk of loss.** This software is provided for educational and research purposes only. The authors take NO responsibility for financial losses. Never trade with funds you cannot afford to lose. Always:
1. Run in PAPER mode for weeks before live trading
2. Start with Bitget demo/testnet keys
3. Begin with a small amount ($50-100)
4. Use exchange-side SL/TP orders (the bot does this automatically in LIVE mode)

---

## License

MIT — see [LICENSE](LICENSE).

---

**Neuro Trade** — built with Next.js 16, Bun, TypeScript, z-ai-web-dev-sdk, TradingView, and shadcn/ui.
