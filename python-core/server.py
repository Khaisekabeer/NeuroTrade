"""
FastAPI Server for the Neuro Trade Python Core.
This exposes the Python AI engine (LSTM, XGBoost, ccxt, Llama 3) to the
TypeScript dashboard via a REST API on port 8000.

The TypeScript dashboard acts purely as a UI/remote control. All trading
logic, AI predictions, and Bitget order execution happen here in Python.
"""
from __future__ import annotations
import asyncio
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# Import the existing engine and config
from orchestrator import Engine
from config import cfg

log = logging.getLogger("fastapi")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")

app = FastAPI(title="Neuro Trade Python Core", version="2.0.0")

# Allow the TypeScript dashboard (port 3000) to talk to this server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the engine (but don't start the loop yet)
# The dashboard will send a POST /api/engine/start to begin trading
engine = Engine(cfg.symbols, paper=cfg.paper)
engine_loop_task = None


@app.get("/api/status")
async def get_status():
    """Returns the current state of the Python engine."""
    return {
        "running": engine_loop_task is not None and not engine_loop_task.done(),
        "equity": engine.cash,  # Simplified for API, actual equity requires price fetch
        "cash": engine.cash,
        "positions": list(engine.positions.values()),
        "mode": "paper" if cfg.paper else "live",
        "symbols": engine.symbols,
    }


@app.get("/api/prediction/{symbol}")
async def get_prediction(symbol: str):
    """Runs the ML agents (LSTM + XGBoost) for a specific symbol and returns the forecast."""
    try:
        # Fetch latest candles
        df = await engine.client.fetch_ohlcv(symbol, limit=100)
        if len(df) < 30:
            return {"symbol": symbol, "error": "Not enough data"}

        # Run ML prediction
        ml_result = engine.ml.predict(df)
        
        # Run technical indicators
        tech_result = technical_agent.compute(df)
        
        return {
            "symbol": symbol,
            "ml": ml_result,
            "technical": tech_result,
        }
    except Exception as e:
        log.error(f"Prediction error for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# We need to import technical_agent at the top level for the route above
from agents import technical_agent


class SymbolRequest(BaseModel):
    action: str  # 'add' or 'remove'
    symbol: str


@app.post("/api/symbols")
async def update_symbols(req: SymbolRequest):
    """Dynamically add or remove a trading symbol from the Python engine."""
    if req.action == "add":
        if req.symbol not in engine.symbols:
            engine.symbols.append(req.symbol)
            log.info(f"Symbol added to engine: {req.symbol}")
        return {"ok": True, "symbols": engine.symbols}
    elif req.action == "remove":
        if req.symbol in engine.symbols:
            engine.symbols.remove(req.symbol)
            log.info(f"Symbol removed from engine: {req.symbol}")
            # Close position if open
            if req.symbol in engine.positions:
                await engine._close(req.symbol, "Symbol removed from UI")
        return {"ok": True, "symbols": engine.symbols}
    raise HTTPException(status_code=400, detail="Invalid action")


@app.post("/api/trade")
async def execute_trade(req: TradeRequest):
    """Executes a manual trade via the Python ccxt client."""
    try:
        if req.action == "close":
            result = await engine._close(req.symbol, "Manual close via UI")
            return {"ok": True, "result": result}
        elif req.action == "open":
            if not req.side:
                raise HTTPException(status_code=400, detail="Side required for open")
            
            # Fetch current price
            ticker = await engine.client.fetch_ticker(req.symbol)
            price = ticker['last']
            df = await engine.client.fetch_ohlcv(req.symbol, limit=50)
            snap = technical_agent.compute(df)
            atr = snap['indicators']['atr']
            
            # Execute decision (simplified for manual trade)
            decision = {
                "signal": req.side,
                "confidence": 1.0,  # Manual override = max confidence
                "rationale": "Manual override by operator"
            }
            await engine._execute(req.symbol, decision, atr)
            return {"ok": True, "message": f"Opened {req.side} {req.symbol}"}
        else:
            raise HTTPException(status_code=400, detail="Invalid action")
    except Exception as e:
        log.error(f"Trade execution error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/engine/start")
async def start_engine():
    """Starts the automated 5-agent trading loop in the background."""
    global engine_loop_task
    if engine_loop_task and not engine_loop_task.done():
        return {"status": "Engine already running"}
    
    # Run the engine's main loop as a background asyncio task
    engine_loop_task = asyncio.create_task(engine.run())
    log.info("Python Engine started via API")
    return {"status": "Engine started"}


@app.post("/api/engine/stop")
async def stop_engine():
    """Stops the automated trading loop."""
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


@app.on_event("shutdown")
async def shutdown_event():
    """Clean up ccxt connection when server shuts down."""
    global engine_loop_task
    if engine_loop_task and not engine_loop_task.done():
        engine_loop_task.cancel()
    await engine.client.close()
    log.info("Python Core shutdown: ccxt connection closed.")


if __name__ == "__main__":
    print("=" * 50)
    print("  Neuro Trade Python Core (FastAPI)")
    print("  Running on http://localhost:8000")
    print(f"  Mode: {'PAPER' if cfg.paper else 'LIVE'}")
    print(f"  Symbols: {cfg.symbols}")
    print("=" * 50)
    
    # Start the FastAPI server
    uvicorn.run(app, host="0.0.0.0", port=8000)
