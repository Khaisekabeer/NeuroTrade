# Neuro Trade — Unified Trading System

A professional multi-agent crypto trading bot with a clean separation of concerns:
- **`backend/`** — Python FastAPI server (AI engine, Llama 3, ccxt trading, LSTM/XGBoost)
- **`frontend/`** — Next.js TypeScript dashboard (UI, charts, proxy to backend)

## Quick Start (Localhost)

### 1. Start your local LLM (Ollama)
```bash
ollama serve
```

### 2. Start the Python Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env  # Add your Bitget API keys + LLM settings
python server.py
```
Backend runs on `http://localhost:8000`

### 3. Start the TypeScript Frontend
```bash
cd frontend
npm install
npm run dev
```
Dashboard runs on `http://localhost:3000`

## Architecture

```
┌─────────────────────┐         ┌─────────────────────┐
│ Frontend (Port 3000)│         │ Backend (Port 8000)  │
│ Next.js + React     │ <─────> │ Python + FastAPI     │
│                     │  REST   │                      │
│ • UI + Charts       │         │ • 5 AI Agents        │
│ • TradingView       │         │ • Llama 3 (Ollama)   │
│ • Risk Settings     │         │ • LSTM + XGBoost     │
│ • Manual Controls   │         │ • ccxt (Bitget)      │
│                     │         │ • Position Management│
└─────────────────────┘         └──────────┬───────────┘
                                           │
                                           ▼
                                ┌────────────────────┐
                                │   Bitget Exchange   │
                                └────────────────────┘
```

## Docker Deployment

```bash
docker-compose up --build -d
```

## Project Structure

```
NeuroTrade/
├── frontend/           # TypeScript Next.js dashboard (UI only)
│   ├── src/
│   │   ├── app/        # Next.js routes (pure proxies to backend)
│   │   ├── components/ # React UI components
│   │   └── lib/        # python-proxy.ts + helpers
│   ├── package.json
│   └── tsconfig.json
│
├── backend/            # Python FastAPI server (all logic)
│   ├── server.py       # FastAPI server (port 8000)
│   ├── orchestrator.py # 5-agent trading loop
│   ├── config.py       # Configuration
│   ├── agents/         # Sentiment, Technical, ML, Risk, Orchestrator
│   ├── models/         # PyTorch LSTM
│   ├── exchange/       # ccxt Bitget client
│   └── requirements.txt
│
├── docker-compose.yml  # Orchestrates both services
├── Dockerfile          # Frontend container
├── Dockerfile.backend  # Backend container
└── README.md
```
