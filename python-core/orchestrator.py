"""Main orchestrator loop — the live trading engine.

Runs the 5-agent cycle every `cycle_seconds`, monitors exits every
`exit_check_seconds`, and executes orders on Bitget (paper or live).

Usage:
  python orchestrator.py --symbols BTC/USDT,ETH/USDT --paper
  python orchestrator.py --symbols BTC/USDT --live   # REAL MONEY — caution!
"""
from __future__ import annotations
import argparse
import asyncio
import logging
import time

from config import cfg
from exchange.bitget_client import BitgetClient
from agents import sentiment_agent, technical_agent, ml_agent, risk_agent, orchestrator_agent

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("orchestrator")


class Engine:
    def __init__(self, symbols: list[str], paper: bool):
        self.symbols = symbols
        self.paper = paper
        self.client = BitgetClient(paper=paper)
        self.ml = ml_agent.MLAgent()
        self.cash = cfg.starting_capital
        self.positions: dict[str, dict] = {}
        self.peak_equity = cfg.starting_capital
        self.realized_pnl = 0.0
        self.cycle = 0

    async def portfolio_state(self, prices: dict) -> dict:
        equity = self.cash
        exposure = 0.0
        for sym, p in self.positions.items():
            px = prices.get(sym, p["entry"])
            pnl = (px - p["entry"]) * p["size"] * (1 if p["side"] == "LONG" else -1)
            equity += pnl + p["size"] * p["entry"]  # notional counted once; simplified
            exposure += p["size"] * px
        # Recompute equity properly: cash + position notional + unrealized
        equity = self.cash + sum(
            (prices.get(s, p["entry"]) - p["entry"]) * p["size"] * (1 if p["side"] == "LONG" else -1)
            for s, p in self.positions.items()
        )
        if equity > self.peak_equity:
            self.peak_equity = equity
        dd = (self.peak_equity - equity) / self.peak_equity if self.peak_equity else 0
        return {"equity": equity, "exposure": exposure / equity if equity else 0,
                "drawdown": dd, "peak_equity": self.peak_equity}

    async def run_cycle(self):
        self.cycle += 1
        for symbol in self.symbols:
            try:
                df = await self.client.fetch_ohlcv(symbol, limit=cfg.lookback_bars)
                if len(df) < 30:
                    continue
                price = float(df["close"].iloc[-1])
                prices = {symbol: price}

                # 1. Sentiment
                sent = await sentiment_agent.score(symbol)
                # 2. Technical
                tech = technical_agent.compute(df)
                # 3. ML
                ml = self.ml.predict(df)
                # 4. Risk (preliminary)
                port = await self.portfolio_state(prices)
                atr_pct = tech["indicators"]["atr"] / price if price else 0.01
                # tentative direction
                tentative = (sent["signal"] + tech["signal"] + ml["signal"]) / 3
                risk = risk_agent.assess({**port, "price": price}, atr_pct,
                                         "LONG" if tentative > 0 else "SHORT" if tentative < 0 else "FLAT")
                # 5. Orchestrator
                agents = {"sentiment": sent, "technical": tech, "ml": ml,
                          "risk": {"signal": (1 if risk["allowed"] else 0) * tentative,
                                   "confidence": risk.get("size", 0) and 0.6,
                                   "rationale": risk["rationale"]}}
                decision = await orchestrator_agent.decide(
                    symbol, agents, port, self.positions.get(symbol))

                log.info(f"[c{self.cycle}] {symbol} -> {decision['signal']} "
                         f"conf={decision['confidence']:.2f} | {decision['rationale']}")
                await self.execute(symbol, decision, price, atr_pct)
            except Exception as e:
                log.exception(f"cycle failed for {symbol}: {e}")

    async def execute(self, symbol: str, decision: dict, price: float, atr_pct: float):
        sig = decision["signal"]
        pos = self.positions.get(symbol)
        if sig == "FLAT":
            if pos:
                await self._close(symbol, "orchestrator flatten")
            return
        side = "buy" if sig == "LONG" else "sell"
        if pos and pos["side"] != (sig):
            await self._close(symbol, "flip")
        if pos and pos["side"] == sig:
            return
        stop_dist = price * max(atr_pct * cfg.atr_stop_mult, 0.008)
        risk_amt = (await self.portfolio_state({symbol: price}))["equity"] * cfg.max_risk_per_trade * decision["confidence"]
        size = risk_amt / stop_dist
        if size <= 0:
            return
        await self.client.place_order(symbol, side, size)
        self.positions[symbol] = {"side": sig, "size": size, "entry": price,
                                  "sl": price - stop_dist if sig == "LONG" else price + stop_dist,
                                  "tp": price + stop_dist * cfg.atr_target_mult if sig == "LONG" else price - stop_dist * cfg.atr_target_mult}
        log.info(f"  opened {sig} {symbol} size={size:.4f} @ {price:.2f} SL={self.positions[symbol]['sl']:.2f}")

    async def _close(self, symbol: str, reason: str):
        pos = self.positions.pop(symbol, None)
        if not pos:
            return
        ticker = await self.client.fetch_ticker(symbol)
        px = ticker["last"]
        pnl = (px - pos["entry"]) * pos["size"] * (1 if pos["side"] == "LONG" else -1)
        self.cash += pos["size"] * px + pnl
        self.realized_pnl += pnl
        side = "sell" if pos["side"] == "LONG" else "buy"
        await self.client.place_order(symbol, side, pos["size"])
        log.info(f"  closed {symbol} ({reason}) pnl={pnl:.2f}")

    async def check_exits(self):
        for symbol, pos in list(self.positions.items()):
            try:
                ticker = await self.client.fetch_ticker(symbol)
                px = ticker["last"]
                hit_sl = (pos["side"] == "LONG" and px <= pos["sl"]) or (pos["side"] == "SHORT" and px >= pos["sl"])
                hit_tp = (pos["side"] == "LONG" and px >= pos["tp"]) or (pos["side"] == "SHORT" and px <= pos["tp"])
                if hit_sl:
                    await self._close(symbol, "stop-loss")
                elif hit_tp:
                    await self._close(symbol, "take-profit")
            except Exception as e:
                log.warning(f"exit check failed {symbol}: {e}")

    async def run(self):
        log.info(f"engine start | paper={self.paper} symbols={self.symbols}")
        try:
            while True:
                await self.run_cycle()
                # exit monitor runs in between cycles
                for _ in range(cfg.cycle_seconds // cfg.exit_check_seconds):
                    await self.check_exits()
                    await asyncio.sleep(cfg.exit_check_seconds)
        finally:
            await self.client.close()


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--symbols", default="BTC/USDT,ETH/USDT,SOL/USDT")
    p.add_argument("--paper", action="store_true")
    p.add_argument("--live", action="store_true")
    args = p.parse_args()
    symbols = [s.strip() for s in args.symbols.split(",") if s.strip()]
    paper = not args.live
    if args.live:
        log.warning("LIVE TRADING — real funds at risk. Press Ctrl+C to stop.")
    asyncio.run(Engine(symbols, paper).run())
