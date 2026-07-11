"""ML Agent — LSTM (sequence) + XGBoost (tabular) ensemble for next-bar forecast."""
from __future__ import annotations
import os
import numpy as np
import pandas as pd
import ta
from config import cfg


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    close, high, low, vol = df["close"], df["high"], df["low"], df["volume"]
    f = pd.DataFrame(index=df.index)
    f["return_1"] = close.pct_change(1)
    f["return_3"] = close.pct_change(3)
    f["return_6"] = close.pct_change(6)
    f["rsi"] = ta.momentum.RSIIndicator(close, 14).rsi()
    f["macd_hist"] = ta.trend.MACD(close).macd_diff()
    f["ema_cross"] = ta.trend.EMAIndicator(close, 12).ema_indicator() - ta.trend.EMAIndicator(close, 26).ema_indicator()
    f["boll_pct_b"] = (close - ta.volatility.BollingerBands(close).bollinger_lband()) / (
        ta.volatility.BollingerBands(close).bollinger_hband() - ta.volatility.BollingerBands(close).bollinger_lband()
    )
    f["atr_pct"] = ta.volatility.AverageTrueRange(high, low, close).average_true_range() / close
    f["vol_norm"] = (vol - vol.rolling(50).mean()) / vol.rolling(50).std()
    f = f.replace([np.inf, -np.inf], np.nan).fillna(0)
    return f


class MLAgent:
    def __init__(self):
        self.lstm = None
        self.xgb = None
        self._load()

    def _load(self):
        try:
            import torch
            from models.lstm_price_model import LSTMPriceModel
            path = os.path.join(cfg.model_dir, "lstm.pt")
            if os.path.exists(path):
                self.lstm = LSTMPriceModel(input_size=9, hidden=64, layers=2)
                self.lstm.load_state_dict(torch.load(path, map_location="cpu"))
                self.lstm.eval()
        except Exception as e:
            print(f"[ml] LSTM load failed: {e}")
        try:
            import xgboost as xgb
            path = os.path.join(cfg.model_dir, "xgb.json")
            if os.path.exists(path):
                self.xgb = xgb.XGBClassifier()
                self.xgb.load_model(path)
        except Exception as e:
            print(f"[ml] XGB load failed: {e}")

    def predict(self, df: pd.DataFrame) -> dict:
        feats = build_features(df)
        if feats.empty:
            return {"signal": 0.0, "confidence": 0.0, "rationale": "no features"}

        # XGBoost direction probability
        xgb_prob = 0.5
        if self.xgb is not None:
            last = feats.iloc[[-1]].drop(columns=["return_1"]).values  # drop target-ish
            xgb_prob = float(self.xgb.predict_proba(last)[0][1])

        # LSTM next-return
        lstm_ret = 0.0
        if self.lstm is not None:
            import torch
            seq = feats.iloc[-32:].values
            if len(seq) >= 32:
                with torch.no_grad():
                    out = self.lstm(torch.tensor(seq[None], dtype=torch.float32))
                lstm_ret = float(out.squeeze().item())

        # Ensemble: blend probability + expected return
        prob_up = 0.5 * xgb_prob + 0.5 * (1 if lstm_ret > 0 else 0) + 0.5 * (0.5 + lstm_ret * 50)
        prob_up = max(0.02, min(0.98, prob_up / 2.0 + 0.25))
        signal = (prob_up - 0.5) * 2  # -1..1
        return {
            "signal": float(signal),
            "confidence": abs(prob_up - 0.5) * 2,
            "rationale": f"LSTM ret={lstm_ret:.4f} XGB P(up)={xgb_prob:.2f} ensemble={prob_up:.2f}",
        }
