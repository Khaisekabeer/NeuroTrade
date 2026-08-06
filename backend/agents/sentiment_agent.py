"""Sentiment Agent — fetches crypto news and scores sentiment with an LLM.
Supports Ollama (local Llama 3), OpenAI, and DeepSeek.
"""
from __future__ import annotations
import logging
import json
import aiohttp
from config import cfg

log = logging.getLogger("sentiment")


async def fetch_headlines(symbol: str, limit: int = 6) -> list[str]:
    """Fetch recent news headlines for a symbol from CryptoCompare (free)."""
    base = symbol.split("/")[0]
    try:
        async with aiohttp.ClientSession() as s:
            url = f"https://min-api.cryptocompare.com/data/v2/news/?categories={base}&lang=EN"
            async with s.get(url, timeout=8) as r:
                data = await r.json()
            return [d["title"] for d in data.get("Data", [])[:limit]]
    except Exception as e:
        log.warning(f"news fetch failed for {symbol}: {e}")
        return []


async def call_ollama(messages: list) -> str:
    """Call local Ollama (Llama 3) API."""
    async with aiohttp.ClientSession() as session:
        async with session.post(
            f"{cfg.ollama_url}/api/chat",
            json={"model": cfg.ollama_model, "messages": messages, "stream": False},
        ) as resp:
            if resp.status != 200:
                raise Exception(f"Ollama error {resp.status}")
            data = await resp.json()
            return data.get("message", {}).get("content", "")


async def score(symbol: str) -> dict:
    """Return {signal: -1..1, confidence: 0..1, rationale: str}."""
    headlines = await fetch_headlines(symbol)
    if not headlines:
        return {"signal": 0.0, "confidence": 0.3, "rationale": "No headlines; neutral."}

    messages = [
        {"role": "system", "content": "You are a crypto sentiment analyst. Given headlines, output ONLY JSON: {\"score\": <float -1..1>, \"confidence\": <0..1>, \"reason\": \"<short>\"}"},
        {"role": "user", "content": f"Coin: {symbol}\nHeadlines:\n" + "\n".join(headlines)},
    ]

    try:
        if cfg.llm_provider == "ollama":
            text = await call_ollama(messages)
        elif cfg.llm_provider == "openai" and cfg.openai_api_key:
            from autogen_agentchat.agents import AssistantAgent
            from autogen_agentchat.models import OpenAIChatCompletionClient
            from autogen_agentchat.messages import TextMessage
            model = OpenAIChatCompletionClient(model=cfg.llm_model, api_key=cfg.openai_api_key)
            agent = AssistantAgent(name="sentiment", model_client=model, system_message=messages[0]["content"])
            msg = TextMessage(content=messages[1]["content"], source="user")
            result = await agent.on_messages([msg], cancellation_token=None)
            text = result.chat_message.content
        else:
            # Fallback to lexicon
            raise Exception("No LLM provider configured")

        obj = json.loads(text[text.find("{"):text.rfind("}") + 1])
        return {
            "signal": max(-1, min(1, float(obj.get("score", 0)))),
            "confidence": max(0, min(1, float(obj.get("confidence", 0.5)))),
            "rationale": obj.get("reason", ""),
        }
    except Exception as e:
        log.warning(f"sentiment LLM failed for {symbol}: {e}")
        # Fallback: lexicon-based sentiment
        pos_words = {"surge", "rally", "bullish", "gain", "adoption", "upgrade", "breakout", "support"}
        neg_words = {"crash", "bearish", "hack", "ban", "lawsuit", "dump", "fear", "decline", "sell-off"}
        score_val = 0.0
        for h in headlines:
            words = set(h.lower().split())
            score_val += len(words & pos_words) - len(words & neg_words)
        score_val = max(-1, min(1, score_val / max(len(headlines), 1)))
        return {"signal": score_val, "confidence": 0.5, "rationale": f"Lexicon score from {len(headlines)} headlines"}
