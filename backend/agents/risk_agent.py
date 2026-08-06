"""Risk Agent — Kelly position sizing, exposure & drawdown gates."""
from __future__ import annotations
from config import cfg


def assess(portfolio: dict, atr_pct: float, intended_side: str) -> dict:
    """
    portfolio = {equity, exposure, drawdown, peak_equity}
    atr_pct = ATR / price
    Returns {allowed: bool, size: float, stop_dist: float, rationale}
    """
    exposure_ok = portfolio["exposure"] < cfg.max_total_exposure
    dd_ok = portfolio["drawdown"] < cfg.max_drawdown
    allowed = exposure_ok and dd_ok

    risk_amt = portfolio["equity"] * cfg.max_risk_per_trade
    stop_dist = max(atr_pct * cfg.atr_stop_mult, 0.008) * portfolio["equity"]  # fraction
    # Kelly-lite: f = edge/odds, capped at 2*max_risk
    kelly = min(cfg.max_risk_per_trade * 2, risk_amt / (stop_dist or 1))
    size = (portfolio["equity"] * kelly) / (portfolio.get("price", 1) * (atr_pct or 0.01))

    return {
        "allowed": allowed,
        "size": float(size) if allowed else 0.0,
        "stop_dist_pct": float(stop_dist / portfolio["equity"]) if portfolio["equity"] else 0,
        "rationale": (
            f"Exposure {portfolio['exposure']*100:.1f}%/{cfg.max_total_exposure*100:.0f}% "
            f"DD {portfolio['drawdown']*100:.1f}%/{cfg.max_drawdown*100:.0f}% "
            f"Kelly f={kelly:.3f}"
        ),
    }
