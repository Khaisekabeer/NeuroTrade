"""Train the LSTM + XGBoost models on historical Bitget klines.

Usage:
  python train.py --symbol BTC/USDT --epochs 200
"""
from __future__ import annotations
import argparse
import os
import asyncio
import numpy as np
import pandas as pd
import torch
import torch.nn as nn

from config import cfg
from exchange.bitget_client import BitgetClient
from agents.ml_agent import build_features
from models.lstm_price_model import LSTMPriceModel, make_sequences


async def fetch_long_history(symbol: str, bars: int = 5000) -> pd.DataFrame:
    client = BitgetClient(paper=True)
    try:
        # fetch in chunks of 1000
        all_df = []
        since = None
        while len(all_df) * 1000 < bars:
            raw = await client.ex.fetch_ohlcv(symbol, timeframe=cfg.timeframe, limit=1000, params={"until": since} if since else {})
            if not raw:
                break
            df = pd.DataFrame(raw, columns=["ts", "open", "high", "low", "close", "volume"])
            all_df.append(df)
            since = int(df["ts"].iloc[0].timestamp() * 1000) - 60_000
        await client.close()
        full = pd.concat(all_df).drop_duplicates("ts").sort_values("ts").reset_index(drop=True)
        return full.tail(bars)
    finally:
        await client.close()


def train_xgb(features: pd.DataFrame, target: pd.DataFrame):
    import xgboost as xgb
    X = features.values
    y = (target.shift(-1) > 0).astype(int).fillna(0).values  # next-bar up=1
    split = int(len(X) * 0.8)
    model = xgb.XGBClassifier(n_estimators=300, max_depth=4, learning_rate=0.05, subsample=0.8)
    model.fit(X[:split], y[:split], eval_set=[(X[split:], y[split:])], verbose=False)
    os.makedirs(cfg.model_dir, exist_ok=True)
    model.save_model(os.path.join(cfg.model_dir, "xgb.json"))
    print(f"[train] XGBoost saved. acc={model.score(X[split:], y[split:]):.3f}")


def train_lstm(features: pd.DataFrame, close: pd.Series, epochs: int = 200):
    feats = features.values
    target = close.pct_change(1).shift(-1).fillna(0).values  # next-bar return
    X, y = make_sequences(feats, target, seq_len=32)
    split = int(len(X) * 0.8)
    Xtr, ytr = torch.tensor(X[:split], dtype=torch.float32), torch.tensor(y[:split], dtype=torch.float32)
    Xva, yva = torch.tensor(X[split:], dtype=torch.float32), torch.tensor(y[split:], dtype=torch.float32)

    model = LSTMPriceModel(input_size=feats.shape[1], hidden=64, layers=2)
    opt = torch.optim.Adam(model.parameters(), lr=1e-3)
    loss_fn = nn.MSELoss()
    for ep in range(epochs):
        model.train()
        idx = np.random.permutation(len(Xtr))
        for i in range(0, len(idx), 64):
            b = idx[i:i + 64]
            opt.zero_grad()
            out = model(Xtr[b])
            loss = loss_fn(out.squeeze(), ytr[b])
            loss.backward()
            opt.step()
        if ep % 20 == 0:
            model.eval()
            with torch.no_grad():
                val_loss = loss_fn(model(Xva).squeeze(), yva)
            print(f"[train] epoch {ep} train_loss={loss.item():.6f} val_loss={val_loss.item():.6f}")
    os.makedirs(cfg.model_dir, exist_ok=True)
    torch.save(model.state_dict(), os.path.join(cfg.model_dir, "lstm.pt"))
    print("[train] LSTM saved.")


async def main(symbol: str, epochs: int):
    print(f"[train] fetching history for {symbol}...")
    df = await fetch_long_history(symbol, bars=5000)
    print(f"[train] {len(df)} bars")
    feats = build_features(df)
    train_xgb(feats, df["close"])
    train_lstm(feats, df["close"], epochs=epochs)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--symbol", default="BTC/USDT")
    p.add_argument("--epochs", type=int, default=200)
    args = p.parse_args()
    asyncio.run(main(args.symbol, args.epochs))
