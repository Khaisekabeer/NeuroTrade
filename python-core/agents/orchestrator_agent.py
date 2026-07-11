"""Orchestrator Agent — LLM meta-reasoner that weighs all specialist signals."""
from __future__ import annotations
import json
import logging
from config import cfg

log = logging.getLogger("orchestrator")


def deterministic_vote(agents: dict) -> dict:
    """Weighted fallback vote when LLM is unavailable."""
    w = cfg.weights
    vote, wsum = 0.0, 0.0
    for name, a in agents.items():
        s = a.get("signal", 0)
        c = a.get("confidence", 0.5)
        vote += s * c * w.get(name, 0.2)
        wsum += c * w.get(name, 0.2)
    score = vote / wsum if wsum else 0
    signal = "LONG" if score > 0.2 else "SHORT" if score < -0.2 else "FLAT"
    return {"signal": signal, "confidence": min(1.0, abs(score) * 2),
            "rationale": f"Weighted vote score {score:.2f}"}


async def decide(symbol: str, agents: dict, portfolio: dict, position) -> dict:
    """Returns {signal, confidence, rationale}. Uses LLM if configured."""
    if not cfg.openai_api_key:
        return deterministic_vote(agents)

    try:
        from autogen_agentchat.agents import AssistantAgent
        from autogen_agentchat.models import OpenAIChatCompletionClient
        from autogen_agentchat.messages import TextMessage

        model = OpenAIChatCompletionClient(model=cfg.llm_model, api_key=cfg.openai_api_key)
        agent = AssistantAgent(
            name="orchestrator",
            model_client=model,
            system_message=(
                "You are the orchestrator of a multi-agent crypto trading system. "
                "Make the final decision. Output ONLY JSON: "
                '{"signal":"LONG|SHORT|FLAT","confidence":0..1,"rationale":"<one sentence>"}'
            ),
        )
        summary = "\n".join(f"{n}: signal={a.get('signal')} conf={a.get('confidence'):.2f} | {a.get('rationale')}"
                            for n, a in agents.items())
        pos_str = f"{position['side']} size={position['size']}" if position else "none"
        msg = TextMessage(
            content=(
                f"Symbol: {symbol}\nPosition: {pos_str}\n"
                f"Equity: {portfolio['equity']:.2f} Exposure: {portfolio['exposure']*100:.1f}% "
                f"DD: {portfolio['drawdown']*100:.1f}%\n\nAgents:\n{summary}\n\nOutput JSON only."
            ),
            source="user",
        )
        result = await agent.on_messages([msg], cancellation_token=None)
        text = result.chat_message.content
        obj = json.loads(text[text.find("{"):text.rfind("}") + 1])
        sig = obj.get("signal", "FLAT").upper()
        if sig not in ("LONG", "SHORT", "FLAT"):
            sig = "FLAT"
        return {"signal": sig, "confidence": float(obj.get("confidence", 0.5)),
                "rationale": obj.get("rationale", "")}
    except Exception as e:
        log.warning(f"orchestrator LLM failed, using vote: {e}")
        return deterministic_vote(agents)
