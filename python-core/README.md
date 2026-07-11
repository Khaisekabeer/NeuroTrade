# Neuro Trade — Python Trading Core (Production Reference)

This is the **live execution engine** you deploy on your own VPS to trade real funds
on **Bitget**, driven by the same multi-agent architecture shown in the Next.js
dashboard. The dashboard is the *command center*; this is the *engine*.

## Why Python here, TypeScript in the dashboard?
- **Python** has the best ML/trading ecosystem (`ccxt`, `PyTorch`, `stable-baselines3`,
  `vectorbt`, `ta`, `autogen`). It belongs in the trading core.
- **TypeScript/Next.js** is the best for real-time dashboards. It belongs in the UI.
- They communicate via a shared REST/WebSocket contract. The dashboard reads the
  engine's state; the engine executes orders on Bitget.

## Architecture
```
                 ┌──────────────────────────────────────────┐
                 │            orchestrator.py (main loop)    │
                 │  AutoGen/CrewAI multi-agent orchestration │
                 └───────────────┬──────────────────────────┘
                                 │
   ┌──────────────┬──────────────┼──────────────┬───────────────┐
   ▼              ▼              ▼              ▼               ▼
sentiment     technical         ml           risk           execution
 agent         agent          agent          agent           agent
 (web+LLM)    (ta lib)    (LSTM+XGBoost)   (Kelly/VaR)   (ccxt→Bitget)
```

## Setup
```bash
cd python-core
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # fill in your Bitget API keys + model paths
python orchestrator.py --symbols BTC/USDT,ETH/USDT,SOL/USDT --paper
```

## Live trading
```bash
# 1) Train models on historical data (fetches klines from Bitget)
python train.py --symbol BTC/USDT --epochs 200

# 2) Run live (REMOVE --paper for real execution — USE EXTREME CAUTION)
python orchestrator.py --symbols BTC/USDT --live
```

## Files
| File | Purpose |
|---|---|
| `config.py` | Settings, symbol list, risk params, model paths |
| `exchange/bitget_client.py` | ccxt wrapper for Bitget (REST + WS), signed orders |
| `agents/sentiment_agent.py` | Web-search news + LLM sentiment scoring |
| `agents/technical_agent.py` | RSI/MACD/EMA/Boll/ATR via `ta` library |
| `agents/ml_agent.py` | PyTorch LSTM + XGBoost ensemble forecast |
| `agents/risk_agent.py` | Kelly position sizing, VaR, drawdown gates |
| `agents/orchestrator_agent.py` | LLM meta-reasoner that weighs all signals |
| `models/lstm_price_model.py` | PyTorch LSTM (seq→next-return) |
| `orchestrator.py` | Main loop: fetch data → agents → decide → execute |
| `train.py` | Train LSTM + XGBoost on historical klines |
| `backtest.py` | Vectorized backtest with `vectorbt` |

## ⚠️ Risk disclaimer
Crypto trading carries substantial risk of loss. This software is provided for
educational purposes. **Never trade with funds you cannot afford to lose.** Always
run in `--paper` mode first. The authors take no responsibility for losses.
