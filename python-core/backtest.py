"""Vectorized backtest of the agent strategy on historical data.

Usage:
  python backtest.py --symbol BTC/USDT --bars 10000
"""
from __future__ import annotations
import argparse
import asyncio
import numpy as np
import pandas as pd
import vectorbt as vbt

from agents import technical_agent, ml_agent
from agents.ml_agent import build_features


async def run(symbol: str, bars: int):
    from exchange.bitget_client import BitgetClient
    client = BitgetClient(paper=True)
    try:
        df = await client.fetch_ohlcv(symbol, limit=min(bars, 1000))
    finally:
        await client.close()

    feats = build_features(df)
    tech = df.apply(lambda r: None, axis=1)  # placeholder
    # compute technical signal series
    import ta
    rsi = ta.momentum.RSIIndicator(df["close"], 14).rsi()
    ema_f = ta.trend.EMAIndicator(df["close"], 12).ema_indicator()
    ema_s = ta.trend.EMAIndicator(df["close"], 26).ema_indicator()
    score = (
        (rsi - 50) / 50 * 0.15
        + np.tanh((ema_f - ema_s) / df["close"] * 100) * 0.30
    ).fillna(0)
    entries = score > 0.2
    exits = score < -0.2

    pf = vbt.Portfolio.from_signals(df["close"], entries, exits,
                                    init_cash=100_000, fees=0.0006,
                                    size_type="value", freq="1T")
    print(pf.stats())
    print(f"\nTotal return: {pf.total_return()*100:.2f}%")
    print(f"Sharpe: {pf.sharpe_ratio():.2f}")
    print(f"Max drawdown: {pf.max_drawdown()*100:.2f}%")
    pf.plot().show()


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--symbol", default="BTC/USDT")
    p.add_argument("--bars", type=int, default=10000)
    args = p.parse_args()
    asyncio.run(run(args.symbol, args.bars))
