"""Sentiment Agent — fetches crypto news and scores sentiment with an LLM.

In production this uses a news API + LLM. Mirrors the Next.js dashboard's
sentiment agent (which uses z-ai web-search + LLM). Returns a signal in [-1, +1].
"""
from __future__ import annotations
import logging
import json
from typing import Optional
from autogen_agentchat.agents import AssistantAgent
from autogen_agentchat.models import OpenAIChatCompletionClient
from config import cfg

log = logging.getLogger("sentiment")


async def fetch_headlines(symbol: str, limit: int = 8) -> list[str]:
    """Fetch recent news headlines for a symbol.

    Replace with a real news provider (CryptoCompare, NewsAPI, Twitter feed, etc.)
    """
    base = symbol.split("/")[0]
    try:
        import aiohttp
        async with aiohttp.ClientSession() as s:
            # Example: cryptoCompare news endpoint (free tier)
            url = f"https://min-api.cryptocompare.com/data/v2/news/?categories={base}&lang=EN"
            async with s.get(url, timeout=8) as r:
                data = await r.json()
            return [d["title"] for d in data.get("Data", [])[:limit]]
    except Exception as e:
        log.warning(f"news fetch failed for {symbol}: {e}")
        return []


async def score(symbol: str) -> dict:
    """Return {signal: -1..1, confidence: 0..1, rationale: str}."""
    headlines = await fetch_headlines(symbol)
    if not headlines:
        return {"signal": 0.0, "confidence": 0.3, "rationale": "No headlines; neutral."}

    if cfg.openai_api_key:
        model = OpenAIChatCompletionClient(model=cfg.llm_model, api_key=cfg.openai_api_key)
        agent = AssistantAgent(
            name="sentiment",
            model_client=model,
            system_message=(
                "You are a crypto sentiment analyst. Given headlines, output ONLY JSON: "
                '{"score": <float -1..1>, "confidence": <0..1>, "reason": "<short>"}'
            ),
        )
        from autogen_agentchat.messages import TextMessage
        msg = TextMessage(content=f"Coin: {symbol}\nHeadlines:\n" + "\n".join(headlines), source="user")
        result = await agent.on_messages([msg], cancellation_token=None)
        text = result.chat_message.content
        try:
            obj = json.loads(text[text.find("{"):text.rfind("}") + 1])
            return {
                "signal": max(-1, min(1, float(obj.get("score", 0)))),
                "confidence": max(0, min(1, float(obj.get("confidence", 0.5)))),
                "rationale": obj.get("reason", ""),
            }
        except Exception:
            pass

    # Fallback: lexicon-based sentiment
    pos_words = {"surge", "rally", "bullish", "gain", "adoption", "upgrade", "breakout", "support"}
    neg_words = {"crash", "bearish", "hack", "ban", "lawsuit", "dump", "fear", "decline", "sell-off"}
    score = 0.0
    for h in headlines:
        words = set(h.lower().split())
        score += len(words & pos_words) - len(words & neg_words)
    score = max(-1, min(1, score / max(len(headlines), 1)))
    return {"signal": score, "confidence": 0.5, "rationale": f"Lexicon score from {len(headlines)} headlines"}
