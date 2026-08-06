"""FastAPI Server for the Neuro Trade Python Core.
This is the SOLE backend for the application. The TypeScript dashboard
(port 3000) acts purely as a UI/proxy and forwards all requests here.
All trading logic, AI predictions, and Bitget order execution happen here.
"""
from __future__ import annotations
import asyncio
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import time

from orchestrator import Engine
from config import cfg
from agents import technical_agent

log = logging.getLogger("fastapi")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")

app = FastAPI(title="Neuro Trade Python Core", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the engine
engine = Engine(cfg.symbols, paper=cfg.paper)
engine_loop_task = None

# In-memory state for UI (populated by the engine loop)
ui_state = {
    "portfolio": {"cash": cfg.starting_capital, "equity": cfg.starting_capital, "exposure": 0, "openPnl": 0, "realizedPnl": 0, "dayPnl": 0, "dayPnlPct": 0, "winRate": 0, "positions": []},
    "decisions": [],
    "trades": [],
    "risk": {
        "maxRiskPerTrade": cfg.max_risk_per_trade,
        "maxTotalExposure": cfg.max_total_exposure,
        "maxDrawdown": cfg.max_drawdown,
        "leverageCap": cfg.leverage_cap,
        "product": "futures",
        "marginMode": "isolated",
        "leverage": 10
    },
    "agents": {},
    "ticks": []
}

class TradeRequest(BaseModel):
    action: str
    symbol: str | None = None
    side: str | None = None

class SymbolRequest(BaseModel):
    action: str
    symbol: str

class RiskRequest(BaseModel):
    maxRiskPerTrade: float | None = None
    maxTotalExposure: float | None = None
    maxDrawdown: float | None = None
    leverageCap: float | None = None
    product: str | None = None
    marginMode: str | None = None
    leverage: float | None = None

@app.get("/api/status")
async def get_status():
    return {
        "engine": {"running": engine_loop_task is not None and not engine_loop_task.done(), "predictors": len(engine.symbols), "sentimentCache": 0},
        "connected": True,
        "cycle": engine.cycle,
        "equity": ui_state["portfolio"]["equity"],
        "startedAt": int(time.time() * 1000),
        "mode": "paper" if cfg.paper else "live",
        "liveConfigured": bool(cfg.bitget_api_key)
    }

@app.get("/api/portfolio")
async def get_portfolio():
    # Update positions in portfolio state before returning
    ui_state["portfolio"]["positions"] = list(engine.positions.values())
    return ui_state["portfolio"]

@app.get("/api/decisions")
async def get_decisions(limit: int = 30):
    return ui_state["decisions"][:limit]

@app.get("/api/trades")
async def get_trades(limit: int = 50):
    return ui_state["trades"][:limit]

@app.get("/api/agents")
async def get_agents(symbol: str, limit: int = 20):
    return ui_state["agents"].get(symbol, [])[:limit]

@app.get("/api/ml")
async def get_ml(symbol: str):
    try:
        df = await engine.client.fetch_ohlcv(symbol, limit=100)
        if len(df) < 30:
            return {"probUp": 0.5, "expectedReturn": 0, "confidence": 0, "trainedSteps": 0, "features": None}
        ml_result = engine.ml.predict(df)
        return ml_result
    except Exception as e:
        return {"probUp": 0.5, "expectedReturn": 0, "confidence": 0, "trainedSteps": 0, "features": None, "error": str(e)}

@app.get("/api/candles")
async def get_candles(symbol: str, limit: int = 200):
    try:
        df = await engine.client.fetch_ohlcv(symbol, limit=limit)
        # Convert pandas DataFrame to list of dicts for JSON
        candles = []
        for _, row in df.iterrows():
            candles.append({
                "symbol": symbol, "timeframe": "1m",
                "openTime": int(row['ts'].timestamp() * 1000) if hasattr(row['ts'], 'timestamp') else int(row['ts']),
                "open": float(row['open']), "high": float(row['high']),
                "low": float(row['low']), "close": float(row['close']),
                "volume": float(row['volume'])
            })
        return candles
    except Exception as e:
        return []

@app.get("/api/ticks")
async def get_ticks():
    ticks = []
    for sym in engine.symbols:
        try:
            ticker = await engine.client.fetch_ticker(sym)
            ticks.append({
                "symbol": sym,
                "price": ticker['last'],
                "ts": int(time.time() * 1000),
                "bid": ticker.get('bid', ticker['last']),
                "ask": ticker.get('ask', ticker['last']),
                "volume24h": ticker.get('quoteVolume24h', 0),
                "change24h": ticker.get('percentage', 0)
            })
        except:
            pass
    ui_state["ticks"] = ticks
    return ticks

@app.get("/api/risk")
async def get_risk():
    return ui_state["risk"]

@app.post("/api/risk")
async def update_risk(req: RiskRequest):
    for k, v in req.dict().items():
        if v is not None:
            ui_state["risk"][k] = v
    return ui_state["risk"]

@app.get("/api/bitget")
async def bitget_proxy(action: str, product: str = "spot", symbol: str | None = None, symbols: str | None = None, leverage: str | None = None, marginMode: str | None = None):
    # Simple proxy for Bitget public data using ccxt
    try:
        if action == "status":
            return {"connected": bool(cfg.bitget_api_key), "host": "api.bitget.com", "publicApi": True, "authenticatedApi": bool(cfg.bitget_api_key)}
        if action == "tickers":
            syms = symbols.split(',') if symbols else []
            tickers = []
            for s in syms:
                t = await engine.client.fetch_ticker(s.replace('USDT', '/USDT'))
                tickers.append({"symbol": s, "lastPr": str(t['last']), "open24h": str(t.get('open', 0)), "high24h": str(t.get('high', 0)), "low24h": str(t.get('low', 0)), "change24h": str(t.get('percentage', 0)), "quoteVolume24h": str(t.get('quoteVolume24h', 0))})
            return {"live": True, "data": tickers}
        if action == "balance":
            if not cfg.bitget_api_key:
                return {"live": False, "configured": False, "message": "API keys not set"}
            balance = await engine.client.fetch_balance()
            assets = [{"coin": coin, "available": float(info.get('free', 0)), "frozen": float(info.get('used', 0)), "total": float(info.get('total', 0))} for coin, info in balance.get('total', {}).items() if float(info.get('total', 0)) > 0]
            return {"live": True, "configured": True, "assets": assets}
        if action == "positions":
            if not cfg.bitget_api_key:
                return {"live": False, "configured": False, "message": "API keys not set"}
            positions = await engine.client.fetch_positions()
            return {"live": True, "configured": True, "data": {"data": positions}}
        return {"error": "unknown action"}
    except Exception as e:
        return {"live": False, "error": str(e)}

@app.post("/api/trade")
async def execute_trade(req: TradeRequest):
    if req.action == "closeAll":
        closed = 0
        for sym in list(engine.positions.keys()):
            await engine._close(sym, "close-all via UI")
            closed += 1
        return {"ok": True, "closed": closed, "errors": []}
    if req.action == "close":
        result = await engine._close(req.symbol, "Manual close via UI")
        return {"ok": True, "trade": result}
    if req.action == "open":
        if not req.symbol or not req.side:
            raise HTTPException(status_code=400, detail="symbol and side required")
        decision = {"signal": req.side, "confidence": 1.0, "rationale": "Manual override by operator"}
        df = await engine.client.fetch_ohlcv(req.symbol, limit=50)
        snap = technical_agent.compute(df)
        atr = snap['indicators']['atr']
        await engine._execute(req.symbol, decision, atr)
        return {"ok": True, "message": f"Opened {req.side} {req.symbol}"}
    raise HTTPException(status_code=400, detail="Invalid action")

@app.post("/api/reset")
async def reset_account():
    engine.cash = cfg.starting_capital
    engine.positions.clear()
    engine.realized_pnl = 0.0
    engine.peak_equity = cfg.starting_capital
    engine.cycle = 0
    ui_state["decisions"].clear()
    ui_state["trades"].clear()
    ui_state["portfolio"] = {"cash": cfg.starting_capital, "equity": cfg.starting_capital, "exposure": 0, "openPnl": 0, "realizedPnl": 0, "dayPnl": 0, "dayPnlPct": 0, "winRate": 0, "positions": []}
    return {"ok": True}

@app.post("/api/engine/start")
async def start_engine():
    global engine_loop_task
    if engine_loop_task and not engine_loop_task.done():
        return {"status": "Engine already running"}
    engine_loop_task = asyncio.create_task(engine.run())
    log.info("Python Engine started via API")
    return {"status": "Engine started"}

@app.post("/api/engine/stop")
async def stop_engine():
    global engine_loop_task
    if engine_loop_task and not engine_loop_task.done():
        engine_loop_task.cancel()
        try:
            await engine_loop_task
        except asyncio.CancelledError:
            pass
        log.info("Python Engine stopped via API")
        return {"status": "Engine stopped"}
    return {"status": "Engine not running"}

@app.post("/api/mode")
async def set_mode(req: dict):
    mode = req.get("mode")
    if mode == "live":
        cfg.paper = False
        engine.paper = False
    else:
        cfg.paper = True
        engine.paper = True
    return {"ok": True, "mode": "paper" if cfg.paper else "live"}

@app.post("/api/symbols")
async def update_symbols(req: SymbolRequest):
    if req.action == "add":
        if req.symbol not in engine.symbols:
            engine.symbols.append(req.symbol)
            log.info(f"Symbol added to engine: {req.symbol}")
        return {"ok": True, "symbols": engine.symbols}
    elif req.action == "remove":
        if req.symbol in engine.symbols:
            engine.symbols.remove(req.symbol)
            log.info(f"Symbol removed from engine: {req.symbol}")
            if req.symbol in engine.positions:
                await engine._close(req.symbol, "Symbol removed from UI")
        return {"ok": True, "symbols": engine.symbols}
    raise HTTPException(status_code=400, detail="Invalid action")

@app.get("/api/symbols")
async def get_symbols():
    return {"symbols": [{"symbol": s, "name": s.split('/')[0], "base": s.split('/')[0], "price": 0, "change24h": 0, "volume24h": 0} for s in engine.symbols]}

@app.get("/api/debug")
async def get_debug():
    return {"entries": [], "total": 0, "bitgetConfigured": bool(cfg.bitget_api_key), "bitgetDemo": cfg.demo}

@app.on_event("shutdown")
async def shutdown_event():
    global engine_loop_task
    if engine_loop_task and not engine_loop_task.done():
        engine_loop_task.cancel()
    await engine.client.close()

if __name__ == "__main__":
    print("=" * 50)
    print("  Neuro Trade Python Core (FastAPI)")
    print("  Running on http://localhost:8000")
    print(f"  Mode: {'PAPER' if cfg.paper else 'LIVE'}")
    print(f"  Symbols: {cfg.symbols}")
    print("=" * 50)
    uvicorn.run(app, host="0.0.0.0", port=8000)
