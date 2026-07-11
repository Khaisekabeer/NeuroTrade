"""Central configuration for the trading core."""
import os
from dataclasses import dataclass, field
from dotenv import load_dotenv

load_dotenv()


@dataclass
class Config:
    # Exchange
    bitget_api_key: str = os.getenv("BITGET_API_KEY", "")
    bitget_api_secret: str = os.getenv("BITGET_API_SECRET", "")
    bitget_passphrase: str = os.getenv("BITGET_API_PASSPHRASE", "")
    demo: bool = os.getenv("BITGET_DEMO", "true").lower() == "true"

    # Symbols + timeframe
    symbols: list = field(default_factory=lambda: ["BTC/USDT", "ETH/USDT", "SOL/USDT"])
    timeframe: str = "1m"
    lookback_bars: int = 300

    # Risk
    starting_capital: float = 100_000.0
    max_risk_per_trade: float = 0.02      # 2% of equity
    max_total_exposure: float = 0.60      # 60% deployed
    max_drawdown: float = 0.15            # halt at 15% DD
    leverage_cap: float = 5.0
    atr_stop_mult: float = 1.5
    atr_target_mult: float = 2.2

    # Agent cycle
    cycle_seconds: int = 45
    exit_check_seconds: int = 4

    # LLM
    llm_model: str = os.getenv("LLM_MODEL", "gpt-4o-mini")
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")

    # Modes
    paper: bool = os.getenv("PAPER_MODE", "true").lower() == "true"
    model_dir: str = os.getenv("MODEL_DIR", "./models/saved")

    # Ensemble weights (orchestrator fallback)
    weights: dict = field(default_factory=lambda: {
        "sentiment": 0.20,
        "technical": 0.30,
        "ml": 0.35,
        "risk": 0.15,
    })


cfg = Config()
