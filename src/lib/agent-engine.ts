// Multi-agent orchestration engine.
// Runs a periodic cycle across all symbols. Each cycle:
//   1. Sentiment agent  -> web-search news + LLM scores sentiment (-1..+1)
//   2. Technical agent   -> RSI/MACD/EMA/Boll/ATR/OBV -> trend signal
//   3. ML agent          -> neural net predicts next-bar direction
//   4. Risk agent        -> Kelly position sizing + exposure/drawdown gates
//   5. Orchestrator      -> LLM meta-reasoner weighs all signals -> decision
//   6. Execution         -> open / close / hold position
// All decisions are persisted to the DB and kept in-memory for the dashboard.

import ZAI from 'z-ai-web-dev-sdk'
import { computeSnapshot } from './indicators'
import { buildFeatures as buildNNFeatures, PricePredictor } from './nn'
import { getCandles, getTicks, getRisk, recordDecision, openPosition, closePosition, checkExits, snapshotPortfolio, bumpCycle } from './trading-state'
import { TRADE_SYMBOLS } from './types'
import type { AgentOutput, OrchestratorDecision, Signal, TradeSide } from './types'

// ─────────────────────────────────────────────────────────────────────
// LLM PROVIDER — supports z-ai (default), DeepSeek (free), or OpenAI.
// Set LLM_PROVIDER in .env to switch. DeepSeek is free + open-source:
//   1. Get a free API key at https://platform.deepseek.com (gives $0.50 free credit = ~500K tokens)
//   2. Add to .env:
//        LLM_PROVIDER=deepseek
//        DEEPSEEK_API_KEY=sk-...
//   3. Restart — the sentiment + orchestrator agents use DeepSeek instead of z-ai.
// ─────────────────────────────────────────────────────────────────────

type LlmProvider = 'z-ai' | 'deepseek' | 'openai'
const LLM_PROVIDER: LlmProvider = (process.env.LLM_PROVIDER as LlmProvider) || 'z-ai'
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || ''
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''

// Universal chat completion interface
interface ChatMessage { role: string; content: string }
interface ChatResult { content: string }

let zaiPromise: Promise<any> | null = null
let zaiFailedAt = 0
const ZAI_RETRY_MS = 30_000

async function getZAI() {
  if (zaiPromise === null && zaiFailedAt && Date.now() - zaiFailedAt < ZAI_RETRY_MS) {
    throw new Error('z-ai SDK temporarily unavailable (cooldown)')
  }
  if (zaiPromise === null) {
    zaiPromise = ZAI.create().catch((e) => {
      zaiPromise = null
      zaiFailedAt = Date.now()
      throw e
    })
  }
  return zaiPromise
}

// Universal chat completion — works with z-ai, DeepSeek, or OpenAI.
// DeepSeek is OpenAI-compatible: https://api.deepseek.com/v1/chat/completions
// Models: 'deepseek-chat' (fast, cheap) or 'deepseek-reasoner' (smarter)
async function llmChat(messages: ChatMessage[]): Promise<ChatResult> {
  if (LLM_PROVIDER === 'deepseek') {
    if (!DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY not set in .env')
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: messages.map(m => ({ role: m.role === 'assistant' ? 'system' : m.role, content: m.content })),
        temperature: 0.3,
        max_tokens: 500,
      }),
    })
    if (!res.ok) {
      const errBody = await res.text()
      throw new Error(`DeepSeek API ${res.status}: ${errBody.slice(0, 200)}`)
    }
    const json = await res.json()
    const content = json?.choices?.[0]?.message?.content || ''
    return { content }
  }
  if (LLM_PROVIDER === 'openai') {
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set in .env')
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages.map(m => ({ role: m.role === 'assistant' ? 'system' : m.role, content: m.content })),
        temperature: 0.3,
        max_tokens: 500,
      }),
    })
    if (!res.ok) throw new Error(`OpenAI API ${res.status}`)
    const json = await res.json()
    return { content: json?.choices?.[0]?.message?.content || '' }
  }
  // default: z-ai
  const zai = await getZAI()
  const completion = await zai.chat.completions.create({
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    thinking: { type: 'disabled' },
  })
  return { content: completion.choices[0]?.message?.content || '' }
}

// Universal web search — z-ai has built-in; for DeepSeek/OpenAI we use a free
// news API (CryptoCompare) + pass the headlines to the LLM for scoring.
async function llmSearchNews(query: string, num = 6): Promise<string[]> {
  if (LLM_PROVIDER === 'z-ai') {
    const zai = await getZAI()
    const results: any[] = await zai.functions.invoke('web_search', { query, num })
    return (results || []).slice(0, num).map((r) => r.name || r.snippet || '').filter(Boolean)
  }
  // DeepSeek / OpenAI — use CryptoCompare's free news API (no key needed)
  try {
    const base = query.split(' ')[0]
    const res = await fetch(`https://min-api.cryptocompare.com/data/v2/news/?categories=${base}&lang=EN`, { cache: 'no-store' })
    const json = await res.json()
    return (json?.Data || []).slice(0, num).map((a: any) => a.title || '').filter(Boolean)
  } catch {
    return []
  }
}

// Check if an error indicates rate-limiting (429) or session expiry.
function isRateLimited(e: any): boolean {
  const s = (e?.message ?? '') + ' ' + JSON.stringify(e ?? '')
  return /429|too many requests|rate.?limit/i.test(s)
}

// Reset the SDK so the next getZAI() recreates a fresh session.
function resetZAI() {
  zaiPromise = null
  zaiFailedAt = Date.now()
}

// Safe wrapper: run a z-ai call, catch sandbox-inactive errors, reset the SDK,
// and throw so the caller's fallback logic takes over.
async function withZAI<T>(fn: (zai: any) => Promise<T>): Promise<T> {
  const zai = await getZAI()
  try {
    const result = await fn(zai)
    // Check if the result itself is an error object (SDK returns errors as data)
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      const errStr = JSON.stringify(result)
      if (/inactive|sandbox|429|too many requests/i.test(errStr)) {
        resetZAI()
        throw new Error('z-ai error returned as response: ' + errStr.slice(0, 100))
      }
    }
    return result
  } catch (e: any) {
    if (isRateLimited(e)) {
      resetZAI()  // rate-limited — cool down 60s
    }
    throw e
  }
}

// All engine state is hoisted onto globalThis so that HMR in dev mode does
// not split the instance between instrumentation (starter) and API routes
// (reader). Without this, /api/status would report engine.running=false even
// while the engine is actively running in another module instance.
const ge = globalThis as unknown as {
  __ND_PREDICTORS__?: Map<string, PricePredictor>
  __ND_SENTIMENT__?: Map<string, { score: number; headlines: string[]; ts: number }>
  __ND_ENGINE__?: { started: boolean; cycleTimer: NodeJS.Timeout | null; exitTimer: NodeJS.Timeout | null }
}

// one persistent neural net per symbol (it learns over time)
const predictors: Map<string, PricePredictor> = (ge.__ND_PREDICTORS__ ??= new Map())
function getPredictor(symbol: string) {
  let p = predictors.get(symbol)
  if (!p) { p = new PricePredictor(); predictors.set(symbol, p) }
  return p
}

// sentiment cache (symbol -> { score, ts, headlines })
const sentimentCache: Map<string, { score: number; headlines: string[]; ts: number }> = (ge.__ND_SENTIMENT__ ??= new Map())
const SENTIMENT_TTL = 5 * 60 * 1000 // 5 min

const engine = (ge.__ND_ENGINE__ ??= { started: false, cycleTimer: null as NodeJS.Timeout | null, exitTimer: null as NodeJS.Timeout | null })

export function startAgentEngine(intervalMs = 45_000) {
  if (engine.started) return
  engine.started = true
  // exit checks every 4s (tight SL/TP monitoring) — runs INDEPENDENTLY of the
  // decision cycle so that stopping the bot (stopAgentEngine) does NOT stop
  // SL/TP protection on already-open positions. See stopAgentEngine below.
  if (!engine.exitTimer) {
    engine.exitTimer = setInterval(() => { checkExits().catch(() => {}) }, 4000)
  }
  // run a cycle immediately, then on interval
  runCycle().catch(() => {})
  engine.cycleTimer = setInterval(() => { runCycle().catch(() => {}) }, intervalMs)
}

export function stopAgentEngine() {
  // Halts NEW decisions but KEEPS the exit-checker running so open positions
  // are still protected by their SL/TP. To fully stop everything, call
  // stopAllEngine() instead.
  if (engine.cycleTimer) { clearInterval(engine.cycleTimer); engine.cycleTimer = null }
  engine.started = false
}

export function stopAllEngine() {
  // Full kill — stops decisions AND SL/TP monitoring. Use only if you intend
  // to manually manage or close all positions yourself.
  if (engine.cycleTimer) { clearInterval(engine.cycleTimer); engine.cycleTimer = null }
  if (engine.exitTimer) { clearInterval(engine.exitTimer); engine.exitTimer = null }
  engine.started = false
}

// ---------------- SENTIMENT AGENT ----------------
// ALWAYS runs — news sentiment is a crucial fundamental indicator.
// Uses the universal llmSearchNews + llmChat so it works with z-ai, DeepSeek, or OpenAI.
async function runSentimentAgent(symbol: string): Promise<AgentOutput> {
  const base = symbol.split('/')[0]
  const cached = sentimentCache.get(symbol)
  const useCache = cached && Date.now() - cached.ts < SENTIMENT_TTL
  let score = 0
  let headlines: string[] = []
  try {
    if (useCache) {
      score = cached!.score
      headlines = cached!.headlines
      return {
        agent: 'SENTIMENT',
        signal: score > 0.25 ? 'LONG' : score < -0.25 ? 'SHORT' : 'FLAT',
        confidence: 0.7,
        detail: { score, headlines: headlines.slice(0, 3).join(' | '), source: 'cached' },
        rationale: `Sentiment score ${score.toFixed(2)} (cached) — ${headlines.slice(0, 2).join(' | ')}`,
        ts: Date.now(),
      }
    } else {
      // 1. Fetch news headlines (z-ai web_search OR CryptoCompare for DeepSeek/OpenAI)
      headlines = await llmSearchNews(`${base} crypto news today price`, 6)
      if (headlines.length === 0) headlines = ['No recent headlines found']
      const context = headlines.map((h, i) => `${i + 1}. ${h}`).join('\n')
      // 2. LLM scores the sentiment from the headlines
      const result = await llmChat([
        { role: 'assistant', content: 'You are a crypto market sentiment analyst. Given recent news headlines about a coin, output a sentiment score from -1 (very bearish) to +1 (very bullish). Respond with ONLY a JSON object: {"score": <number>, "confidence": <0..1>, "reason": "<short>"}' },
        { role: 'user', content: `Coin: ${base}\nHeadlines:\n${context}\n\nOutput JSON only.` },
      ])
      const text = result.content || ''
      const match = text.match(/\{[\s\S]*\}/)
      if (match) {
        const obj = JSON.parse(match[0])
        score = Math.max(-1, Math.min(1, Number(obj.score) || 0))
        const conf = Math.max(0, Math.min(1, Number(obj.confidence) || 0.5))
        sentimentCache.set(symbol, { score, headlines, ts: Date.now() })
        return {
          agent: 'SENTIMENT',
          signal: score > 0.25 ? 'LONG' : score < -0.25 ? 'SHORT' : 'FLAT',
          confidence: conf,
          detail: { score, headlines: headlines.slice(0, 3).join(' | '), provider: LLM_PROVIDER },
          rationale: obj.reason || `Sentiment score ${score.toFixed(2)} from ${headlines.length} headlines (${LLM_PROVIDER})`,
          ts: Date.now(),
        }
      }
    }
  } catch (e: any) {
    console.error(`[sentiment] LLM failed for ${symbol} (${LLM_PROVIDER}):`, e?.message?.slice(0, 150) || String(e).slice(0, 150))
  }
  // deterministic fallback: derive a mild sentiment from recent price momentum
  const candles = getCandles(symbol, 30)
  const ret = candles.length >= 2 ? (candles[candles.length - 1].close - candles[candles.length - 6].close) / candles[candles.length - 6].close : 0
  score = Math.max(-1, Math.min(1, ret * 8))
  sentimentCache.set(symbol, { score, headlines: headlines.length ? headlines : ['fallback: momentum-derived'], ts: Date.now() })
  return {
    agent: 'SENTIMENT',
    signal: score > 0.2 ? 'LONG' : score < -0.2 ? 'SHORT' : 'FLAT',
    confidence: 0.45,
    detail: { score, source: 'momentum-fallback' },
    rationale: `Fallback sentiment ${score.toFixed(2)} (derived from 6-bar momentum; web search unavailable)`,
    ts: Date.now(),
  }
}

// ---------------- TECHNICAL AGENT ----------------
function runTechnicalAgent(symbol: string): AgentOutput {
  const candles = getCandles(symbol, 100)
  const snap = computeSnapshot(candles)
  const score = snap.trendScore
  let signal: Signal = 'FLAT'
  if (score > 0.25) signal = 'LONG'
  else if (score < -0.25) signal = 'SHORT'
  const confidence = Math.min(1, Math.abs(score) * 1.4)
  return {
    agent: 'TECHNICAL',
    signal,
    confidence,
    detail: {
      rsi: snap.rsi, macdHist: snap.macdHist, emaCross: snap.emaCross,
      bollPercentB: snap.bollPercentB, atr: snap.atr, trendScore: score,
    },
    rationale: `RSI ${snap.rsi.toFixed(1)} | MACD hist ${snap.macdHist.toFixed(2)} | EMA cross ${(snap.emaCross).toFixed(2)} | %B ${snap.bollPercentB.toFixed(2)} | trend ${score.toFixed(2)}`,
    ts: Date.now(),
  }
}

// ---------------- ML AGENT ----------------
function runMLAgent(symbol: string): AgentOutput {
  const candles = getCandles(symbol, 100)
  const snap = computeSnapshot(candles)
  const features = buildNNFeatures(candles, snap)
  const predictor = getPredictor(symbol)
  // online training: use the last *completed* candle's forward return as label
  if (candles.length >= 3) {
    const prev = candles[candles.length - 2]
    const prevPrev = candles[candles.length - 3]
    const nextReturn = (prev.close - prevPrev.close) / prevPrev.close
    // build features as-of prevPrev close (approx) — for a live demo this is fine
    predictor.train(features, nextReturn)
  }
  const { probUp, expectedReturn, confidence } = predictor.predict(features)
  const signal: Signal = probUp > 0.58 ? 'LONG' : probUp < 0.42 ? 'SHORT' : 'FLAT'
  return {
    agent: 'ML',
    signal,
    confidence: Math.max(0.3, confidence),
    detail: {
      probUp, expectedReturn, trainedSteps: predictor.trainedSteps,
    },
    rationale: `Neural net P(up)=${(probUp * 100).toFixed(1)}% | E[ret]=${(expectedReturn * 100).toFixed(3)}% | trained on ${predictor.trainedSteps} bars`,
    ts: Date.now(),
  }
}

// ---------------- RISK AGENT ----------------
function runRiskAgent(symbol: string, direction: Signal): AgentOutput {
  const port = snapshotPortfolio()
  const risk = getRisk()
  const candles = getCandles(symbol, 50)
  const snap = computeSnapshot(candles)
  const price = candles[candles.length - 1]?.close ?? 0
  const atrPct = price > 0 ? snap.atr / price : 0.01

  // exposure gate
  const exposureOk = port.exposure < risk.maxTotalExposure
  // drawdown gate
  const ddOk = port.drawdown < risk.maxDrawdown
  // Kelly fraction (simplified): f = edge / odds
  const kelly = Math.max(0, Math.min(risk.maxRiskPerTrade * 2, atrPct > 0 ? risk.maxRiskPerTrade / atrPct * 0.5 : 0))
  const allowed = exposureOk && ddOk

  let signal: Signal = 'FLAT'
  if (!allowed) signal = 'FLAT'
  else if (direction === 'LONG') signal = 'LONG'
  else if (direction === 'SHORT') signal = 'SHORT'

  return {
    agent: 'RISK',
    signal,
    confidence: allowed ? Math.min(1, kelly / risk.maxRiskPerTrade) : 0,
    detail: {
      exposure: port.exposure, maxExposure: risk.maxTotalExposure,
      drawdown: port.drawdown, maxDrawdown: risk.maxDrawdown,
      atrPct, kellyFraction: kelly, allowed: allowed ? 1 : 0,
    },
    rationale: allowed
      ? `Exposure ${(port.exposure * 100).toFixed(1)}%/${(risk.maxTotalExposure * 100).toFixed(0)}% | DD ${(port.drawdown * 100).toFixed(1)}%/${(risk.maxDrawdown * 100).toFixed(0)}% | ATR ${atrPct.toFixed(3)} | Kelly f=${kelly.toFixed(3)}`
      : `Risk gate closed: exposure ${(port.exposure * 100).toFixed(1)}% or DD ${(port.drawdown * 100).toFixed(1)}% at limit`,
    ts: Date.now(),
  }
}

// ---------------- ORCHESTRATOR ----------------
async function runOrchestrator(symbol: string, agents: AgentOutput[]): Promise<{ signal: Signal; confidence: number; rationale: string }> {
  // weighted deterministic vote (fallback / baseline)
  const weights: Record<string, number> = { SENTIMENT: 0.2, TECHNICAL: 0.3, ML: 0.35, RISK: 0.15 }
  let vote = 0
  let wsum = 0
  for (const a of agents) {
    const dir = a.signal === 'LONG' ? 1 : a.signal === 'SHORT' ? -1 : 0
    vote += dir * a.confidence * (weights[a.agent] ?? 0.2)
    wsum += a.confidence * (weights[a.agent] ?? 0.2)
  }
  const detScore = wsum > 0 ? vote / wsum : 0
  const detSignal: Signal = detScore > 0.2 ? 'LONG' : detScore < -0.2 ? 'SHORT' : 'FLAT'

  // LLM meta-reasoner — give it the agent outputs and ask for a final call
  try {
    const port = snapshotPortfolio()
    const pos = port.positions.find((p) => p.symbol === symbol)
    const candles = getCandles(symbol, 10)
    const recent = candles.map((c) => c.close.toFixed(2)).join(', ')
    const agentSummary = agents.map((a) =>
      `${a.agent}: signal=${a.signal} conf=${(a.confidence * 100).toFixed(0)}% | ${a.rationale}`
    ).join('\n')
    const result = await llmChat([
      { role: 'assistant', content: 'You are the orchestrator of a multi-agent crypto trading system. Given the outputs of specialist agents plus current market state, make the final trading decision. Be decisive but respect risk. Respond with ONLY JSON: {"signal":"LONG|SHORT|FLAT","confidence":0..1,"rationale":"<one sentence, mention which agents you weighted and why>"}' },
      { role: 'user', content: `Symbol: ${symbol}\nCurrent position: ${pos ? pos.side + ' size=' + pos.size.toFixed(4) + ' entry=' + pos.entryPrice.toFixed(2) + ' unrealized=' + pos.unrealized.toFixed(2) : 'none'}\nEquity: $${port.equity.toFixed(2)} | Exposure: ${(port.exposure * 100).toFixed(1)}% | Drawdown: ${(port.drawdown * 100).toFixed(1)}%\nRecent closes: ${recent}\n\nAgent outputs:\n${agentSummary}\n\nDeterministic vote score: ${detScore.toFixed(2)} (${detSignal}). Output JSON only.` },
    ])
    const text = result.content || ''
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      const obj = JSON.parse(match[0])
      const sig = (obj.signal || '').toUpperCase() as Signal
      if (['LONG', 'SHORT', 'FLAT'].includes(sig)) {
        return {
          signal: sig,
          confidence: Math.max(0, Math.min(1, Number(obj.confidence) || 0.5)),
          rationale: obj.rationale || `LLM orchestrator decision (${LLM_PROVIDER})`,
        }
      }
    }
  } catch (e: any) {
    console.error(`[orchestrator] LLM failed for ${symbol} (${LLM_PROVIDER}):`, e?.message?.slice(0, 150) || String(e).slice(0, 150))
  }
  return {
    signal: detSignal,
    confidence: Math.min(1, Math.abs(detScore) * 2),
    rationale: `Deterministic weighted vote score ${detScore.toFixed(2)} (LLM unavailable, ${LLM_PROVIDER}). Weights: ML 35%, Tech 30%, Sentiment 20%, Risk 15%.`,
  }
}

// ---------------- EXECUTION ----------------
async function executeDecision(symbol: string, decision: { signal: Signal; confidence: number; rationale: string }, atr: number) {
  const port = snapshotPortfolio()
  const pos = port.positions.find((p) => p.symbol === symbol)
  const price = getCandles(symbol, 2)[getCandles(symbol, 2).length - 1]?.close ?? 0
  if (price <= 0) return

  if (decision.signal === 'FLAT') {
    if (pos) await closePosition(symbol, `orchestrator flatten: ${decision.rationale}`)
    return
  }
  // if there's an open position in the opposite direction, flip
  if (pos && pos.side !== decision.signal) {
    await closePosition(symbol, `flip to ${decision.signal}: ${decision.rationale}`)
  }
  // skip if already in same direction
  if (pos && pos.side === decision.signal) return

  const risk = getRisk()
  const riskAmt = port.equity * risk.maxRiskPerTrade * decision.confidence
  const stopDist = Math.max(atr * 1.5, price * 0.008)
  let size = riskAmt / stopDist
  if (size <= 0) return

  // EXPOSURE CAP: cap each position at (equity × maxTotalExposure / number of symbols)
  // so one position doesn't consume the entire exposure budget. This ensures
  // multiple tickers (BTC, ETH, SOL, XRP, DOGE, ADA) can all hold positions.
  const numSymbols = TRADE_SYMBOLS.length
  const perSymbolBudget = port.equity * risk.maxTotalExposure / numSymbols
  const existingNotional = port.positions.reduce((s, p) => {
    const px = getCandles(p.symbol, 2)[getCandles(p.symbol, 2).length - 1]?.close ?? p.entryPrice
    return s + p.size * px
  }, 0)
  const totalBudget = port.equity * risk.maxTotalExposure
  const availableTotal = totalBudget - existingNotional
  if (availableTotal <= 0) {
    console.log(`[execute] ${symbol}: exposure cap reached (${(port.exposure * 100).toFixed(1)}%/${(risk.maxTotalExposure * 100).toFixed(0)}%) — skipping`)
    return
  }
  // cap notional at min(perSymbolBudget, availableTotal) so we leave room for others
  const maxNotional = Math.min(perSymbolBudget, availableTotal)
  const newNotional = size * price
  if (newNotional > maxNotional) {
    size = maxNotional / price
  }
  if (size <= 0) return

  const side: TradeSide = decision.signal === 'LONG' ? 'LONG' : 'SHORT'
  const sl = side === 'LONG' ? price - stopDist : price + stopDist
  const tp = side === 'LONG' ? price + stopDist * 2.2 : price - stopDist * 2.2
  await openPosition(symbol, side, size, sl, tp, decision.confidence, decision.rationale)
}

// ---------------- CYCLE ----------------
async function runCycle() {
  for (let i = 0; i < TRADE_SYMBOLS.length; i++) {
    const symbol = TRADE_SYMBOLS[i].symbol
    try {
      const candles = getCandles(symbol, 100)
      if (candles.length < 10) continue
      const snap = computeSnapshot(candles)

      // Early risk check: if drawdown is already at the limit, skip ALL LLM
      // calls (sentiment + orchestrator) since we can't trade anyway. This
      // prevents wasting z-ai API quota on no-op cycles.
      const port = snapshotPortfolio()
      const riskGloballyBlocked = port.drawdown >= getRisk().maxDrawdown

      let sentiment: AgentOutput
      if (riskGloballyBlocked) {
        // skip sentiment LLM — use cached or momentum fallback
        const cached = sentimentCache.get(symbol)
        if (cached && Date.now() - cached.ts < SENTIMENT_TTL) {
          sentiment = {
            agent: 'SENTIMENT',
            signal: cached.score > 0.25 ? 'LONG' : cached.score < -0.25 ? 'SHORT' : 'FLAT',
            confidence: 0.5,
            detail: { score: cached.score, source: 'cached' },
            rationale: `Sentiment ${cached.score.toFixed(2)} (cached — risk gate closed)`,
            ts: Date.now(),
          }
        } else {
          // quick momentum fallback, no API call
          const ret = candles.length >= 6 ? (candles[candles.length - 1].close - candles[candles.length - 6].close) / candles[candles.length - 6].close : 0
          const score = Math.max(-1, Math.min(1, ret * 8))
          sentiment = {
            agent: 'SENTIMENT',
            signal: score > 0.2 ? 'LONG' : score < -0.2 ? 'SHORT' : 'FLAT',
            confidence: 0.3,
            detail: { score, source: 'momentum-fallback' },
            rationale: `Sentiment ${score.toFixed(2)} (momentum fallback — risk gate closed, LLM skipped)`,
            ts: Date.now(),
          }
        }
      } else {
        // Sentiment ALWAYS runs — news is a crucial fundamental indicator.
        // The 5-min cache prevents redundant API calls within the same cycle.
        sentiment = await runSentimentAgent(symbol)
      }
      const technical = runTechnicalAgent(symbol)
      const ml = runMLAgent(symbol)
      // tentative direction from the first three
      const tentative: Signal = (() => {
        const dirs = [sentiment, technical, ml].map((a) => (a.signal === 'LONG' ? 1 : a.signal === 'SHORT' ? -1 : 0))
        const sum = dirs.reduce((a: number, b: number) => a + b, 0)
        const avg = sum / dirs.length
        return avg > 0.1 ? 'LONG' : avg < -0.1 ? 'SHORT' : 'FLAT'
      })()
      const risk = runRiskAgent(symbol, tentative)

      // OPTIMIZATION: skip the orchestrator LLM call when the risk gate is
      // ACTUALLY closed (drawdown/exposure at limit) OR all specialist agents
      // agree on FLAT. This cuts API calls + avoids rate-limit errors.
      // NOTE: risk.confidence === 0 alone is NOT a reliable "blocked" signal —
      // it can be 0 when the Kelly fraction is tiny even if the gate is open.
      // We check the actual gate conditions from the risk agent's detail.
      const allFlat = sentiment.signal === 'FLAT' && technical.signal === 'FLAT' && ml.signal === 'FLAT'
      const riskActuallyBlocked = risk.detail?.allowed === 0
      const tentativeIsFlat = tentative === 'FLAT'
      let orchestrator
      if (riskActuallyBlocked || (allFlat && tentativeIsFlat)) {
        // use deterministic vote directly — no LLM call needed
        const weights: Record<string, number> = { SENTIMENT: 0.2, TECHNICAL: 0.3, ML: 0.35, RISK: 0.15 }
        let vote = 0, wsum = 0
        for (const a of [sentiment, technical, ml, risk]) {
          const dir = a.signal === 'LONG' ? 1 : a.signal === 'SHORT' ? -1 : 0
          vote += dir * a.confidence * (weights[a.agent] ?? 0.2)
          wsum += a.confidence * (weights[a.agent] ?? 0.2)
        }
        const score = wsum > 0 ? vote / wsum : 0
        const sig: Signal = score > 0.2 ? 'LONG' : score < -0.2 ? 'SHORT' : 'FLAT'
        const dd = (risk.detail?.drawdown as number) || 0
        const mdraw = (risk.detail?.maxDrawdown as number) || 0
        const exp = (risk.detail?.exposure as number) || 0
        const mexpo = (risk.detail?.maxExposure as number) || 0
        orchestrator = {
          signal: sig,
          confidence: Math.min(1, Math.abs(score) * 2),
          rationale: riskActuallyBlocked
            ? `Risk gate closed — DD ${(dd * 100).toFixed(1)}%/${(mdraw * 100).toFixed(0)}% or exposure ${(exp * 100).toFixed(1)}%/${(mexpo * 100).toFixed(0)}%. (deterministic vote: ${score.toFixed(2)})`
            : `All specialists FLAT — no trade. (deterministic vote: ${score.toFixed(2)})`,
        }
      } else {
        orchestrator = await runOrchestrator(symbol, [sentiment, technical, ml, risk])
      }

      const cycle = bumpCycle()
      const decision: OrchestratorDecision = {
        cycle, symbol, signal: orchestrator.signal, confidence: orchestrator.confidence,
        size: 0, stopLoss: 0, takeProfit: 0,
        rationale: orchestrator.rationale,
        agents: [sentiment, technical, ml, risk],
        ts: Date.now(),
      }
      recordDecision(decision)
      await executeDecision(symbol, orchestrator, snap.atr)
    } catch (e) {
      // keep the engine alive even if one symbol fails
      console.error(`[agent-engine] cycle failed for ${symbol}:`, (e as Error).message)
    }
    // stagger symbols by 3s to avoid bursting the z-ai API (prevents 429s)
    if (i < TRADE_SYMBOLS.length - 1) await new Promise((r) => setTimeout(r, 3000))
  }
}

export function getEngineStatus() {
  return { running: engine.started, predictors: predictors.size, sentimentCache: sentimentCache.size }
}

// expose current ML prediction for a symbol (for the dashboard ML panel)
export function getMLPrediction(symbol: string) {
  const candles = getCandles(symbol, 100)
  if (candles.length < 10) return { probUp: 0.5, expectedReturn: 0, confidence: 0, trainedSteps: 0, features: null }
  const snap = computeSnapshot(candles)
  const features = buildNNFeatures(candles, snap)
  const predictor = getPredictor(symbol)
  const { probUp, expectedReturn, confidence } = predictor.predict(features)
  return { probUp, expectedReturn, confidence, trainedSteps: predictor.trainedSteps, features }
}
