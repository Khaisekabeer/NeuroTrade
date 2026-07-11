// Technical indicator library — pure functions over candle arrays.
// All return arrays aligned to the input length (leading values = 0 / NaN-safe).

export function sma(values: number[], period: number): number[] {
  const out: number[] = []
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]
    if (i >= period) sum -= values[i - period]
    out.push(i >= period - 1 ? sum / period : 0)
  }
  return out
}

export function ema(values: number[], period: number): number[] {
  const out: number[] = []
  const k = 2 / (period + 1)
  let prev = values[0] ?? 0
  for (let i = 0; i < values.length; i++) {
    prev = i === 0 ? values[0] : values[i] * k + prev * (1 - k)
    out.push(prev)
  }
  return out
}

export function rsi(closes: number[], period = 14): number[] {
  // returns array aligned to closes.length (leading zeros for warm-up)
  const out: number[] = new Array(closes.length).fill(0)
  if (closes.length <= period) return out
  let gains = 0
  let losses = 0
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff >= 0) gains += diff
    else losses -= diff
  }
  let avgGain = gains / period
  let avgLoss = losses / period
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    const gain = diff >= 0 ? diff : 0
    const loss = diff < 0 ? -diff : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  }
  return out
}

export interface MACDResult {
  macd: number[]
  signal: number[]
  histogram: number[]
}

export function macd(closes: number[], fast = 12, slow = 26, sig = 9): MACDResult {
  const emaFast = ema(closes, fast)
  const emaSlow = ema(closes, slow)
  const macdLine = closes.map((_, i) => emaFast[i] - emaSlow[i])
  const signalLine = ema(macdLine, sig)
  const histogram = macdLine.map((m, i) => m - signalLine[i])
  return { macd: macdLine, signal: signalLine, histogram }
}

export interface BollingerResult {
  upper: number[]
  middle: number[]
  lower: number[]
  percentB: number[] // %B: position within bands
}

export function bollinger(closes: number[], period = 20, mult = 2): BollingerResult {
  const middle = sma(closes, period)
  const upper: number[] = []
  const lower: number[] = []
  const percentB: number[] = []
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      upper.push(0); lower.push(0); percentB.push(0.5); continue
    }
    const slice = closes.slice(i - period + 1, i + 1)
    const mean = middle[i]
    const variance = slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period
    const sd = Math.sqrt(variance)
    const u = mean + mult * sd
    const l = mean - mult * sd
    upper.push(u); lower.push(l)
    percentB.push(u === l ? 0.5 : (closes[i] - l) / (u - l))
  }
  return { upper, middle, lower, percentB }
}

export function atr(highs: number[], lows: number[], closes: number[], period = 14): number[] {
  const tr: number[] = []
  for (let i = 0; i < closes.length; i++) {
    if (i === 0) { tr.push(highs[i] - lows[i]); continue }
    tr.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1]),
    ))
  }
  return ema(tr, period)
}

export function obv(closes: number[], volumes: number[]): number[] {
  const out: number[] = [0]
  for (let i = 1; i < closes.length; i++) {
    const prev = out[i - 1]
    if (closes[i] > closes[i - 1]) out.push(prev + volumes[i])
    else if (closes[i] < closes[i - 1]) out.push(prev - volumes[i])
    else out.push(prev)
  }
  return out
}

export interface TechnicalSnapshot {
  rsi: number
  macd: number
  macdSignal: number
  macdHist: number
  emaFast: number
  emaSlow: number
  emaCross: number // fast - slow
  bollPercentB: number
  atr: number
  obvSlope: number
  trendScore: number // -1..+1 aggregate
}

export function computeSnapshot(candles: { high: number; low: number; close: number; volume: number }[]): TechnicalSnapshot {
  const closes = candles.map((c) => c.close)
  const highs = candles.map((c) => c.high)
  const lows = candles.map((c) => c.low)
  const vols = candles.map((c) => c.volume)
  const n = closes.length
  const last = n - 1
  const rsiArr = rsi(closes, 14)
  const { macd: m, signal: s, histogram: h } = macd(closes)
  const emaF = ema(closes, 12)
  const emaS = ema(closes, 26)
  const bb = bollinger(closes, 20, 2)
  const atrArr = atr(highs, lows, closes, 14)
  const obvArr = obv(closes, vols)
  const obvSlope = obvArr.length > 5 ? (obvArr[last] - obvArr[last - 5]) / 5 : 0

  // Aggregate trend score in [-1, 1]
  let score = 0
  score += (rsiArr[last] - 50) / 50 * 0.15            // RSI momentum
  score += Math.tanh(h[last] / Math.abs(closes[last]) * 100) * 0.25 // MACD hist
  score += Math.tanh((emaF[last] - emaS[last]) / emaS[last] * 100) * 0.3 // EMA cross
  score += (bb.percentB[last] - 0.5) * 2 * 0.15         // Boll position
  score += Math.tanh(obvSlope / (Math.abs(obvArr[last]) + 1) * 1000) * 0.15 // OBV flow
  score = Math.max(-1, Math.min(1, score))

  return {
    rsi: rsiArr[last],
    macd: m[last],
    macdSignal: s[last],
    macdHist: h[last],
    emaFast: emaF[last],
    emaSlow: emaS[last],
    emaCross: emaF[last] - emaS[last],
    bollPercentB: bb.percentB[last],
    atr: atrArr[last],
    obvSlope,
    trendScore: score,
  }
}
