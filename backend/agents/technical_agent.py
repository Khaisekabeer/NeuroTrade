"""Technical Agent — computes indicators and emits a trend signal in [-1, +1]."""
from __future__ import annotations
import pandas as pd
import ta


def compute(df: pd.DataFrame) -> dict:
    """df has columns open/high/low/close/volume. Returns indicator snapshot + signal."""
    close, high, low, vol = df["close"], df["high"], df["low"], df["volume"]

    rsi = ta.momentum.RSIIndicator(close, window=14).rsi().iloc[-1]
    macd = ta.trend.MACD(close)
    macd_hist = macd.macd_diff().iloc[-1]
    ema_fast = ta.trend.EMAIndicator(close, window=12).ema_indicator().iloc[-1]
    ema_slow = ta.trend.EMAIndicator(close, window=26).ema_indicator().iloc[-1]
    bb = ta.volatility.BollingerBands(close, window=20)
    pct_b = (close.iloc[-1] - bb.bollinger_lband().iloc[-1]) / (
        bb.bollinger_hband().iloc[-1] - bb.bollinger_lband().iloc[-1]
    )
    atr = ta.volatility.AverageTrueRange(high, low, close, window=14).average_true_range().iloc[-1]
    obv = ta.volume.OnBalanceVolumeIndicator(close, vol).on_balance_volume()
    obv_slope = (obv.iloc[-1] - obv.iloc[-6]) / 5 if len(obv) >= 6 else 0

    # Aggregate trend score in [-1, 1]
    import math
    s = 0.0
    s += (rsi - 50) / 50 * 0.15
    s += math.tanh(macd_hist / close.iloc[-1] * 100) * 0.25
    s += math.tanh((ema_fast - ema_slow) / ema_slow * 100) * 0.30
    s += (pct_b - 0.5) * 2 * 0.15
    s += math.tanh(obv_slope / (abs(obv.iloc[-1]) + 1) * 1000) * 0.15
    s = max(-1, min(1, s))

    return {
        "signal": s,
        "confidence": min(1.0, abs(s) * 1.4),
        "indicators": {
            "rsi": float(rsi), "macd_hist": float(macd_hist),
            "ema_cross": float(ema_fast - ema_slow), "boll_pct_b": float(pct_b),
            "atr": float(atr), "obv_slope": float(obv_slope), "trend_score": float(s),
        },
        "rationale": f"RSI {rsi:.1f} MACDh {macd_hist:.3f} EMAx {ema_fast-ema_slow:.2f} %B {pct_b:.2f}",
    }
