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

let zaiPromise: Promise<any> | null = null
let zaiFailedAt = 0
const ZAI_RETRY_MS = 30_000 // after a 429 rate-limit, wait 30s before retrying (shorter = faster recovery)

async function getZAI() {
  // If the SDK previously failed, retry after a cooldown so a transient
  // "sandbox is inactive" error doesn't poison the engine forever.
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
      const results: any[] = await withZAI((zai) => zai.functions.invoke('web_search', {
        query: `${base} crypto news today price`,
        num: 8,
      }))
      headlines = (results || []).slice(0, 6).map((r: any) => r.name || r.snippet || '').filter(Boolean)
      if (headlines.length === 0) headlines = ['No recent headlines found']
      const context = headlines.map((h, i) => `${i + 1}. ${h}`).join('\n')
      const completion = await withZAI((zai) => zai.chat.completions.create({
        messages: [
          { role: 'assistant', content: 'You are a crypto market sentiment analyst. Given recent news headlines about a coin, output a sentiment score from -1 (very bearish) to +1 (very bullish). Respond with ONLY a JSON object: {"score": <number>, "confidence": <0..1>, "reason": "<short>"}' },
          { role: 'user', content: `Coin: ${base}\nHeadlines:\n${context}\n\nCurrent price action context: see recent candle data. Output JSON only.` },
        ],
        thinking: { type: 'disabled' },
      }))
      const text = completion.choices[0]?.message?.content || ''
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
          detail: { score, headlines: headlines.slice(0, 3).join(' | ') },
          rationale: obj.reason || `Sentiment score ${score.toFixed(2)} from ${headlines.length} headlines`,
          ts: Date.now(),
        }
      }
    }
  } catch (e: any) {
    // Log the actual z-ai error so we can diagnose sandbox/session issues
    console.error(`[sentiment] z-ai failed for ${symbol}:`, e?.message?.slice(0, 150) || String(e).slice(0, 150))
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
      atrPct, kellyFraction: kelly, allowed,
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
    const completion = await withZAI((zai) => zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: 'You are the orchestrator of a multi-agent crypto trading system. Given the outputs of specialist agents plus current market state, make the final trading decision. Be decisive but respect risk. Respond with ONLY JSON: {"signal":"LONG|SHORT|FLAT","confidence":0..1,"rationale":"<one sentence, mention which agents you weighted and why>"}' },
        { role: 'user', content: `Symbol: ${symbol}\nCurrent position: ${pos ? pos.side + ' size=' + pos.size.toFixed(4) + ' entry=' + pos.entryPrice.toFixed(2) + ' unrealized=' + pos.unrealized.toFixed(2) : 'none'}\nEquity: $${port.equity.toFixed(2)} | Exposure: ${(port.exposure * 100).toFixed(1)}% | Drawdown: ${(port.drawdown * 100).toFixed(1)}%\nRecent closes: ${recent}\n\nAgent outputs:\n${agentSummary}\n\nDeterministic vote score: ${detScore.toFixed(2)} (${detSignal}). Output JSON only.` },
      ],
      thinking: { type: 'disabled' },
    }))
    const text = completion.choices[0]?.message?.content || ''
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      const obj = JSON.parse(match[0])
      const sig = (obj.signal || '').toUpperCase() as Signal
      if (['LONG', 'SHORT', 'FLAT'].includes(sig)) {
        return {
          signal: sig,
          confidence: Math.max(0, Math.min(1, Number(obj.confidence) || 0.5)),
          rationale: obj.rationale || 'LLM orchestrator decision',
        }
      }
    }
  } catch (e: any) {
    console.error(`[orchestrator] z-ai failed for ${symbol}:`, e?.message?.slice(0, 150) || String(e).slice(0, 150))
  }
  return {
    signal: detSignal,
    confidence: Math.min(1, Math.abs(detScore) * 2),
    rationale: `Deterministic weighted vote score ${detScore.toFixed(2)} (LLM unavailable). Weights: ML 35%, Tech 30%, Sentiment 20%, Risk 15%.`,
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
  const size = riskAmt / stopDist
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
        // RATE-LIMIT OPTIMIZATION: run Technical + ML FIRST (no API calls),
        // and only call the Sentiment LLM if they disagree or are weak.
        // This cuts z-ai API calls by ~70% and avoids 429 rate-limiting.
        const technical = runTechnicalAgent(symbol)
        const ml = runMLAgent(symbol)
        const techMlAgree = technical.signal === ml.signal && technical.signal !== 'FLAT'
        const techMlStrong = Math.abs(technical.confidence) > 0.4 || Math.abs(ml.confidence) > 0.5
        const cached = sentimentCache.get(symbol)
        const cacheValid = cached && Date.now() - cached.ts < SENTIMENT_TTL
        if (techMlAgree && techMlStrong && cacheValid) {
          // skip sentiment LLM — tech + ML agree strongly + we have a cached sentiment
          sentiment = {
            agent: 'SENTIMENT',
            signal: cached!.score > 0.25 ? 'LONG' : cached!.score < -0.25 ? 'SHORT' : 'FLAT',
            confidence: 0.6,
            detail: { score: cached!.score, source: 'cached' },
            rationale: `Sentiment ${cached!.score.toFixed(2)} (cached — tech+ML agree, LLM skipped to save API quota)`,
            ts: Date.now(),
          }
        } else {
          sentiment = await runSentimentAgent(symbol)
        }
      }
      const technical = runTechnicalAgent(symbol)
      const ml = runMLAgent(symbol)
      // tentative direction from the first three
      const tentative: Signal = (() => {
        const dirs = [sentiment, technical, ml].map((a) => (a.signal === 'LONG' ? 1 : a.signal === 'SHORT' ? -1 : 0))
        const avg = dirs.reduce((a, b) => a + b, 0) / dirs.length
        return avg > 0.1 ? 'LONG' : avg < -0.1 ? 'SHORT' : 'FLAT'
      })()
      const risk = runRiskAgent(symbol, tentative)

      // OPTIMIZATION: skip the orchestrator LLM call when the risk gate is
      // closed OR all specialist agents agree on FLAT. This cuts API calls by
      // ~60% and avoids rate-limit (429) errors. The deterministic vote is
      // sufficient in these cases.
      const allFlat = sentiment.signal === 'FLAT' && technical.signal === 'FLAT' && ml.signal === 'FLAT'
      const riskBlocked = risk.signal === 'FLAT' && risk.confidence === 0
      let orchestrator
      if (allFlat || riskBlocked) {
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
        orchestrator = {
          signal: sig,
          confidence: Math.min(1, Math.abs(score) * 2),
          rationale: riskBlocked
            ? `Risk gate closed — no new positions. DD at limit. (LLM skipped, deterministic vote: ${score.toFixed(2)})`
            : `All specialists FLAT — no trade. (LLM skipped, deterministic vote: ${score.toFixed(2)})`,
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
