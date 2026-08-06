module.exports = [
"[externals]/fs/promises [external] (fs/promises, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("fs/promises", () => require("fs/promises"));

module.exports = mod;
}),
"[externals]/os [external] (os, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("os", () => require("os"));

module.exports = mod;
}),
"[project]/src/lib/indicators.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Technical indicator library — pure functions over candle arrays.
// All return arrays aligned to the input length (leading values = 0 / NaN-safe).
__turbopack_context__.s([
    "atr",
    ()=>atr,
    "bollinger",
    ()=>bollinger,
    "computeSnapshot",
    ()=>computeSnapshot,
    "ema",
    ()=>ema,
    "macd",
    ()=>macd,
    "obv",
    ()=>obv,
    "rsi",
    ()=>rsi,
    "sma",
    ()=>sma
]);
function sma(values, period) {
    const out = [];
    let sum = 0;
    for(let i = 0; i < values.length; i++){
        sum += values[i];
        if (i >= period) sum -= values[i - period];
        out.push(i >= period - 1 ? sum / period : 0);
    }
    return out;
}
function ema(values, period) {
    const out = [];
    const k = 2 / (period + 1);
    let prev = values[0] ?? 0;
    for(let i = 0; i < values.length; i++){
        prev = i === 0 ? values[0] : values[i] * k + prev * (1 - k);
        out.push(prev);
    }
    return out;
}
function rsi(closes, period = 14) {
    // returns array aligned to closes.length (leading zeros for warm-up)
    const out = new Array(closes.length).fill(0);
    if (closes.length <= period) return out;
    let gains = 0;
    let losses = 0;
    for(let i = 1; i <= period; i++){
        const diff = closes[i] - closes[i - 1];
        if (diff >= 0) gains += diff;
        else losses -= diff;
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;
    out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    for(let i = period + 1; i < closes.length; i++){
        const diff = closes[i] - closes[i - 1];
        const gain = diff >= 0 ? diff : 0;
        const loss = diff < 0 ? -diff : 0;
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
        out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }
    return out;
}
function macd(closes, fast = 12, slow = 26, sig = 9) {
    const emaFast = ema(closes, fast);
    const emaSlow = ema(closes, slow);
    const macdLine = closes.map((_, i)=>emaFast[i] - emaSlow[i]);
    const signalLine = ema(macdLine, sig);
    const histogram = macdLine.map((m, i)=>m - signalLine[i]);
    return {
        macd: macdLine,
        signal: signalLine,
        histogram
    };
}
function bollinger(closes, period = 20, mult = 2) {
    const middle = sma(closes, period);
    const upper = [];
    const lower = [];
    const percentB = [];
    for(let i = 0; i < closes.length; i++){
        if (i < period - 1) {
            upper.push(0);
            lower.push(0);
            percentB.push(0.5);
            continue;
        }
        const slice = closes.slice(i - period + 1, i + 1);
        const mean = middle[i];
        const variance = slice.reduce((s, v)=>s + (v - mean) ** 2, 0) / period;
        const sd = Math.sqrt(variance);
        const u = mean + mult * sd;
        const l = mean - mult * sd;
        upper.push(u);
        lower.push(l);
        percentB.push(u === l ? 0.5 : (closes[i] - l) / (u - l));
    }
    return {
        upper,
        middle,
        lower,
        percentB
    };
}
function atr(highs, lows, closes, period = 14) {
    const tr = [];
    for(let i = 0; i < closes.length; i++){
        if (i === 0) {
            tr.push(highs[i] - lows[i]);
            continue;
        }
        tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
    }
    return ema(tr, period);
}
function obv(closes, volumes) {
    const out = [
        0
    ];
    for(let i = 1; i < closes.length; i++){
        const prev = out[i - 1];
        if (closes[i] > closes[i - 1]) out.push(prev + volumes[i]);
        else if (closes[i] < closes[i - 1]) out.push(prev - volumes[i]);
        else out.push(prev);
    }
    return out;
}
function computeSnapshot(candles) {
    const closes = candles.map((c)=>c.close);
    const highs = candles.map((c)=>c.high);
    const lows = candles.map((c)=>c.low);
    const vols = candles.map((c)=>c.volume);
    const n = closes.length;
    const last = n - 1;
    const rsiArr = rsi(closes, 14);
    const { macd: m, signal: s, histogram: h } = macd(closes);
    const emaF = ema(closes, 12);
    const emaS = ema(closes, 26);
    const bb = bollinger(closes, 20, 2);
    const atrArr = atr(highs, lows, closes, 14);
    const obvArr = obv(closes, vols);
    const obvSlope = obvArr.length > 5 ? (obvArr[last] - obvArr[last - 5]) / 5 : 0;
    // Aggregate trend score in [-1, 1]
    let score = 0;
    score += (rsiArr[last] - 50) / 50 * 0.15; // RSI momentum
    score += Math.tanh(h[last] / Math.abs(closes[last]) * 100) * 0.25; // MACD hist
    score += Math.tanh((emaF[last] - emaS[last]) / emaS[last] * 100) * 0.3; // EMA cross
    score += (bb.percentB[last] - 0.5) * 2 * 0.15; // Boll position
    score += Math.tanh(obvSlope / (Math.abs(obvArr[last]) + 1) * 1000) * 0.15; // OBV flow
    score = Math.max(-1, Math.min(1, score));
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
        trendScore: score
    };
}
}),
"[project]/src/lib/nn.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Lightweight but REAL neural network for next-bar return prediction.
// Architecture: input layer -> hidden1 (tanh) -> hidden2 (tanh) -> output (sigmoid)
// Trained online via backpropagation with SGD + momentum.
// This is a genuine neural net, not a mock — it actually learns from the
// streaming candle history and updates weights each cycle.
__turbopack_context__.s([
    "PricePredictor",
    ()=>PricePredictor,
    "buildFeatures",
    ()=>buildFeatures
]);
const FEATURE_KEYS = [
    'rsi',
    'macdHist',
    'emaCross',
    'bollPercentB',
    'obvNorm',
    'return1',
    'return3',
    'return6',
    'volatility',
    'volumeNorm'
];
class PricePredictor {
    w1 = [] // [hidden1][input]
    ;
    b1 = [];
    w2 = [] // [hidden2][hidden1]
    ;
    b2 = [];
    w3 = [] // [hidden2]
    ;
    b3 = 0;
    vW1 = [];
    vW2 = [];
    vW3 = [];
    lr = 0.02;
    momentum = 0.9;
    trainCount = 0;
    hidden1 = 16;
    hidden2 = 8;
    // running normalization stats
    mean = {};
    m2 = {};
    constructor(){
        // He/Xavier-ish init
        const xavier = (fanIn)=>(Math.random() * 2 - 1) * Math.sqrt(1 / fanIn);
        this.w1 = Array.from({
            length: this.hidden1
        }, ()=>Array.from({
                length: FEATURE_KEYS.length
            }, ()=>xavier(FEATURE_KEYS.length)));
        this.b1 = new Array(this.hidden1).fill(0);
        this.w2 = Array.from({
            length: this.hidden2
        }, ()=>Array.from({
                length: this.hidden1
            }, ()=>xavier(this.hidden1)));
        this.b2 = new Array(this.hidden2).fill(0);
        this.w3 = Array.from({
            length: this.hidden2
        }, ()=>xavier(this.hidden2));
        this.b3 = 0;
        this.vW1 = this.w1.map((r)=>r.map(()=>0));
        this.vW2 = this.w2.map((r)=>r.map(()=>0));
        this.vW3 = this.w3.map(()=>0);
        for (const k of FEATURE_KEYS){
            this.mean[k] = 0;
            this.m2[k] = 1;
        }
    }
    normalize(f) {
        return FEATURE_KEYS.map((k)=>{
            const v = f[k];
            const sd = Math.sqrt(this.m2[k]) || 1;
            return (v - this.mean[k]) / (sd + 1e-6);
        });
    }
    // update running Welford stats per feature
    updateStats(f) {
        this.trainCount++;
        for (const k of FEATURE_KEYS){
            const v = f[k];
            const delta = v - this.mean[k];
            this.mean[k] += delta / this.trainCount;
            const delta2 = v - this.mean[k];
            this.m2[k] += delta * delta2;
        }
    }
    forward(x) {
        const h1pre = this.b1.map((b, j)=>b + this.w1[j].reduce((s, w, i)=>s + w * x[i], 0));
        const h1 = h1pre.map(Math.tanh);
        const h2pre = this.b2.map((b, j)=>b + this.w2[j].reduce((s, w, i)=>s + w * h1[i], 0));
        const h2 = h2pre.map(Math.tanh);
        const oPre = this.b3 + this.w3.reduce((s, w, j)=>s + w * h2[j], 0);
        const o = sigmoid(oPre);
        return {
            h1pre,
            h1,
            h2pre,
            h2,
            oPre,
            o
        };
    }
    // target: 1 if next-bar return > 0 else 0 (classification of direction)
    // plus we regress a magnitude proxy.
    train(f, nextReturn) {
        this.updateStats(f);
        const x = this.normalize(f);
        const { h1, h2, o } = this.forward(x);
        const target = nextReturn > 0 ? 1 : 0;
        const err = o - target;
        const lr = this.lr;
        // backprop
        const dO = err * dSigmoid(o);
        const dW3 = h2.map((h)=>dO * h);
        const dB3 = dO;
        const dH2 = this.w3.map((w)=>dO * w);
        const dH2pre = dH2.map((d, j)=>d * (1 - h2[j] ** 2));
        const dW2 = dH2pre.map((d)=>h1.map((h)=>d * h));
        const dB2 = dH2pre;
        const dH1 = this.w2.map((row, j)=>row.reduce((s, w, i)=>s + w * dH2pre[j], 0));
        // fix: dH1 indexed by hidden1 unit
        const dH1pre = new Array(this.hidden1).fill(0);
        for(let j = 0; j < this.hidden2; j++){
            for(let i = 0; i < this.hidden1; i++){
                dH1pre[i] += this.w2[j][i] * dH2pre[j];
            }
        }
        for(let i = 0; i < this.hidden1; i++)dH1pre[i] *= 1 - h1[i] ** 2;
        const dW1 = dH1pre.map((d)=>x.map((xi)=>d * xi));
        const dB1 = dH1pre;
        // momentum SGD update
        for(let j = 0; j < this.hidden1; j++){
            for(let i = 0; i < FEATURE_KEYS.length; i++){
                this.vW1[j][i] = this.momentum * this.vW1[j][i] - lr * dW1[j][i];
                this.w1[j][i] += this.vW1[j][i];
            }
            this.b1[j] -= lr * dB1[j];
        }
        for(let j = 0; j < this.hidden2; j++){
            for(let i = 0; i < this.hidden1; i++){
                this.vW2[j][i] = this.momentum * this.vW2[j][i] - lr * dW2[j][i];
                this.w2[j][i] += this.vW2[j][i];
            }
            this.b2[j] -= lr * dB2[j];
        }
        for(let j = 0; j < this.hidden2; j++){
            this.vW3[j] = this.momentum * this.vW3[j] - lr * dW3[j];
            this.w3[j] += this.vW3[j];
        }
        this.b3 -= lr * dB3;
    }
    // returns predicted up-probability + an estimated next-return magnitude
    predict(f) {
        const x = this.normalize(f);
        const { o } = this.forward(x);
        const probUp = clamp(o, 0.02, 0.98);
        // map probability to expected return using a calibrated scale
        const expectedReturn = (probUp - 0.5) * 2 * 0.004 // up to ~0.4% per bar
        ;
        const confidence = Math.abs(probUp - 0.5) * 2;
        return {
            probUp,
            expectedReturn,
            confidence
        };
    }
    get trainedSteps() {
        return this.trainCount;
    }
}
function sigmoid(x) {
    return 1 / (1 + Math.exp(-x));
}
function dSigmoid(s) {
    return s * (1 - s);
}
function clamp(x, lo, hi) {
    return Math.max(lo, Math.min(hi, x));
}
function buildFeatures(candles, snap) {
    const n = candles.length;
    const closes = candles.map((c)=>c.close);
    const last = closes[n - 1];
    const ret = (p)=>p > 0 ? Math.log(last / p) : 0;
    const ret1 = n >= 2 ? ret(closes[n - 2]) : 0;
    const ret3 = n >= 4 ? ret(closes[n - 4]) : 0;
    const ret6 = n >= 7 ? ret(closes[n - 7]) : 0;
    const volWindow = closes.slice(-20);
    const meanClose = volWindow.reduce((a, b)=>a + b, 0) / volWindow.length;
    const variance = volWindow.reduce((a, b)=>a + (b - meanClose) ** 2, 0) / volWindow.length;
    const volatility = Math.sqrt(variance) / meanClose;
    const volumes = candles.map((c)=>c.volume);
    const meanVol = volumes.reduce((a, b)=>a + b, 0) / volumes.length;
    const volumeNorm = meanVol > 0 ? (volumes[n - 1] - meanVol) / meanVol : 0;
    return {
        rsi: (snap.rsi - 50) / 50,
        macdHist: snap.macdHist / (last || 1) * 100,
        emaCross: snap.emaCross / (last || 1) * 100,
        bollPercentB: (snap.bollPercentB - 0.5) * 2,
        obvNorm: Math.tanh(snap.obvSlope / (Math.abs(volumes[n - 1] * 100) + 1)),
        return1: ret1,
        return3: ret3,
        return6: ret6,
        volatility,
        volumeNorm
    };
}
}),
"[project]/src/lib/db.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "db",
    ()=>db
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$29$__ = __turbopack_context__.i("[externals]/@prisma/client [external] (@prisma/client, cjs, [project]/node_modules/@prisma/client)");
;
const globalForPrisma = globalThis;
const db = globalForPrisma.prisma ?? new __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$29$__["PrismaClient"]({
    log: [
        'error'
    ]
});
if ("TURBOPACK compile-time truthy", 1) globalForPrisma.prisma = db;
}),
"[project]/src/lib/types.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Shared trading types for the multi-agent bot
__turbopack_context__.s([
    "TRADE_SYMBOLS",
    ()=>TRADE_SYMBOLS,
    "addSymbol",
    ()=>addSymbol,
    "removeSymbol",
    ()=>removeSymbol
]);
// Mutable runtime list of trading symbols. Hoisted to globalThis so HMR
// doesn't create a new empty array on each reload — the same array
// survives across module re-evaluations.
const _g = globalThis;
const TRADE_SYMBOLS = _g.__ND_TRADE_SYMBOLS__ ??= [];
function addSymbol(sym) {
    if (!TRADE_SYMBOLS.find((s)=>s.symbol === sym.symbol)) {
        TRADE_SYMBOLS.push(sym);
    }
}
function removeSymbol(symbol) {
    const idx = TRADE_SYMBOLS.findIndex((s)=>s.symbol === symbol);
    if (idx >= 0) TRADE_SYMBOLS.splice(idx, 1);
}
}),
"[project]/src/lib/bitget-executor.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Bitget Executor — high-level functions for LIVE trading.
// Called by trading-state.ts when mode === 'live'. In paper mode these are
// not called. Each function hits the /api/bitget route (which signs + sends
// the real HTTP request to Bitget).
//
// Exchange-side SL/TP: when opening a live position, we place TWO plan orders
// on Bitget (one stop-loss, one take-profit). Both are reduce-only triggers
// that the EXCHANGE honors even if your bot goes offline. We store their
// orderIds on the Position row so we can cancel them when manually closing.
// Convert "BTC/USDT" → "BTCUSDT" dynamically (no hardcoded map)
__turbopack_context__.s([
    "_getSpec",
    ()=>_getSpec,
    "cancelOrder",
    ()=>cancelOrder,
    "fetchLiveKlines",
    ()=>fetchLiveKlines,
    "fetchLiveTickers",
    ()=>fetchLiveTickers,
    "loadContractSpecs",
    ()=>loadContractSpecs,
    "placeMarketClose",
    ()=>placeMarketClose,
    "placeMarketEntry",
    ()=>placeMarketEntry,
    "placeStopOrder",
    ()=>placeStopOrder,
    "roundToContractSize",
    ()=>roundToContractSize,
    "setLeverage",
    ()=>setLeverage,
    "setMarginMode",
    ()=>setMarginMode,
    "toBitgetSymbol",
    ()=>toBitgetSymbol
]);
function toBitgetSymbol(symbol) {
    return symbol.replace('/', '');
}
async function postBitget(body) {
    // This runs server-side (Node.js), so we need an absolute URL.
    // Relative URLs like '/api/bitget' only work in the browser.
    const baseUrl = ("TURBOPACK compile-time falsy", 0) ? "TURBOPACK unreachable" : 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/bitget`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
    const data = await res.json().catch(()=>({}));
    return data;
}
async function placeMarketEntry(symbol, side, size, opts) {
    try {
        const bgSym = toBitgetSymbol(symbol);
        const bitgetSide = side === 'LONG' ? 'buy' : 'sell';
        const data = await postBitget({
            kind: 'market',
            symbol: bgSym,
            side: bitgetSide,
            orderType: 'market',
            size: String(size),
            product: opts?.product || 'spot',
            tradeSide: opts?.tradeSide || (bitgetSide === 'buy' ? 'open' : 'close'),
            marginMode: opts?.marginMode || 'isolated'
        });
        if (!data?.live) return {
            ok: false,
            error: data?.message || data?.error || 'order rejected (no live response)'
        };
        // Bitget success: { code: "00000", msg: "success", data: { orderId } }
        // Bitget error:   { code: "11001", msg: "size too small", data: null }
        const bg = data?.data;
        if (bg?.code && bg.code !== '00000') {
            return {
                ok: false,
                error: `Bitget ${bg.code}: ${bg.msg || 'rejected'}`,
                data: bg
            };
        }
        const orderId = bg?.data?.orderId || bg?.orderId || bg?.result?.orderId;
        if (!orderId) {
            return {
                ok: false,
                error: `Bitget response missing orderId: ${JSON.stringify(bg).slice(0, 200)}`,
                data: bg
            };
        }
        return {
            ok: true,
            orderId,
            data: bg
        };
    } catch (e) {
        return {
            ok: false,
            error: e?.message
        };
    }
}
async function setLeverage(symbol, leverage, marginMode = 'isolated') {
    try {
        const bgSym = toBitgetSymbol(symbol);
        const baseUrl = 'http://localhost:3000';
        const res = await fetch(`${baseUrl}/api/bitget?action=set-leverage&product=futures&symbol=${bgSym}&leverage=${leverage}&marginMode=${marginMode}`, {
            cache: 'no-store'
        });
        const data = await res.json().catch(()=>({}));
        if (!data?.live) return {
            ok: false,
            error: data?.message || data?.error || 'set-leverage failed'
        };
        return {
            ok: true,
            data: data.data
        };
    } catch (e) {
        return {
            ok: false,
            error: e?.message
        };
    }
}
async function setMarginMode(symbol, marginMode) {
    try {
        const bgSym = toBitgetSymbol(symbol);
        const baseUrl = 'http://localhost:3000';
        const res = await fetch(`${baseUrl}/api/bitget?action=set-margin-mode&product=futures&symbol=${bgSym}&marginMode=${marginMode}`, {
            cache: 'no-store'
        });
        const data = await res.json().catch(()=>({}));
        if (!data?.live) return {
            ok: false,
            error: data?.message || data?.error || 'set-margin-mode failed'
        };
        return {
            ok: true,
            data: data.data
        };
    } catch (e) {
        return {
            ok: false,
            error: e?.message
        };
    }
}
async function placeStopOrder(symbol, positionSide, size, triggerPrice, kind, opts) {
    try {
        const bgSym = toBitgetSymbol(symbol);
        const orderSide = positionSide === 'LONG' ? 'sell' : 'buy';
        const data = await postBitget({
            kind: 'plan',
            symbol: bgSym,
            side: orderSide,
            orderType: 'market',
            triggerPrice: String(triggerPrice),
            size: String(size),
            triggerType: 'fill_price',
            product: opts?.product || 'spot',
            marginMode: opts?.marginMode || 'isolated'
        });
        if (!data?.live) return {
            ok: false,
            error: data?.message || data?.error || 'plan order rejected'
        };
        const orderId = data?.data?.orderId || data?.data?.data?.orderId || data?.data?.result?.orderId;
        return {
            ok: true,
            orderId,
            data: data.data
        };
    } catch (e) {
        return {
            ok: false,
            error: e?.message
        };
    }
}
async function cancelOrder(symbol, orderId, opts) {
    try {
        const bgSym = toBitgetSymbol(symbol);
        const data = await postBitget({
            kind: 'cancel',
            symbol: bgSym,
            orderId,
            product: opts?.product || 'spot'
        });
        if (!data?.live) return {
            ok: false,
            error: data?.message || data?.error || 'cancel failed'
        };
        return {
            ok: true,
            orderId,
            data: data.data
        };
    } catch (e) {
        return {
            ok: false,
            error: e?.message
        };
    }
}
async function placeMarketClose(symbol, positionSide, size) {
    // To close a LONG, sell. To close a SHORT, buy.
    const closeSide = positionSide === 'LONG' ? 'SHORT' : 'LONG';
    return placeMarketEntry(symbol, closeSide, size, {
        tradeSide: 'close'
    });
}
// Fetch the contract specs (sizeMultiplier, minTradeNum) for futures symbols.
// Bitget's minimum order size varies per symbol:
//   BTC: 0.0001 contracts, ETH: 0.01, SOL: 0.1, XRP/ADA/DOGE: 1
// We must round the order size to the symbol's sizeMultiplier.
const contractSpecsCache = new Map();
let contractSpecsLoaded = false;
async function loadContractSpecs() {
    if (contractSpecsLoaded) return;
    try {
        const res = await fetch('https://api.bitget.com/api/v2/mix/market/contracts?productType=USDT-FUTURES', {
            cache: 'no-store'
        });
        const json = await res.json();
        for (const c of json?.data || []){
            contractSpecsCache.set(c.symbol, {
                sizeMultiplier: parseFloat(c.sizeMultiplier) || 1,
                minTradeNum: parseFloat(c.minTradeNum) || 1
            });
        }
        contractSpecsLoaded = true;
        console.log(`[bitget-executor] loaded ${contractSpecsCache.size} contract specs`);
    } catch (e) {
        console.warn('[bitget-executor] failed to load contract specs:', e.message);
    }
}
function _getSpec(bgSym) {
    return contractSpecsCache.get(bgSym);
}
function roundToContractSize(symbol, size) {
    const bgSym = toBitgetSymbol(symbol);
    const spec = contractSpecsCache.get(bgSym);
    if (!spec) return Math.max(1, Math.floor(size)) // fallback
    ;
    const { sizeMultiplier, minTradeNum } = spec;
    const rounded = Math.floor(size / sizeMultiplier) * sizeMultiplier;
    return Math.max(minTradeNum, rounded);
}
async function fetchLiveTickers(symbols, product = 'spot') {
    try {
        const bgSyms = symbols.map(toBitgetSymbol).join(',');
        // spot:  /api/v2/spot/market/tickers?symbols=BTCUSDT,ETHUSDT  (returns array)
        // futures: /api/v2/mix/market/tickers?productType=USDT-FUTURES&symbol=BTCUSDT  (returns single object per call)
        if (product === 'futures') {
            // futures endpoint takes one symbol at a time, so we fetch in parallel
            const results = await Promise.all(symbols.map(async (sym)=>{
                const bgSym = toBitgetSymbol(sym);
                try {
                    const res = await fetch(`https://api.bitget.com/api/v2/mix/market/tickers?productType=USDT-FUTURES&symbol=${bgSym}`, {
                        cache: 'no-store'
                    });
                    const json = await res.json();
                    const t = Array.isArray(json?.data) ? json.data[0] : json?.data;
                    if (!t) return null;
                    return {
                        symbol: sym,
                        price: parseFloat(t.lastPr || t.last),
                        ts: Date.now(),
                        volume24h: parseFloat(t.baseVolume24h || t.quoteVolume24h) || 0,
                        change24h: parseFloat(t.change24h) || 0
                    };
                } catch  {
                    return null;
                }
            }));
            return results.filter((t)=>t !== null && !isNaN(t.price) && t.price > 0);
        }
        // spot — try batch first, fall back to per-symbol if batch fails/partial
        // Build reverse map from the symbols we requested (dynamic, not hardcoded)
        const reverseMap = {};
        for (const sym of symbols)reverseMap[toBitgetSymbol(sym)] = sym;
        const mapTicker = (t)=>({
                symbol: reverseMap[t.symbol] || t.symbol,
                price: parseFloat(t.lastPr),
                ts: Date.now(),
                volume24h: parseFloat(t.quoteVolume24h) || 0,
                change24h: parseFloat(t.change24h) || 0
            });
        // Try batch request — do NOT use encodeURIComponent (it encodes the comma
        // to %2C which Bitget doesn't parse, causing only the first symbol to return)
        try {
            const res = await fetch(`https://api.bitget.com/api/v2/spot/market/tickers?symbols=${bgSyms}`, {
                cache: 'no-store'
            });
            const json = await res.json();
            const arr = (json?.data || []).filter((t)=>t);
            const mapped = arr.map(mapTicker).filter((t)=>!isNaN(t.price) && t.price > 0);
            // If we got all symbols, return. Otherwise fall back to per-symbol for missing ones.
            if (mapped.length === symbols.length) return mapped;
            // Fall through to per-symbol fetch for missing symbols
            const gotSymbols = new Set(mapped.map((t)=>t.symbol));
            const missing = symbols.filter((s)=>!gotSymbols.has(s));
            const extra = await Promise.all(missing.map(async (sym)=>{
                try {
                    const bgSym = toBitgetSymbol(sym);
                    const r = await fetch(`https://api.bitget.com/api/v2/spot/market/tickers?symbols=${bgSym}`, {
                        cache: 'no-store'
                    });
                    const j = await r.json();
                    const t = Array.isArray(j?.data) ? j.data[0] : j?.data;
                    if (!t) return null;
                    return mapTicker(t);
                } catch  {
                    return null;
                }
            }));
            return [
                ...mapped,
                ...extra.filter((t)=>t !== null && !isNaN(t.price) && t.price > 0)
            ];
        } catch  {
            // batch failed entirely — fetch each symbol individually
            const results = await Promise.all(symbols.map(async (sym)=>{
                try {
                    const bgSym = toBitgetSymbol(sym);
                    const r = await fetch(`https://api.bitget.com/api/v2/spot/market/tickers?symbols=${bgSym}`, {
                        cache: 'no-store'
                    });
                    const j = await r.json();
                    const t = Array.isArray(j?.data) ? j.data[0] : j?.data;
                    if (!t) return null;
                    return mapTicker(t);
                } catch  {
                    return null;
                }
            }));
            return results.filter((t)=>t !== null && !isNaN(t.price) && t.price > 0);
        }
    } catch (e) {
        return [];
    }
}
async function fetchLiveKlines(symbol, limit = 200, product = 'spot') {
    try {
        const bgSym = toBitgetSymbol(symbol);
        const path = product === 'futures' ? `https://api.bitget.com/api/v2/mix/market/candles?productType=USDT-FUTURES&symbol=${bgSym}&granularity=1m&limit=${limit}` : `https://api.bitget.com/api/v2/spot/market/candles?symbol=${bgSym}&granularity=1m&limit=${limit}`;
        const res = await fetch(path, {
            cache: 'no-store'
        });
        const json = await res.json();
        const arr = json?.data || [];
        // Bitget returns [ts, open, high, low, close, volume, ...] newest-first
        return arr.reverse().map((k)=>({
                openTime: parseInt(k[0]),
                open: parseFloat(k[1]),
                high: parseFloat(k[2]),
                low: parseFloat(k[3]),
                close: parseFloat(k[4]),
                volume: parseFloat(k[5])
            })).filter((k)=>!isNaN(k.close));
    } catch (e) {
        return [];
    }
}
}),
"[project]/src/lib/trading-state.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// In-memory trading state singleton shared across Next.js API routes + agent engine.
// The market microservice (mini-services/market-data, port 3003) is the single
// source of truth for prices. This module subscribes to it as a socket.io client,
// maintains rolling candle buffers + portfolio + positions + trades, and exposes
// synchronous getters for API routes. If the WS service is unreachable, it falls
// back to generating a local price feed so the dashboard always works.
__turbopack_context__.s([
    "bumpCycle",
    ()=>bumpCycle,
    "checkExits",
    ()=>checkExits,
    "closeAllPositions",
    ()=>closeAllPositions,
    "closePosition",
    ()=>closePosition,
    "connectMarket",
    ()=>connectMarket,
    "getAgentOutputs",
    ()=>getAgentOutputs,
    "getCandles",
    ()=>getCandles,
    "getCycle",
    ()=>getCycle,
    "getDecisions",
    ()=>getDecisions,
    "getMode",
    ()=>getMode,
    "getRisk",
    ()=>getRisk,
    "getTicks",
    ()=>getTicks,
    "getTrades",
    ()=>getTrades,
    "isLiveConfigured",
    ()=>isLiveConfigured,
    "manualClose",
    ()=>manualClose,
    "manualOpen",
    ()=>manualOpen,
    "notifySymbolRemoved",
    ()=>notifySymbolRemoved,
    "openPosition",
    ()=>openPosition,
    "recordDecision",
    ()=>recordDecision,
    "resetPaperAccount",
    ()=>resetPaperAccount,
    "restoreFromDb",
    ()=>restoreFromDb,
    "seedNewSymbol",
    ()=>seedNewSymbol,
    "setMode",
    ()=>setMode,
    "setRisk",
    ()=>setRisk,
    "snapshotPortfolio",
    ()=>snapshotPortfolio
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$types$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/types.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$bitget$2d$executor$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/bitget-executor.ts [instrumentation] (ecmascript)");
;
;
;
const MAX_CANDLES = 300;
const MARKET_URL = 'http://localhost:3003' // internal — only used server-side
;
function seedPrices() {
    const m = new Map();
    for (const s of __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$types$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["TRADE_SYMBOLS"]){
        m.set(s.symbol, {
            price: s.price,
            ts: Date.now(),
            bid: s.price * 0.9999,
            ask: s.price * 1.0001,
            volume24h: 1.2e9,
            change24h: 0
        });
    }
    return m;
}
function seedCandles() {
    const m = new Map();
    for (const s of __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$types$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["TRADE_SYMBOLS"]){
        const arr = [];
        let price = s.price * 0.985;
        const now = Date.now();
        for(let i = MAX_CANDLES - 1; i >= 0; i--){
            const open = price;
            const drift = (Math.random() - 0.48) * s.price * 0.002;
            const close = Math.max(0.01, open + drift);
            const high = Math.max(open, close) * (1 + Math.random() * 0.0015);
            const low = Math.min(open, close) * (1 - Math.random() * 0.0015);
            const volume = (1e6 + Math.random() * 5e6) * (s.base === 'BTC' ? 1 : s.base === 'ETH' ? 5 : 50);
            arr.push({
                symbol: s.symbol,
                timeframe: '1m',
                openTime: now - i * 60_000,
                open,
                high,
                low,
                close,
                volume
            });
            price = close;
        }
        m.set(s.symbol, arr);
    }
    return m;
}
// IMPORTANT: hoist state to globalThis so HMR in dev mode does not split the
// module instance between instrumentation (which starts the engine) and the
// API routes (which read state). Without this, the dashboard would see a fresh
// empty state separate from the one the engine is writing to.
const g = globalThis;
const state = g.__ND_STATE__ ??= {
    candles: seedCandles(),
    ticks: seedPrices(),
    portfolio: {
        cash: 100_000,
        equity: 100_000,
        exposure: 0,
        openPnl: 0,
        realizedPnl: 0,
        dayPnl: 0,
        dayPnlPct: 0,
        winRate: 0
    },
    positions: new Map(),
    trades: [],
    decisions: [],
    agentOutputs: new Map(),
    risk: {
        maxRiskPerTrade: 0.02,
        maxTotalExposure: 0.6,
        maxDrawdown: 0.15,
        leverageCap: 20,
        product: 'spot',
        marginMode: 'isolated',
        leverage: 10
    },
    startedAt: Date.now(),
    dayStartEquity: 100_000,
    peakEquity: 100_000,
    cycle: 0,
    connected: false,
    mode: 'paper',
    livePriceTimer: null,
    liveBalanceTimer: null,
    liveTickerLoaded: false,
    lastLiveError: null
};
// wire up socket client to market microservice (also globalThis-guarded)
let socket = g.__ND_SOCKET__ ?? null;
let fallbackTimer = g.__ND_FALLBACK__ ?? null;
function startFallback() {
    if (fallbackTimer) return;
    // generate ticks locally every 1.5s so the dashboard keeps working
    g.__ND_FALLBACK__ = fallbackTimer = setInterval(()=>{
        for (const s of __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$types$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["TRADE_SYMBOLS"]){
            const t = state.ticks.get(s.symbol);
            const drift = (Math.random() - 0.5) * t.price * 0.0015;
            const newPrice = Math.max(0.01, t.price + drift);
            applyTick(s.symbol, newPrice);
        }
    }, 1500);
}
function stopFallback() {
    if (fallbackTimer) {
        clearInterval(fallbackTimer);
        fallbackTimer = null;
        g.__ND_FALLBACK__ = null;
    }
}
function applyTick(symbol, price) {
    const t = state.ticks.get(symbol);
    if (!t) return;
    const prev = t.price;
    t.price = price;
    t.ts = Date.now();
    t.bid = price * 0.9999;
    t.ask = price * 1.0001;
    t.change24h = (price - prev) / prev * 100 + t.change24h * 0.999;
    // update last candle close/high/low
    const arr = state.candles.get(symbol);
    if (arr && arr.length) {
        const last = arr[arr.length - 1];
        last.close = price;
        last.high = Math.max(last.high, price);
        last.low = Math.min(last.low, price);
        last.volume += Math.random() * 1000;
    }
    updateUnrealized();
}
function pushNewCandle(c) {
    const arr = state.candles.get(c.symbol);
    if (!arr) return;
    arr.push(c);
    if (arr.length > MAX_CANDLES) arr.shift();
}
// ---- LIVE PRICE POLLING (real Bitget public API) ----
// When mode='live', we poll Bitget's public ticker endpoint every 2s and
// update the in-memory ticks + last candle. This replaces both the simulated
// microservice AND the local fallback generator.
async function pollLivePrices() {
    const symbols = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$types$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["TRADE_SYMBOLS"].map((s)=>s.symbol);
    const product = state.risk.product;
    const gotSymbols = new Set();
    // In futures mode: fetch FUTURES prices first (this is what the bot trades on)
    if (product === 'futures') {
        const futTicks = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$bitget$2d$executor$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["fetchLiveTickers"])(symbols, 'futures');
        for (const t of futTicks){
            applyTick(t.symbol, t.price);
            const existing = state.ticks.get(t.symbol);
            if (existing) {
                existing.volume24h = t.volume24h;
                existing.change24h = t.change24h;
            }
            gotSymbols.add(t.symbol);
        }
    }
    // For any symbols NOT updated by futures (or in spot mode), fetch spot prices
    const missing = symbols.filter((s)=>!gotSymbols.has(s));
    if (missing.length > 0) {
        const spotTicks = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$bitget$2d$executor$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["fetchLiveTickers"])(missing, 'spot');
        for (const t of spotTicks){
            applyTick(t.symbol, t.price);
            const existing = state.ticks.get(t.symbol);
            if (existing) {
                existing.volume24h = t.volume24h;
                existing.change24h = t.change24h;
            }
            gotSymbols.add(t.symbol);
        }
    }
    // Log any symbols that still didn't get a price
    const stillMissing = symbols.filter((s)=>!gotSymbols.has(s));
    if (stillMissing.length > 0) {
        console.warn(`[pollLivePrices] no price for: ${stillMissing.join(', ')}`);
    }
    state.connected = true;
}
async function startLivePricePolling() {
    if (state.livePriceTimer) return;
    const product = state.risk.product;
    // load futures contract specs (sizeMultiplier, minTradeNum) for order sizing
    if (product === 'futures') {
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$bitget$2d$executor$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["loadContractSpecs"])();
    }
    // bootstrap candle history from Bitget once
    if (!state.liveTickerLoaded) {
        state.liveTickerLoaded = true;
        for (const s of __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$types$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["TRADE_SYMBOLS"]){
            const klines = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$bitget$2d$executor$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["fetchLiveKlines"])(s.symbol, 200, product);
            if (klines.length) {
                const candles = klines.map((k)=>({
                        symbol: s.symbol,
                        timeframe: '1m',
                        openTime: k.openTime,
                        open: k.open,
                        high: k.high,
                        low: k.low,
                        close: k.close,
                        volume: k.volume
                    }));
                state.candles.set(s.symbol, candles.slice(-MAX_CANDLES));
            }
        }
        console.log(`[trading-state] live mode: bootstrapped ${product} candle history from Bitget`);
    }
    // initial poll
    pollLivePrices().catch(()=>{});
    // then every 5s (was 2s — too fast, caused UI glitching)
    state.livePriceTimer = setInterval(()=>{
        pollLivePrices().catch(()=>{});
    }, 5000);
    // re-sync balance + positions every 15s (was 10s — reduced API load)
    state.liveBalanceTimer = setInterval(()=>{
        syncLiveBalance().catch(()=>{});
        syncLivePositions().catch(()=>{});
    }, 15_000);
    console.log(`[trading-state] live mode: polling prices every 5s + balance/positions every 15s`);
}
// Sync positions with Bitget — fetch real open positions + reconcile.
// If a position exists in memory but NOT on Bitget → it was closed (SL/TP hit)
// → delete from memory + record P/L.
// If a position exists on Bitget but NOT in memory → orphan → close it.
async function syncLivePositions() {
    if (!isLiveConfigured() || state.mode !== 'live') return;
    try {
        const product = state.risk.product;
        if (product !== 'futures') return; // spot positions are different
        const res = await fetch(`http://localhost:3000/api/bitget?action=positions&product=${product}`);
        const data = await res.json().catch(()=>({}));
        if (!data?.live || !data?.data?.data) return;
        const bitgetPositions = data.data.data || [];
        const bitgetSymbols = new Set();
        // Import orphan positions (exist on Bitget but not in memory)
        for (const p of bitgetPositions){
            const sym = (p.symbol || p.s || '').replace('USDT', '/USDT');
            if (!sym) continue;
            bitgetSymbols.add(sym);
            if (!state.positions.has(sym)) {
                // Orphan position on Bitget — import it so the bot tracks it
                // Use holdSide from Bitget (more reliable than sign of total)
                const holdSide = (p.holdSide || '').toLowerCase();
                const side = holdSide === 'short' ? 'SHORT' : holdSide === 'long' ? 'LONG' : parseFloat(p.total || '0') >= 0 ? 'LONG' : 'SHORT';
                const total = parseFloat(p.total || p.size || p.pos || '0');
                const size = Math.abs(total);
                const entryPrice = parseFloat(p.openPriceAvg || p.averageOpen || p.entryPrice || '0');
                const liquidationPrice = parseFloat(p.liquidationPrice || '0');
                const sl = liquidationPrice > 0 ? liquidationPrice : entryPrice * 0.95;
                const tp = entryPrice * 1.10;
                console.log(`[syncPositions] importing orphan position ${sym} ${side} size=${size} entry=${entryPrice} (holdSide=${holdSide})`);
                state.positions.set(sym, {
                    symbol: sym,
                    side,
                    size,
                    entryPrice,
                    stopLoss: sl,
                    takeProfit: tp,
                    unrealized: 0,
                    openedAt: Date.now()
                });
            }
        }
        // Remove stale positions (in memory but NOT on Bitget → already closed)
        for (const [symbol, pos] of state.positions.entries()){
            if (!bitgetSymbols.has(symbol)) {
                console.log(`[syncPositions] ${symbol} closed on Bitget but still in memory — syncing`);
                const t = state.ticks.get(symbol);
                const price = t?.price ?? pos.entryPrice;
                const pnl = pos.side === 'LONG' ? (price - pos.entryPrice) * pos.size : (pos.entryPrice - price) * pos.size;
                state.portfolio.cash += pnl;
                state.portfolio.realizedPnl += pnl;
                state.positions.delete(symbol);
                const trade = state.trades.find((tr)=>tr.symbol === symbol && tr.status === 'OPEN');
                if (trade) {
                    trade.status = 'CLOSED';
                    trade.exitPrice = price;
                    trade.pnl = pnl;
                    trade.closedAt = Date.now();
                    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["db"].trade.updateMany({
                        where: {
                            id: trade.id
                        },
                        data: {
                            status: 'CLOSED',
                            exitPrice: price,
                            pnl,
                            closedAt: new Date()
                        }
                    }).catch(()=>{});
                }
                __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["db"].position.deleteMany({
                    where: {
                        symbol
                    }
                }).catch(()=>{});
            }
        }
    } catch  {
    // ignore — will retry in 10s
    }
}
// This keeps the dashboard equity in sync with reality — picks up realized
// P/L from positions closed on Bitget directly, deposits, withdrawals, etc.
async function syncLiveBalance() {
    if (!isLiveConfigured()) return;
    try {
        const product = state.risk.product;
        const res = await fetch(`http://localhost:3000/api/bitget?action=balance&product=${product}`);
        const data = await res.json().catch(()=>({}));
        if (data?.live && Array.isArray(data?.assets)) {
            const usdt = data.assets.find((a)=>a.coin === 'USDT');
            const realBalance = usdt?.total ?? 0;
            if (realBalance > 0) {
                // In LIVE mode: cash = real Bitget balance, equity = cash
                // (the real balance already includes unrealized P/L via margin)
                state.portfolio.cash = realBalance;
                state.portfolio.equity = realBalance;
                if (state.portfolio.equity > state.peakEquity) state.peakEquity = state.portfolio.equity;
            }
        }
    } catch  {
    // ignore — will retry in 30s
    }
}
function stopLivePricePolling() {
    if (state.livePriceTimer) {
        clearInterval(state.livePriceTimer);
        state.livePriceTimer = null;
    }
    if (state.liveBalanceTimer) {
        clearInterval(state.liveBalanceTimer);
        state.liveBalanceTimer = null;
    }
}
async function setMode(mode) {
    if (state.mode === mode) return;
    if (mode === 'live') {
        // switching to live: stop simulated feed, start real polling
        stopFallback();
        if (socket) {
            try {
                socket.disconnect();
            } catch  {}
            socket = null;
            g.__ND_SOCKET__ = null;
        }
        state.mode = 'live';
        startLivePricePolling();
        // CRITICAL: sync the portfolio equity to the REAL Bitget balance.
        // Uses the selected product (spot or futures) for the balance fetch.
        try {
            const product = state.risk.product;
            const res = await fetch(`http://localhost:3000/api/bitget?action=balance&product=${product}`);
            const data = await res.json().catch(()=>({}));
            if (data?.live && Array.isArray(data?.assets)) {
                const usdt = data.assets.find((a)=>a.coin === 'USDT');
                const realBalance = usdt?.total ?? 0;
                if (realBalance > 0) {
                    state.portfolio.cash = realBalance;
                    state.portfolio.equity = realBalance;
                    state.portfolio.realizedPnl = 0;
                    state.portfolio.openPnl = 0;
                    state.portfolio.exposure = 0;
                    state.portfolio.dayPnl = 0;
                    state.portfolio.dayPnlPct = 0;
                    state.peakEquity = realBalance;
                    state.dayStartEquity = realBalance;
                    console.log(`[trading-state] LIVE mode: synced real Bitget balance $${realBalance.toFixed(2)} as equity`);
                } else {
                    console.warn('[trading-state] LIVE mode: no USDT balance found in Bitget account');
                }
            }
        } catch (e) {
            console.error('[trading-state] LIVE mode: failed to sync Bitget balance:', e.message);
        }
        console.log('[trading-state] switched to LIVE mode — real Bitget prices + real orders + real balance');
    } else {
        // switching to paper: stop live polling, restart with real Bitget prices (paper execution)
        stopLivePricePolling();
        state.mode = 'paper';
        state.connected = false;
        // restore paper equity
        state.portfolio.cash = 100_000 + state.portfolio.realizedPnl;
        updateUnrealized();
        state.peakEquity = Math.max(state.portfolio.equity, state.peakEquity);
        connectMarket(); // now always uses real Bitget prices
        console.log('[trading-state] switched to PAPER mode — real Bitget prices + in-memory execution');
    }
}
function getMode() {
    return state.mode;
}
function seedNewSymbol(symbol, price) {
    if (!state.ticks.has(symbol)) {
        state.ticks.set(symbol, {
            price,
            ts: Date.now(),
            bid: price * 0.9999,
            ask: price * 1.0001,
            volume24h: 0,
            change24h: 0
        });
    }
    if (!state.candles.has(symbol)) {
        const arr = [];
        const now = Date.now();
        let p = price * 0.99;
        for(let i = 99; i >= 0; i--){
            const open = p;
            const drift = (Math.random() - 0.5) * price * 0.002;
            const close = Math.max(0.01, open + drift);
            arr.push({
                symbol,
                timeframe: '1m',
                openTime: now - i * 60_000,
                open,
                high: Math.max(open, close),
                low: Math.min(open, close),
                close,
                volume: 1000
            });
            p = close;
        }
        state.candles.set(symbol, arr);
    }
    // Notify the market microservice to start streaming this symbol
    if (socket && socket.connected) {
        socket.emit('add-symbol', {
            symbol,
            price
        });
    }
}
function notifySymbolRemoved(symbol) {
    if (socket && socket.connected) {
        socket.emit('remove-symbol', {
            symbol
        });
    }
}
function isLiveConfigured() {
    return !!(process.env.BITGET_API_KEY && process.env.BITGET_API_SECRET && process.env.BITGET_API_PASSPHRASE);
}
function connectMarket() {
    // ALWAYS use real Bitget public API prices — even in PAPER mode.
    // This ensures the trading panel shows accurate prices matching Bitget.
    // PAPER mode: real prices + in-memory execution (no real orders)
    // LIVE mode: real prices + real Bitget orders
    startLivePricePolling();
}
function updateUnrealized() {
    let openPnl = 0;
    let exposure = 0;
    for (const pos of state.positions.values()){
        const t = state.ticks.get(pos.symbol);
        const price = t?.price ?? pos.entryPrice;
        const pnl = pos.side === 'LONG' ? (price - pos.entryPrice) * pos.size : (pos.entryPrice - price) * pos.size;
        pos.unrealized = pnl;
        openPnl += pnl;
        exposure += pos.size * price;
    }
    state.portfolio.openPnl = openPnl;
    // In LIVE mode: equity = cash (the real Bitget balance, which already
    // accounts for unrealized P/L via the margin system). Don't add openPnl
    // again — that would double-count the loss.
    // In PAPER mode: equity = cash + openPnl (the paper margin model)
    if (state.mode === 'live') {
        state.portfolio.equity = state.portfolio.cash;
    } else {
        state.portfolio.equity = state.portfolio.cash + openPnl;
    }
    // Bug #9: Exposure should be margin-based, not notional-based.
    // For futures: margin = notional / leverage. Exposure = total margin / equity.
    const leverage = state.risk.product === 'futures' ? Math.min(state.risk.leverage, state.risk.leverageCap) : 1;
    const totalMargin = exposure / leverage;
    state.portfolio.exposure = state.portfolio.equity > 0 ? totalMargin / state.portfolio.equity : 0;
    if (state.portfolio.equity > state.peakEquity) state.peakEquity = state.portfolio.equity;
    state.portfolio.dayPnl = state.portfolio.equity - state.dayStartEquity;
    state.portfolio.dayPnlPct = state.dayStartEquity > 0 ? state.portfolio.dayPnl / state.dayStartEquity : 0;
}
async function openPosition(symbol, side, size, stopLoss, takeProfit, confidence, rationale) {
    const t = state.ticks.get(symbol);
    if (!t) return null;
    const price = side === 'LONG' ? t.ask : t.bid;
    // Derivatives/margin model: cash is collateral, not debited by notional.
    // The max notional is equity × leverage (for futures) or equity (for spot).
    updateUnrealized();
    const equity = state.portfolio.equity;
    if (equity <= 0) return null;
    const leverage = state.risk.product === 'futures' ? Math.min(state.risk.leverage, state.risk.leverageCap) : 1;
    let currentNotional = 0;
    for (const p of state.positions.values()){
        const px = state.ticks.get(p.symbol)?.price ?? p.entryPrice;
        currentNotional += p.size * px;
    }
    const maxNotional = equity * leverage;
    const availableNotional = maxNotional - currentNotional;
    if (availableNotional <= 0) return null;
    let notional = size * price;
    if (notional > availableNotional) {
        size = availableNotional / price;
        notional = size * price;
        if (size <= 0) return null;
    }
    // For futures: round to the symbol's contract size multiplier (e.g. SOL=0.1, BTC=0.0001)
    if (state.risk.product === 'futures') {
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$bitget$2d$executor$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["loadContractSpecs"])();
        size = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$bitget$2d$executor$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["roundToContractSize"])(symbol, size);
        // Pre-flight check: if the rounded size is still below Bitget's minimum,
        // return an error instead of sending a doomed order to Bitget.
        const bgSym = symbol.replace('/', '');
        const spec = (await __turbopack_context__.A("[project]/src/lib/bitget-executor.ts [instrumentation] (ecmascript, async loader)"))._getSpec(bgSym);
        if (spec) {
            if (size < spec.minTradeNum) {
                // Try to bump up to the minimum if we have buying power
                const minNotional = spec.minTradeNum * price;
                const buyingPower = equity * leverage;
                if (minNotional <= buyingPower) {
                    size = spec.minTradeNum;
                    console.log(`[openPosition] ${symbol}: bumped size to minimum ${spec.minTradeNum}`);
                } else {
                    const msg = `Order size ${size} ${symbol.split('/')[0]} is below Bitget minimum (${spec.minTradeNum}). Need more capital or higher leverage. Equity=$${equity.toFixed(2)} lev=${leverage}x → buying power=$${buyingPower.toFixed(2)} → min order cost=$${minNotional.toFixed(2)}.`;
                    console.error('[openPosition]', msg);
                    state.lastLiveError = msg;
                    return null;
                }
            }
        } else {
            // Spec not loaded — hard floor at 1 to prevent tiny float orders
            size = Math.max(1, Math.floor(size));
            console.warn(`[openPosition] ${symbol}: no contract spec loaded, using floor=${size}`);
        }
    }
    // ---- LIVE MODE: place real orders on Bitget ----
    let liveEntryOrderId;
    let liveSlOrderId;
    let liveTpOrderId;
    if (state.mode === 'live' && isLiveConfigured()) {
        const product = state.risk.product;
        // For futures: set leverage + margin mode BEFORE placing the order.
        // Bitget requires this once per symbol; calling it repeatedly is safe.
        if (product === 'futures') {
            const lev = Math.min(state.risk.leverage, state.risk.leverageCap);
            const { setLeverage, setMarginMode } = await __turbopack_context__.A("[project]/src/lib/bitget-executor.ts [instrumentation] (ecmascript, async loader)");
            const levRes = await setLeverage(symbol, lev, state.risk.marginMode);
            if (!levRes.ok) console.warn('[live] set-leverage failed (continuing):', levRes.error);
            const mmRes = await setMarginMode(symbol, state.risk.marginMode);
            if (!mmRes.ok) console.warn('[live] set-margin-mode failed (continuing):', mmRes.error);
            console.log(`[live] futures ${symbol}: leverage=${lev}x margin=${state.risk.marginMode}`);
        }
        // 1. market entry order (with product + tradeSide + marginMode for futures)
        const entry = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$bitget$2d$executor$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["placeMarketEntry"])(symbol, side, size, {
            product,
            tradeSide: 'open',
            marginMode: state.risk.marginMode
        });
        if (!entry.ok) {
            console.error('[live] entry order failed:', entry.error);
            state.lastLiveError = entry.error || 'Bitget rejected the order';
            return null;
        }
        liveEntryOrderId = entry.orderId;
        // 2. exchange-side stop-loss (reduce-only trigger)
        const sl = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$bitget$2d$executor$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["placeStopOrder"])(symbol, side, size, stopLoss, 'sl', {
            product,
            marginMode: state.risk.marginMode
        });
        if (sl.ok) liveSlOrderId = sl.orderId;
        else console.warn('[live] SL plan order failed:', sl.error);
        // 3. exchange-side take-profit (reduce-only trigger)
        const tp = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$bitget$2d$executor$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["placeStopOrder"])(symbol, side, size, takeProfit, 'tp', {
            product,
            marginMode: state.risk.marginMode
        });
        if (tp.ok) liveTpOrderId = tp.orderId;
        else console.warn('[live] TP plan order failed:', tp.error);
        console.log(`[live] opened ${side} ${symbol} size=${size} entry=${liveEntryOrderId} sl=${liveSlOrderId} tp=${liveTpOrderId}`);
    }
    // cash is NOT debited (margin model); equity = cash + unrealized
    const pos = {
        symbol,
        side,
        size,
        entryPrice: price,
        stopLoss,
        takeProfit,
        unrealized: 0,
        openedAt: Date.now(),
        liveEntryOrderId,
        liveSlOrderId,
        liveTpOrderId
    };
    state.positions.set(symbol, pos);
    const trade = {
        id: Math.random().toString(36).slice(2, 10),
        symbol,
        side,
        size,
        entryPrice: price,
        exitPrice: null,
        status: 'OPEN',
        pnl: null,
        pnlPct: null,
        stopLoss,
        takeProfit,
        confidence,
        rationale,
        openedAt: Date.now(),
        closedAt: null
    };
    state.trades.unshift(trade);
    if (state.trades.length > 200) state.trades.pop();
    // persist
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["db"].trade.create({
        data: {
            symbol,
            side,
            size,
            entryPrice: price,
            status: 'OPEN',
            stopLoss,
            takeProfit,
            confidence,
            rationale
        }
    }).catch(()=>{});
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["db"].position.upsert({
        where: {
            symbol
        },
        create: {
            symbol,
            side,
            size,
            entryPrice: price,
            stopLoss,
            takeProfit,
            unrealized: 0
        },
        update: {
            symbol,
            side,
            size,
            entryPrice: price,
            stopLoss,
            takeProfit,
            unrealized: 0
        }
    }).catch(()=>{});
    updateUnrealized();
    return trade;
}
async function closePosition(symbol, reason) {
    const pos = state.positions.get(symbol);
    if (!pos) return null;
    const t = state.ticks.get(symbol);
    const price = pos.side === 'LONG' ? t?.bid ?? pos.entryPrice : t?.ask ?? pos.entryPrice;
    // ---- LIVE MODE: cancel exchange-side SL/TP orders, then place closing market order ----
    if (state.mode === 'live' && isLiveConfigured()) {
        const product = state.risk.product;
        // cancel the SL + TP plan orders so they don't trigger after we've closed
        if (pos.liveSlOrderId) {
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$bitget$2d$executor$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["cancelOrder"])(symbol, pos.liveSlOrderId, {
                product
            });
        }
        if (pos.liveTpOrderId) {
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$bitget$2d$executor$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["cancelOrder"])(symbol, pos.liveTpOrderId, {
                product
            });
        }
        // place a market close order — for futures, Bitget needs the CORRECT side:
        // To close a LONG: side=sell, tradeSide=close
        // To close a SHORT: side=buy, tradeSide=close
        // placeMarketEntry converts LONG→buy, SHORT→sell
        // So to close a SHORT (need buy), pass 'LONG' → buy
        // To close a LONG (need sell), pass 'SHORT' → sell
        const closeSide = pos.side === 'LONG' ? 'SHORT' : 'LONG';
        const closeResult = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$bitget$2d$executor$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["placeMarketEntry"])(symbol, closeSide, pos.size, {
            product: state.risk.product,
            tradeSide: 'close',
            marginMode: state.risk.marginMode
        });
        if (!closeResult.ok) {
            // Check if the error is "No position to close" (22002) — this means
            // the position was ALREADY closed on Bitget (e.g. SL/TP triggered).
            // In this case, delete from memory + record P/L (treat as closed).
            const errStr = JSON.stringify(closeResult).toLowerCase() + ' ' + (closeResult.error || '').toLowerCase();
            if (errStr.includes('22002') || errStr.includes('no position') || errStr.includes('no position to close')) {
                console.log(`[live] ${symbol} already closed on Bitget (22002) — syncing state`);
            // Fall through to the P/L calculation + memory cleanup below
            } else {
                // Real error — keep the position in memory so the bot can retry
                console.error(`[live] close order FAILED for ${symbol}:`, closeResult.error);
                state.lastLiveError = `Failed to close ${symbol} on Bitget: ${closeResult.error}`;
                return null;
            }
        }
        console.log(`[live] closed ${pos.side} ${symbol} reason=${reason} orderId=${closeResult.orderId}`);
    }
    const pnl = pos.side === 'LONG' ? (price - pos.entryPrice) * pos.size : (pos.entryPrice - price) * pos.size;
    // margin model: only the realized P/L settles into cash (notional was never debited)
    state.portfolio.cash += pnl;
    state.portfolio.realizedPnl += pnl;
    state.positions.delete(symbol);
    // update trade
    const trade = state.trades.find((tr)=>tr.symbol === symbol && tr.status === 'OPEN') ?? null;
    if (trade) {
        trade.status = 'CLOSED';
        trade.exitPrice = price;
        trade.pnl = pnl;
        trade.pnlPct = pos.entryPrice > 0 ? pnl / (pos.size * pos.entryPrice) : 0;
        trade.closedAt = Date.now();
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["db"].trade.updateMany({
            where: {
                id: trade.id
            },
            data: {
                status: 'CLOSED',
                exitPrice: price,
                pnl,
                pnlPct: trade.pnlPct,
                closedAt: new Date()
            }
        }).catch(()=>{});
    }
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["db"].position.deleteMany({
        where: {
            symbol
        }
    }).catch(()=>{});
    updateUnrealized();
    // win rate
    const closed = state.trades.filter((tr)=>tr.status === 'CLOSED');
    const wins = closed.filter((tr)=>(tr.pnl ?? 0) > 0).length;
    state.portfolio.winRate = closed.length ? wins / closed.length : 0;
    return trade ?? null;
}
function recordDecision(d) {
    state.decisions.unshift(d);
    if (state.decisions.length > 100) state.decisions.pop();
    state.cycle = d.cycle;
    // persist orchestrator + each agent decision
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["db"].agentDecision.create({
        data: {
            symbol: d.symbol,
            cycle: d.cycle,
            agent: 'ORCHESTRATOR',
            signal: d.signal,
            confidence: d.confidence,
            detail: JSON.stringify({
                size: d.size,
                stopLoss: d.stopLoss,
                takeProfit: d.takeProfit
            }),
            rationale: d.rationale
        }
    }).catch(()=>{});
    for (const a of d.agents){
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["db"].agentDecision.create({
            data: {
                symbol: d.symbol,
                cycle: d.cycle,
                agent: a.agent,
                signal: a.signal,
                confidence: a.confidence,
                detail: JSON.stringify(a.detail),
                rationale: a.rationale
            }
        }).catch(()=>{});
        const list = state.agentOutputs.get(d.symbol) ?? [];
        list.unshift(a);
        if (list.length > 50) list.pop();
        state.agentOutputs.set(d.symbol, list);
    }
}
function snapshotPortfolio() {
    updateUnrealized();
    const dd = state.peakEquity > 0 ? (state.peakEquity - state.portfolio.equity) / state.peakEquity : 0;
    return {
        ...state.portfolio,
        positions: Array.from(state.positions.values()),
        startedAt: state.startedAt,
        peakEquity: state.peakEquity,
        drawdown: dd,
        cycle: state.cycle,
        connected: state.connected
    };
}
function getTrades(limit = 50) {
    return state.trades.slice(0, limit);
}
function getDecisions(limit = 30) {
    return state.decisions.slice(0, limit);
}
function getAgentOutputs(symbol, limit = 20) {
    return (state.agentOutputs.get(symbol) ?? []).slice(0, limit);
}
function getCandles(symbol, limit = 200) {
    return (state.candles.get(symbol) ?? []).slice(-limit);
}
function getTicks() {
    return Array.from(state.ticks.entries()).map(([symbol, t])=>({
            symbol,
            ...t
        }));
}
function getRisk() {
    return state.risk;
}
function setRisk(r) {
    state.risk = {
        ...state.risk,
        ...r
    };
}
function getCycle() {
    return state.cycle;
}
function bumpCycle() {
    state.cycle++;
    return state.cycle;
}
async function restoreFromDb() {
    try {
        // 0. Load persisted trading symbols from DB.
        // TRADE_SYMBOLS is on globalThis (survives HMR), so we only reload
        // from DB if it's empty (first boot) — not on every HMR reload.
        if (__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$types$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["TRADE_SYMBOLS"].length > 0) {
            console.log(`[restoreFromDb] TRADE_SYMBOLS already has ${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$types$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["TRADE_SYMBOLS"].length} symbols (HMR reload — skipping DB reload)`);
        } else {
            const dbSymbols = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["db"].tradingSymbol.findMany({
                orderBy: {
                    createdAt: 'asc'
                }
            });
            if (dbSymbols.length === 0) {
                // DB is empty — seed XRP as the default ticker
                const defaultSymbol = {
                    symbol: 'XRP/USDT',
                    name: 'XRP',
                    base: 'XRP',
                    price: 0.62
                };
                await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["db"].tradingSymbol.create({
                    data: defaultSymbol
                }).catch(()=>{});
                __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$types$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["TRADE_SYMBOLS"].push({
                    ...defaultSymbol,
                    change24h: 0,
                    volume24h: 0
                });
                seedNewSymbol(defaultSymbol.symbol, defaultSymbol.price);
                console.log(`[restoreFromDb] DB empty — seeded default: XRP/USDT`);
            } else {
                for (const s of dbSymbols){
                    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$types$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["TRADE_SYMBOLS"].push({
                        symbol: s.symbol,
                        name: s.name,
                        base: s.base,
                        price: s.price,
                        change24h: 0,
                        volume24h: 0
                    });
                    seedNewSymbol(s.symbol, s.price || 1);
                }
            }
            console.log(`[restoreFromDb] loaded ${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$types$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["TRADE_SYMBOLS"].length} symbols: ${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$types$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["TRADE_SYMBOLS"].map((s)=>s.symbol).join(', ')}`);
        }
        // Bug #6: Clear BOTH positions AND trades on HMR to avoid duplicates
        state.positions.clear();
        state.trades = [];
        state.decisions = [];
        state.agentOutputs.clear();
        const dbPositions = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["db"].position.findMany();
        for (const p of dbPositions){
            // Skip positions for symbols that are no longer in the active list
            if (!__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$types$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["TRADE_SYMBOLS"].find((s)=>s.symbol === p.symbol)) {
                console.log(`[restoreFromDb] skipping ${p.symbol} position — symbol removed from active list`);
                // delete the stale position from the DB
                await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["db"].position.deleteMany({
                    where: {
                        symbol: p.symbol
                    }
                }).catch(()=>{});
                continue;
            }
            state.positions.set(p.symbol, {
                symbol: p.symbol,
                side: p.side,
                size: p.size,
                entryPrice: p.entryPrice,
                stopLoss: p.stopLoss,
                takeProfit: p.takeProfit,
                unrealized: 0,
                openedAt: p.openedAt.getTime()
            });
        }
        // 2. reload recent trades (open + closed) for the trade-history panel
        const dbTrades = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["db"].trade.findMany({
            orderBy: {
                openedAt: 'desc'
            },
            take: 200
        });
        state.trades = dbTrades.map((t)=>({
                id: t.id,
                symbol: t.symbol,
                side: t.side,
                size: t.size,
                entryPrice: t.entryPrice,
                exitPrice: t.exitPrice,
                status: t.status,
                pnl: t.pnl,
                pnlPct: t.pnlPct,
                stopLoss: t.stopLoss,
                takeProfit: t.takeProfit,
                confidence: t.confidence,
                rationale: t.rationale,
                openedAt: t.openedAt.getTime(),
                closedAt: t.closedAt ? t.closedAt.getTime() : null
            }));
        // 3. recompute realized P/L + win rate from closed trades
        const closed = state.trades.filter((t)=>t.status === 'CLOSED');
        state.portfolio.realizedPnl = closed.reduce((s, t)=>s + (t.pnl ?? 0), 0);
        const wins = closed.filter((t)=>(t.pnl ?? 0) > 0).length;
        state.portfolio.winRate = closed.length ? wins / closed.length : 0;
        // 4. cash = starting capital + realized P/L (margin model: cash only
        //    changes by realized P/L, not by opening positions)
        state.portfolio.cash = 100_000 + state.portfolio.realizedPnl;
        // 5. restore the cycle counter from the latest agent decision
        const lastDecision = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["db"].agentDecision.findFirst({
            orderBy: {
                createdAt: 'desc'
            }
        });
        if (lastDecision) state.cycle = lastDecision.cycle;
        // 6. restore risk settings
        const riskRow = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["db"].riskSettings.findUnique({
            where: {
                id: 'default'
            }
        });
        if (riskRow) {
            state.risk = {
                maxRiskPerTrade: riskRow.maxRiskPerTrade,
                maxTotalExposure: riskRow.maxTotalExposure,
                maxDrawdown: riskRow.maxDrawdown,
                leverageCap: riskRow.leverageCap,
                product: riskRow.product === 'futures' ? 'futures' : 'spot',
                marginMode: riskRow.marginMode === 'cross' ? 'cross' : 'isolated',
                leverage: riskRow.leverage ?? 3
            };
        }
        updateUnrealized();
        if (state.positions.size > 0) {
            console.log(`[trading-state] restored ${state.positions.size} open position(s) + ${state.trades.length} trade(s) from DB`);
        }
    } catch (e) {
        console.error('[trading-state] restoreFromDb failed:', e.message);
    }
}
async function manualClose(symbol) {
    return closePosition(symbol, 'manual');
}
async function closeAllPositions() {
    const errors = [];
    let closed = 0;
    const symbols = Array.from(state.positions.keys());
    for (const symbol of symbols){
        try {
            const t = await closePosition(symbol, 'close-all');
            if (t) closed++;
        } catch (e) {
            errors.push(`${symbol}: ${e?.message || 'failed'}`);
        }
    }
    return {
        ok: true,
        closed,
        errors
    };
}
async function checkExits() {
    const closed = [];
    // Bug #3: In LIVE mode, exchange-side SL/TP plan orders handle exits.
    // checkExits would double-close → 22002 errors. Skip in LIVE mode.
    if (state.mode === 'live') return closed;
    for (const pos of state.positions.values()){
        if (!__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$types$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["TRADE_SYMBOLS"].find((s)=>s.symbol === pos.symbol)) continue;
        const t = state.ticks.get(pos.symbol);
        if (!t) continue;
        const price = t.price;
        const hitSL = pos.side === 'LONG' ? price <= pos.stopLoss : price >= pos.stopLoss;
        const hitTP = pos.side === 'LONG' ? price >= pos.takeProfit : price <= pos.takeProfit;
        if (hitSL) {
            await closePosition(pos.symbol, 'stop-loss');
            closed.push(pos.symbol);
        } else if (hitTP) {
            await closePosition(pos.symbol, 'take-profit');
            closed.push(pos.symbol);
        }
    }
    return closed;
}
async function manualOpen(symbol, side, riskPct) {
    const t = state.ticks.get(symbol);
    if (!t || !t.price || t.price <= 0) {
        return {
            ok: false,
            error: `No price data for ${symbol}. ${state.mode === 'live' ? 'Live price polling may not have started yet — wait 2-3 seconds and try again.' : 'Market service may be down — wait 3s for fallback to start.'}`
        };
    }
    const price = side === 'LONG' ? t.ask : t.bid;
    if (!price || price <= 0) return {
        ok: false,
        error: 'Invalid price for ' + symbol
    };
    const leverage = state.risk.product === 'futures' ? Math.min(state.risk.leverage, state.risk.leverageCap) : 1;
    const stopDist = price * 0.015 // 1.5% stop distance (consistent with agent engine)
    ;
    // Bug #8: use state.risk.maxRiskPerTrade instead of hardcoded 0.02
    const actualRiskPct = riskPct || state.risk.maxRiskPerTrade;
    const riskAmt = state.portfolio.equity * actualRiskPct;
    let size = riskAmt / stopDist * leverage;
    // For futures: round to the symbol's contract size multiplier
    if (state.risk.product === 'futures') {
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$bitget$2d$executor$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["loadContractSpecs"])();
        size = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$bitget$2d$executor$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["roundToContractSize"])(symbol, size);
    }
    // Bug #8 fixed: riskPct now uses state.risk.maxRiskPerTrade as fallback
    const sl = side === 'LONG' ? price - stopDist : price + stopDist;
    const tp = side === 'LONG' ? price + stopDist * 2 : price - stopDist * 2;
    const trade = await openPosition(symbol, side, size, sl, tp, 1, 'Manual override by operator');
    if (!trade) {
        if (state.mode === 'live' && state.lastLiveError) {
            const err = state.lastLiveError;
            state.lastLiveError = null;
            return {
                ok: false,
                error: err
            };
        }
        return {
            ok: false,
            error: state.mode === 'live' ? 'Bitget rejected the order — check API Monitor panel for details' : 'Open position failed — check equity, exposure, or drawdown limit'
        };
    }
    return {
        ok: true,
        trade
    };
}
function resetPaperAccount() {
    state.positions.clear();
    state.trades = [];
    state.decisions = [];
    state.agentOutputs.clear();
    // Bug #15: Also clear the DB tables so stale data doesn't persist
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["db"].agentDecision.deleteMany({}).catch((e)=>console.error('[reset] agentDecision:', e?.message));
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["db"].trade.deleteMany({}).catch((e)=>console.error('[reset] trade:', e?.message));
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["db"].position.deleteMany({}).catch((e)=>console.error('[reset] position:', e?.message));
    state.portfolio = {
        cash: 100_000,
        equity: 100_000,
        exposure: 0,
        openPnl: 0,
        realizedPnl: 0,
        dayPnl: 0,
        dayPnlPct: 0,
        winRate: 0
    };
    state.peakEquity = 100_000;
    state.dayStartEquity = 100_000;
    state.cycle = 0;
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["db"].trade.deleteMany({}).catch(()=>{});
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["db"].position.deleteMany({}).catch(()=>{});
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["db"].agentDecision.deleteMany({}).catch(()=>{});
}
}),
"[project]/src/lib/agent-engine.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getEngineStatus",
    ()=>getEngineStatus,
    "getMLPrediction",
    ()=>getMLPrediction,
    "startAgentEngine",
    ()=>startAgentEngine,
    "stopAgentEngine",
    ()=>stopAgentEngine,
    "stopAllEngine",
    ()=>stopAllEngine
]);
// Multi-agent orchestration engine.
// Runs a periodic cycle across all symbols. Each cycle:
//   1. Sentiment agent  -> web-search news + LLM scores sentiment (-1..+1)
//   2. Technical agent   -> RSI/MACD/EMA/Boll/ATR/OBV -> trend signal
//   3. ML agent          -> neural net predicts next-bar direction
//   4. Risk agent        -> Kelly position sizing + exposure/drawdown gates
//   5. Orchestrator      -> LLM meta-reasoner weighs all signals -> decision
//   6. Execution         -> open / close / hold position
// All decisions are persisted to the DB and kept in-memory for the dashboard.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$z$2d$ai$2d$web$2d$dev$2d$sdk$2f$dist$2f$index$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/z-ai-web-dev-sdk/dist/index.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$indicators$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/indicators.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$nn$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/nn.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$trading$2d$state$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/trading-state.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$types$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/types.ts [instrumentation] (ecmascript)");
;
;
;
;
;
const LLM_PROVIDER = process.env.LLM_PROVIDER || 'z-ai';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';
let zaiPromise = null;
let zaiFailedAt = 0;
const ZAI_RETRY_MS = 10_000 // 10s cooldown after 429 (fast recovery)
;
async function getZAI() {
    if (zaiPromise === null && zaiFailedAt && Date.now() - zaiFailedAt < ZAI_RETRY_MS) {
        throw new Error('z-ai SDK temporarily unavailable (cooldown)');
    }
    if (zaiPromise === null) {
        zaiPromise = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$z$2d$ai$2d$web$2d$dev$2d$sdk$2f$dist$2f$index$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["default"].create().catch((e)=>{
            zaiPromise = null;
            zaiFailedAt = Date.now();
            throw e;
        });
    }
    return zaiPromise;
}
// Universal chat completion — works with z-ai, DeepSeek, or OpenAI.
// DeepSeek is OpenAI-compatible: https://api.deepseek.com/v1/chat/completions
// Models: 'deepseek-chat' (fast, cheap) or 'deepseek-reasoner' (smarter)
async function llmChat(messages) {
    if (LLM_PROVIDER === 'deepseek') {
        if (!DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY not set in .env');
        const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: messages.map((m)=>({
                        role: m.role === 'assistant' ? 'system' : m.role,
                        content: m.content
                    })),
                temperature: 0.3,
                max_tokens: 500
            })
        });
        if (!res.ok) {
            const errBody = await res.text();
            throw new Error(`DeepSeek API ${res.status}: ${errBody.slice(0, 200)}`);
        }
        const json = await res.json();
        const content = json?.choices?.[0]?.message?.content || '';
        return {
            content
        };
    }
    if (LLM_PROVIDER === 'openai') {
        if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set in .env');
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: messages.map((m)=>({
                        role: m.role === 'assistant' ? 'system' : m.role,
                        content: m.content
                    })),
                temperature: 0.3,
                max_tokens: 500
            })
        });
        if (!res.ok) throw new Error(`OpenAI API ${res.status}`);
        const json = await res.json();
        return {
            content: json?.choices?.[0]?.message?.content || ''
        };
    }
    if (LLM_PROVIDER === 'ollama') {
        // Ollama runs Llama 3 locally on your machine — no API key, no rate limits
        const res = await fetch(`${OLLAMA_URL}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                messages: messages.map((m)=>({
                        role: m.role,
                        content: m.content
                    })),
                stream: false,
                options: {
                    temperature: 0.3
                }
            })
        });
        if (!res.ok) {
            const errBody = await res.text();
            throw new Error(`Ollama API ${res.status}: ${errBody.slice(0, 200)} — Is 'ollama serve' running?`);
        }
        const json = await res.json();
        return {
            content: json?.message?.content || ''
        };
    }
    // default: z-ai
    const zai = await getZAI();
    const completion = await zai.chat.completions.create({
        messages: messages.map((m)=>({
                role: m.role,
                content: m.content
            })),
        thinking: {
            type: 'disabled'
        }
    });
    return {
        content: completion.choices[0]?.message?.content || ''
    };
}
// Universal web search — z-ai has built-in; for DeepSeek/OpenAI we use a free
// news API (CryptoCompare) + pass the headlines to the LLM for scoring.
async function llmSearchNews(query, num = 6) {
    if (LLM_PROVIDER === 'z-ai') {
        const zai = await getZAI();
        const results = await zai.functions.invoke('web_search', {
            query,
            num
        });
        return (results || []).slice(0, num).map((r)=>r.name || r.snippet || '').filter(Boolean);
    }
    // DeepSeek / OpenAI — use CryptoCompare's free news API (no key needed)
    try {
        const base = query.split(' ')[0];
        const res = await fetch(`https://min-api.cryptocompare.com/data/v2/news/?categories=${base}&lang=EN`, {
            cache: 'no-store'
        });
        const json = await res.json();
        return (json?.Data || []).slice(0, num).map((a)=>a.title || '').filter(Boolean);
    } catch  {
        return [];
    }
}
// Check if an error indicates rate-limiting (429) or session expiry.
function isRateLimited(e) {
    const s = (e?.message ?? '') + ' ' + JSON.stringify(e ?? '');
    return /429|too many requests|rate.?limit/i.test(s);
}
// Reset the SDK so the next getZAI() recreates a fresh session.
function resetZAI() {
    zaiPromise = null;
    zaiFailedAt = Date.now();
}
// Safe wrapper: run a z-ai call, catch sandbox-inactive errors, reset the SDK,
// and throw so the caller's fallback logic takes over.
async function withZAI(fn) {
    const zai = await getZAI();
    try {
        const result = await fn(zai);
        // Check if the result itself is an error object (SDK returns errors as data)
        if (result && typeof result === 'object' && !Array.isArray(result)) {
            const errStr = JSON.stringify(result);
            if (/inactive|sandbox|429|too many requests/i.test(errStr)) {
                resetZAI();
                throw new Error('z-ai error returned as response: ' + errStr.slice(0, 100));
            }
        }
        return result;
    } catch (e) {
        if (isRateLimited(e)) {
            resetZAI(); // rate-limited — cool down 60s
        }
        throw e;
    }
}
// All engine state is hoisted onto globalThis so that HMR in dev mode does
// not split the instance between instrumentation (starter) and API routes
// (reader). Without this, /api/status would report engine.running=false even
// while the engine is actively running in another module instance.
const ge = globalThis;
// one persistent neural net per symbol (it learns over time)
const predictors = ge.__ND_PREDICTORS__ ??= new Map();
function getPredictor(symbol) {
    let p = predictors.get(symbol);
    if (!p) {
        p = new __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$nn$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["PricePredictor"]();
        predictors.set(symbol, p);
    }
    return p;
}
// sentiment cache (symbol -> { score, ts, headlines })
const sentimentCache = ge.__ND_SENTIMENT__ ??= new Map();
const SENTIMENT_TTL = 5 * 60 * 1000 // 5 min
;
const engine = ge.__ND_ENGINE__ ??= {
    started: false,
    cycleTimer: null,
    exitTimer: null
};
function startAgentEngine(intervalMs = 60_000) {
    if (engine.started) return;
    engine.started = true;
    // exit checks every 2s
    if (!engine.exitTimer) {
        engine.exitTimer = setInterval(()=>{
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$trading$2d$state$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["checkExits"])().catch((e)=>console.error('[checkExits]', e));
        }, 2000);
    }
    // run a cycle immediately, then on interval — LOG errors instead of swallowing
    runCycle().catch((e)=>console.error('[runCycle] FATAL:', e?.message || e));
    engine.cycleTimer = setInterval(()=>{
        runCycle().catch((e)=>console.error('[runCycle] FATAL:', e?.message || e));
    }, intervalMs);
    console.log(`[agent-engine] started — cycle every ${intervalMs / 1000}s, ${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$types$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["TRADE_SYMBOLS"].length} symbols: ${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$types$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["TRADE_SYMBOLS"].map((s)=>s.symbol).join(', ') || '(none)'}`);
}
function stopAgentEngine() {
    // Halts NEW decisions but KEEPS the exit-checker running so open positions
    // are still protected by their SL/TP. To fully stop everything, call
    // stopAllEngine() instead.
    if (engine.cycleTimer) {
        clearInterval(engine.cycleTimer);
        engine.cycleTimer = null;
    }
    engine.started = false;
}
function stopAllEngine() {
    // Full kill — stops decisions AND SL/TP monitoring. Use only if you intend
    // to manually manage or close all positions yourself.
    if (engine.cycleTimer) {
        clearInterval(engine.cycleTimer);
        engine.cycleTimer = null;
    }
    if (engine.exitTimer) {
        clearInterval(engine.exitTimer);
        engine.exitTimer = null;
    }
    engine.started = false;
}
// ---------------- SENTIMENT AGENT ----------------
// ALWAYS runs — news sentiment is a crucial fundamental indicator.
// Uses the universal llmSearchNews + llmChat so it works with z-ai, DeepSeek, or OpenAI.
async function runSentimentAgent(symbol) {
    const base = symbol.split('/')[0];
    const cached = sentimentCache.get(symbol);
    const useCache = cached && Date.now() - cached.ts < SENTIMENT_TTL;
    let score = 0;
    let headlines = [];
    try {
        if (useCache) {
            score = cached.score;
            headlines = cached.headlines;
            return {
                agent: 'SENTIMENT',
                signal: score > 0.25 ? 'LONG' : score < -0.25 ? 'SHORT' : 'FLAT',
                confidence: 0.7,
                detail: {
                    score,
                    headlines: headlines.slice(0, 3).join(' | '),
                    source: 'cached'
                },
                rationale: `Sentiment score ${score.toFixed(2)} (cached) — ${headlines.slice(0, 2).join(' | ')}`,
                ts: Date.now()
            };
        } else {
            // 1. Fetch news headlines (z-ai web_search OR CryptoCompare for DeepSeek/OpenAI)
            headlines = await llmSearchNews(`${base} crypto news today price`, 6);
            if (headlines.length === 0) headlines = [
                'No recent headlines found'
            ];
            const context = headlines.map((h, i)=>`${i + 1}. ${h}`).join('\n');
            // 2. LLM scores the sentiment from the headlines
            const result = await llmChat([
                {
                    role: 'assistant',
                    content: 'You are a crypto market sentiment analyst. Given recent news headlines about a coin, output a sentiment score from -1 (very bearish) to +1 (very bullish). Respond with ONLY a JSON object: {"score": <number>, "confidence": <0..1>, "reason": "<short>"}'
                },
                {
                    role: 'user',
                    content: `Coin: ${base}\nHeadlines:\n${context}\n\nOutput JSON only.`
                }
            ]);
            const text = result.content || '';
            const match = text.match(/\{[\s\S]*\}/);
            if (match) {
                const obj = JSON.parse(match[0]);
                score = Math.max(-1, Math.min(1, Number(obj.score) || 0));
                const conf = Math.max(0, Math.min(1, Number(obj.confidence) || 0.5));
                sentimentCache.set(symbol, {
                    score,
                    headlines,
                    ts: Date.now()
                });
                return {
                    agent: 'SENTIMENT',
                    signal: score > 0.25 ? 'LONG' : score < -0.25 ? 'SHORT' : 'FLAT',
                    confidence: conf,
                    detail: {
                        score,
                        headlines: headlines.slice(0, 3).join(' | '),
                        provider: LLM_PROVIDER
                    },
                    rationale: obj.reason || `Sentiment score ${score.toFixed(2)} from ${headlines.length} headlines (${LLM_PROVIDER})`,
                    ts: Date.now()
                };
            }
        }
    } catch (e) {
        console.error(`[sentiment] LLM failed for ${symbol} (${LLM_PROVIDER}):`, e?.message?.slice(0, 150) || String(e).slice(0, 150));
    }
    // deterministic fallback: derive a mild sentiment from recent price momentum
    const candles = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$trading$2d$state$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["getCandles"])(symbol, 30);
    const ret = candles.length >= 2 ? (candles[candles.length - 1].close - candles[candles.length - 6].close) / candles[candles.length - 6].close : 0;
    score = Math.max(-1, Math.min(1, ret * 8));
    sentimentCache.set(symbol, {
        score,
        headlines: headlines.length ? headlines : [
            'fallback: momentum-derived'
        ],
        ts: Date.now()
    });
    return {
        agent: 'SENTIMENT',
        signal: score > 0.2 ? 'LONG' : score < -0.2 ? 'SHORT' : 'FLAT',
        confidence: 0.45,
        detail: {
            score,
            source: 'momentum-fallback'
        },
        rationale: `Fallback sentiment ${score.toFixed(2)} (derived from 6-bar momentum; web search unavailable)`,
        ts: Date.now()
    };
}
// ---------------- TECHNICAL AGENT ----------------
function runTechnicalAgent(symbol) {
    const candles = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$trading$2d$state$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["getCandles"])(symbol, 100);
    const snap = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$indicators$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["computeSnapshot"])(candles);
    const score = snap.trendScore;
    let signal = 'FLAT';
    if (score > 0.25) signal = 'LONG';
    else if (score < -0.25) signal = 'SHORT';
    const confidence = Math.min(1, Math.abs(score) * 1.4);
    return {
        agent: 'TECHNICAL',
        signal,
        confidence,
        detail: {
            rsi: snap.rsi,
            macdHist: snap.macdHist,
            emaCross: snap.emaCross,
            bollPercentB: snap.bollPercentB,
            atr: snap.atr,
            trendScore: score
        },
        rationale: `RSI ${snap.rsi.toFixed(1)} | MACD hist ${snap.macdHist.toFixed(2)} | EMA cross ${snap.emaCross.toFixed(2)} | %B ${snap.bollPercentB.toFixed(2)} | trend ${score.toFixed(2)}`,
        ts: Date.now()
    };
}
// ---------------- ML AGENT ----------------
function runMLAgent(symbol) {
    const candles = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$trading$2d$state$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["getCandles"])(symbol, 100);
    const snap = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$indicators$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["computeSnapshot"])(candles);
    const features = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$nn$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["buildFeatures"])(candles, snap);
    const predictor = getPredictor(symbol);
    // online training: use the last *completed* candle's forward return as label
    if (candles.length >= 3) {
        const prev = candles[candles.length - 2];
        const prevPrev = candles[candles.length - 3];
        const nextReturn = (prev.close - prevPrev.close) / prevPrev.close;
        // build features as-of prevPrev close (approx) — for a live demo this is fine
        predictor.train(features, nextReturn);
    }
    const { probUp, expectedReturn, confidence } = predictor.predict(features);
    const signal = probUp > 0.58 ? 'LONG' : probUp < 0.42 ? 'SHORT' : 'FLAT';
    return {
        agent: 'ML',
        signal,
        confidence: Math.max(0.3, confidence),
        detail: {
            probUp,
            expectedReturn,
            trainedSteps: predictor.trainedSteps
        },
        rationale: `Neural net P(up)=${(probUp * 100).toFixed(1)}% | E[ret]=${(expectedReturn * 100).toFixed(3)}% | trained on ${predictor.trainedSteps} bars`,
        ts: Date.now()
    };
}
// ---------------- RISK AGENT ----------------
function runRiskAgent(symbol, direction) {
    const port = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$trading$2d$state$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["snapshotPortfolio"])();
    const risk = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$trading$2d$state$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["getRisk"])();
    const candles = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$trading$2d$state$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["getCandles"])(symbol, 50);
    const snap = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$indicators$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["computeSnapshot"])(candles);
    const price = candles[candles.length - 1]?.close ?? 0;
    const atrPct = price > 0 ? snap.atr / price : 0.01;
    // exposure gate
    const exposureOk = port.exposure < risk.maxTotalExposure;
    // drawdown gate
    const ddOk = port.drawdown < risk.maxDrawdown;
    // Kelly fraction (simplified): f = edge / odds
    const kelly = Math.max(0, Math.min(risk.maxRiskPerTrade * 2, atrPct > 0 ? risk.maxRiskPerTrade / atrPct * 0.5 : 0));
    const allowed = exposureOk && ddOk;
    let signal = 'FLAT';
    if (!allowed) signal = 'FLAT';
    else if (direction === 'LONG') signal = 'LONG';
    else if (direction === 'SHORT') signal = 'SHORT';
    return {
        agent: 'RISK',
        signal,
        confidence: allowed ? Math.min(1, kelly / risk.maxRiskPerTrade) : 0,
        detail: {
            exposure: port.exposure,
            maxExposure: risk.maxTotalExposure,
            drawdown: port.drawdown,
            maxDrawdown: risk.maxDrawdown,
            atrPct,
            kellyFraction: kelly,
            allowed: allowed ? 1 : 0
        },
        rationale: allowed ? `Exposure ${(port.exposure * 100).toFixed(1)}%/${(risk.maxTotalExposure * 100).toFixed(0)}% | DD ${(port.drawdown * 100).toFixed(1)}%/${(risk.maxDrawdown * 100).toFixed(0)}% | ATR ${atrPct.toFixed(3)} | Kelly f=${kelly.toFixed(3)}` : `Risk gate closed: exposure ${(port.exposure * 100).toFixed(1)}% or DD ${(port.drawdown * 100).toFixed(1)}% at limit`,
        ts: Date.now()
    };
}
// Bug #13: Extract agent weights to a single constant (was duplicated in 2 places)
const AGENT_WEIGHTS = {
    SENTIMENT: 0.2,
    TECHNICAL: 0.3,
    ML: 0.35,
    RISK: 0.15
};
// ---------------- ORCHESTRATOR ----------------
async function runOrchestrator(symbol, agents) {
    // weighted deterministic vote (fallback / baseline)
    const weights = AGENT_WEIGHTS;
    let vote = 0;
    let wsum = 0;
    for (const a of agents){
        const dir = a.signal === 'LONG' ? 1 : a.signal === 'SHORT' ? -1 : 0;
        vote += dir * a.confidence * (weights[a.agent] ?? 0.2);
        wsum += a.confidence * (weights[a.agent] ?? 0.2);
    }
    const detScore = wsum > 0 ? vote / wsum : 0;
    const detSignal = detScore > 0.2 ? 'LONG' : detScore < -0.2 ? 'SHORT' : 'FLAT';
    // LLM meta-reasoner — give it the agent outputs and ask for a final call
    try {
        const port = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$trading$2d$state$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["snapshotPortfolio"])();
        const pos = port.positions.find((p)=>p.symbol === symbol);
        const candles = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$trading$2d$state$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["getCandles"])(symbol, 10);
        const recent = candles.map((c)=>c.close.toFixed(2)).join(', ');
        const agentSummary = agents.map((a)=>`${a.agent}: signal=${a.signal} conf=${(a.confidence * 100).toFixed(0)}% | ${a.rationale}`).join('\n');
        const result = await llmChat([
            {
                role: 'assistant',
                content: 'You are the orchestrator of a multi-agent crypto trading system. Given the outputs of specialist agents plus current market state, make the final trading decision. Be decisive but respect risk. Respond with ONLY JSON: {"signal":"LONG|SHORT|FLAT","confidence":0..1,"rationale":"<one sentence, mention which agents you weighted and why>"}'
            },
            {
                role: 'user',
                content: `Symbol: ${symbol}\nCurrent position: ${pos ? pos.side + ' size=' + pos.size.toFixed(4) + ' entry=' + pos.entryPrice.toFixed(2) + ' unrealized=' + pos.unrealized.toFixed(2) : 'none'}\nEquity: $${port.equity.toFixed(2)} | Exposure: ${(port.exposure * 100).toFixed(1)}% | Drawdown: ${(port.drawdown * 100).toFixed(1)}%\nRecent closes: ${recent}\n\nAgent outputs:\n${agentSummary}\n\nDeterministic vote score: ${detScore.toFixed(2)} (${detSignal}). Output JSON only.`
            }
        ]);
        const text = result.content || '';
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
            const obj = JSON.parse(match[0]);
            const sig = (obj.signal || '').toUpperCase();
            if ([
                'LONG',
                'SHORT',
                'FLAT'
            ].includes(sig)) {
                return {
                    signal: sig,
                    confidence: Math.max(0, Math.min(1, Number(obj.confidence) || 0.5)),
                    rationale: obj.rationale || `LLM orchestrator decision (${LLM_PROVIDER})`
                };
            }
        }
    } catch (e) {
        console.error(`[orchestrator] LLM failed for ${symbol} (${LLM_PROVIDER}):`, e?.message?.slice(0, 150) || String(e).slice(0, 150));
    }
    return {
        signal: detSignal,
        confidence: Math.min(1, Math.abs(detScore) * 2),
        rationale: `Deterministic weighted vote score ${detScore.toFixed(2)} (LLM unavailable, ${LLM_PROVIDER}). Weights: ML 35%, Tech 30%, Sentiment 20%, Risk 15%.`
    };
}
// ---------------- EXECUTION ----------------
async function executeDecision(symbol, decision, atr) {
    // SAFETY: verify the symbol is still in the active trading list before
    // placing any order. This prevents trades on removed tickers even if the
    // cycle's snapshot still includes them.
    if (!__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$types$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["TRADE_SYMBOLS"].find((s)=>s.symbol === symbol)) {
        console.log(`[execute] skipping ${symbol} — not in active symbol list`);
        return;
    }
    const port = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$trading$2d$state$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["snapshotPortfolio"])();
    const pos = port.positions.find((p)=>p.symbol === symbol);
    const price = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$trading$2d$state$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["getCandles"])(symbol, 2)[(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$trading$2d$state$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["getCandles"])(symbol, 2).length - 1]?.close ?? 0;
    if (price <= 0) return;
    if (decision.signal === 'FLAT') {
        if (pos) await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$trading$2d$state$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["closePosition"])(symbol, `orchestrator flatten: ${decision.rationale}`);
        return;
    }
    // if there's an open position in the opposite direction, flip
    if (pos && pos.side !== decision.signal) {
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$trading$2d$state$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["closePosition"])(symbol, `flip to ${decision.signal}: ${decision.rationale}`);
    }
    // skip if already in same direction
    if (pos && pos.side === decision.signal) return;
    const risk = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$trading$2d$state$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["getRisk"])();
    const leverage = risk.product === 'futures' ? Math.min(risk.leverage, risk.leverageCap) : 1;
    const riskAmt = port.equity * risk.maxRiskPerTrade * decision.confidence;
    // Stop distance: use ATR but cap it to a reasonable percentage of price
    // (ATR can be wildly wrong on simulated data, producing SL values like -9000)
    const atrStopDist = atr * 1.5;
    const pctStopDist = price * 0.015 // 1.5% of price (minimum)
    ;
    const maxStopDist = price * 0.05 // 5% of price (maximum)
    ;
    const stopDist = Math.min(Math.max(atrStopDist, pctStopDist), maxStopDist);
    // Size = risk amount / stop distance, THEN multiply by leverage for futures.
    // This gives leveraged buying power: $2 equity × 20x = $40 notional.
    let size = riskAmt / stopDist * leverage;
    if (size <= 0) return;
    // EXPOSURE CAP: cap each position at (equity × maxTotalExposure × leverage / numSymbols)
    // so one position doesn't consume the entire exposure budget.
    const numSymbols = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$types$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["TRADE_SYMBOLS"].length;
    const perSymbolBudget = port.equity * risk.maxTotalExposure * leverage / numSymbols;
    const existingNotional = port.positions.reduce((s, p)=>{
        const px = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$trading$2d$state$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["getCandles"])(p.symbol, 2)[(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$trading$2d$state$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["getCandles"])(p.symbol, 2).length - 1]?.close ?? p.entryPrice;
        return s + p.size * px;
    }, 0);
    const totalBudget = port.equity * risk.maxTotalExposure * leverage;
    const availableTotal = totalBudget - existingNotional;
    if (availableTotal <= 0) {
        console.log(`[execute] ${symbol}: exposure cap reached (${(port.exposure * 100).toFixed(1)}%/${(risk.maxTotalExposure * 100).toFixed(0)}%) — skipping`);
        return;
    }
    // cap notional at min(perSymbolBudget, availableTotal) so we leave room for others
    const maxNotional = Math.min(perSymbolBudget, availableTotal);
    const newNotional = size * price;
    if (newNotional > maxNotional) {
        size = maxNotional / price;
    }
    if (size <= 0) return;
    // For futures: round to the symbol's contract size multiplier (e.g. SOL=0.1, BTC=0.0001)
    if (risk.product === 'futures') {
        const { roundToContractSize, loadContractSpecs } = await __turbopack_context__.A("[project]/src/lib/bitget-executor.ts [instrumentation] (ecmascript, async loader)");
        await loadContractSpecs();
        size = roundToContractSize(symbol, size);
    }
    const side = decision.signal === 'LONG' ? 'LONG' : 'SHORT';
    const sl = side === 'LONG' ? price - stopDist : price + stopDist;
    const tp = side === 'LONG' ? price + stopDist * 2.2 : price - stopDist * 2.2;
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$trading$2d$state$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["openPosition"])(symbol, side, size, sl, tp, decision.confidence, decision.rationale);
}
// ---------------- CYCLE ----------------
async function runCycle() {
    // Snapshot the symbol list at the START of the cycle. If a symbol is
    // removed via Manage Tickers mid-cycle, the current cycle finishes with
    // the snapshot (safe), and the next cycle uses the updated list.
    const cycleSymbols = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$types$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["TRADE_SYMBOLS"].map((s)=>s.symbol);
    for(let i = 0; i < cycleSymbols.length; i++){
        const symbol = cycleSymbols[i];
        // Skip if the symbol was removed DURING this cycle
        if (!__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$types$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["TRADE_SYMBOLS"].find((s)=>s.symbol === symbol)) {
            console.log(`[cycle] skipping ${symbol} — removed during this cycle`);
            continue;
        }
        try {
            const candles = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$trading$2d$state$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["getCandles"])(symbol, 100);
            if (candles.length < 10) continue;
            const snap = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$indicators$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["computeSnapshot"])(candles);
            // Early risk check: if drawdown is already at the limit, skip ALL LLM
            // calls (sentiment + orchestrator) since we can't trade anyway. This
            // prevents wasting z-ai API quota on no-op cycles.
            const port = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$trading$2d$state$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["snapshotPortfolio"])();
            const riskGloballyBlocked = port.drawdown >= (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$trading$2d$state$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["getRisk"])().maxDrawdown;
            let sentiment;
            if (riskGloballyBlocked) {
                // skip sentiment LLM — use cached or momentum fallback
                const cached = sentimentCache.get(symbol);
                if (cached && Date.now() - cached.ts < SENTIMENT_TTL) {
                    sentiment = {
                        agent: 'SENTIMENT',
                        signal: cached.score > 0.25 ? 'LONG' : cached.score < -0.25 ? 'SHORT' : 'FLAT',
                        confidence: 0.5,
                        detail: {
                            score: cached.score,
                            source: 'cached'
                        },
                        rationale: `Sentiment ${cached.score.toFixed(2)} (cached — risk gate closed)`,
                        ts: Date.now()
                    };
                } else {
                    // quick momentum fallback, no API call
                    const ret = candles.length >= 6 ? (candles[candles.length - 1].close - candles[candles.length - 6].close) / candles[candles.length - 6].close : 0;
                    const score = Math.max(-1, Math.min(1, ret * 8));
                    sentiment = {
                        agent: 'SENTIMENT',
                        signal: score > 0.2 ? 'LONG' : score < -0.2 ? 'SHORT' : 'FLAT',
                        confidence: 0.3,
                        detail: {
                            score,
                            source: 'momentum-fallback'
                        },
                        rationale: `Sentiment ${score.toFixed(2)} (momentum fallback — risk gate closed, LLM skipped)`,
                        ts: Date.now()
                    };
                }
            } else {
                // Sentiment ALWAYS runs — news is a crucial fundamental indicator.
                // The 5-min cache prevents redundant API calls within the same cycle.
                sentiment = await runSentimentAgent(symbol);
            }
            const technical = runTechnicalAgent(symbol);
            const ml = runMLAgent(symbol);
            // tentative direction from the first three
            const tentative = (()=>{
                const dirs = [
                    sentiment,
                    technical,
                    ml
                ].map((a)=>a.signal === 'LONG' ? 1 : a.signal === 'SHORT' ? -1 : 0);
                const avg = dirs.reduce((a, b)=>a + b, 0) / dirs.length;
                return avg > 0.1 ? 'LONG' : avg < -0.1 ? 'SHORT' : 'FLAT';
            })();
            const risk = runRiskAgent(symbol, tentative);
            // OPTIMIZATION: skip the orchestrator LLM call when the risk gate is
            // ACTUALLY closed (drawdown/exposure at limit) OR all specialist agents
            // agree on FLAT. This cuts API calls + avoids rate-limit errors.
            // NOTE: risk.confidence === 0 alone is NOT a reliable "blocked" signal —
            // it can be 0 when the Kelly fraction is tiny even if the gate is open.
            // We check the actual gate conditions from the risk agent's detail.
            const allFlat = sentiment.signal === 'FLAT' && technical.signal === 'FLAT' && ml.signal === 'FLAT';
            const riskActuallyBlocked = risk.detail?.allowed === 0;
            const tentativeIsFlat = tentative === 'FLAT';
            let orchestrator;
            if (riskActuallyBlocked || allFlat && tentativeIsFlat) {
                // use deterministic vote directly — no LLM call needed
                const weights = AGENT_WEIGHTS;
                let vote = 0, wsum = 0;
                for (const a of [
                    sentiment,
                    technical,
                    ml,
                    risk
                ]){
                    const dir = a.signal === 'LONG' ? 1 : a.signal === 'SHORT' ? -1 : 0;
                    vote += dir * a.confidence * (weights[a.agent] ?? 0.2);
                    wsum += a.confidence * (weights[a.agent] ?? 0.2);
                }
                const score = wsum > 0 ? vote / wsum : 0;
                const sig = score > 0.2 ? 'LONG' : score < -0.2 ? 'SHORT' : 'FLAT';
                const dd = Number(risk.detail?.drawdown ?? 0);
                const maxDd = Number(risk.detail?.maxDrawdown ?? 0);
                const exp = Number(risk.detail?.exposure ?? 0);
                const maxExp = Number(risk.detail?.maxExposure ?? 0);
                orchestrator = {
                    signal: sig,
                    confidence: Math.min(1, Math.abs(score) * 2),
                    rationale: riskActuallyBlocked ? `Risk gate closed — DD ${(dd * 100).toFixed(1)}%/${(maxDd * 100).toFixed(0)}% or exposure ${(exp * 100).toFixed(1)}%/${(maxExp * 100).toFixed(0)}%. (deterministic vote: ${score.toFixed(2)})` : `All specialists FLAT — no trade. (deterministic vote: ${score.toFixed(2)})`
                };
            } else {
                orchestrator = await runOrchestrator(symbol, [
                    sentiment,
                    technical,
                    ml,
                    risk
                ]);
            }
            const cycle = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$trading$2d$state$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["bumpCycle"])();
            const decision = {
                cycle,
                symbol,
                signal: orchestrator.signal,
                confidence: orchestrator.confidence,
                size: 0,
                stopLoss: 0,
                takeProfit: 0,
                rationale: orchestrator.rationale,
                agents: [
                    sentiment,
                    technical,
                    ml,
                    risk
                ],
                ts: Date.now()
            };
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$trading$2d$state$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["recordDecision"])(decision);
            await executeDecision(symbol, orchestrator, snap.atr);
        } catch (e) {
            // keep the engine alive even if one symbol fails
            console.error(`[agent-engine] cycle failed for ${symbol}:`, e.message);
        }
        // stagger symbols by 1s to avoid bursting the z-ai API (prevents 429s)
        if (i < cycleSymbols.length - 1) await new Promise((r)=>setTimeout(r, 1000));
    }
}
function getEngineStatus() {
    return {
        running: engine.started,
        predictors: predictors.size,
        sentimentCache: sentimentCache.size
    };
}
function getMLPrediction(symbol) {
    const candles = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$trading$2d$state$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["getCandles"])(symbol, 100);
    if (candles.length < 10) return {
        probUp: 0.5,
        expectedReturn: 0,
        confidence: 0,
        trainedSteps: 0,
        features: null
    };
    const snap = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$indicators$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["computeSnapshot"])(candles);
    const features = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$nn$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["buildFeatures"])(candles, snap);
    const predictor = getPredictor(symbol);
    const { probUp, expectedReturn, confidence } = predictor.predict(features);
    return {
        probUp,
        expectedReturn,
        confidence,
        trainedSteps: predictor.trainedSteps,
        features
    };
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__9a84133c._.js.map