module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[project]/src/lib/db.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
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
"[project]/src/lib/types.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
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
"[project]/src/lib/bitget-executor.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
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
"[project]/src/lib/trading-state.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
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
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$types$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/types.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$bitget$2d$executor$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/bitget-executor.ts [app-route] (ecmascript)");
;
;
;
const MAX_CANDLES = 300;
const MARKET_URL = 'http://localhost:3003' // internal — only used server-side
;
function seedPrices() {
    const m = new Map();
    for (const s of __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$types$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["TRADE_SYMBOLS"]){
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
    for (const s of __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$types$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["TRADE_SYMBOLS"]){
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
        for (const s of __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$types$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["TRADE_SYMBOLS"]){
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
    const symbols = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$types$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["TRADE_SYMBOLS"].map((s)=>s.symbol);
    const product = state.risk.product;
    const gotSymbols = new Set();
    // In futures mode: fetch FUTURES prices first (this is what the bot trades on)
    if (product === 'futures') {
        const futTicks = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$bitget$2d$executor$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["fetchLiveTickers"])(symbols, 'futures');
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
        const spotTicks = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$bitget$2d$executor$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["fetchLiveTickers"])(missing, 'spot');
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
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$bitget$2d$executor$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["loadContractSpecs"])();
    }
    // bootstrap candle history from Bitget once
    if (!state.liveTickerLoaded) {
        state.liveTickerLoaded = true;
        for (const s of __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$types$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["TRADE_SYMBOLS"]){
            const klines = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$bitget$2d$executor$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["fetchLiveKlines"])(s.symbol, 200, product);
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
                    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].trade.updateMany({
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
                __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].position.deleteMany({
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
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$bitget$2d$executor$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["loadContractSpecs"])();
        size = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$bitget$2d$executor$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["roundToContractSize"])(symbol, size);
        // Pre-flight check: if the rounded size is still below Bitget's minimum,
        // return an error instead of sending a doomed order to Bitget.
        const bgSym = symbol.replace('/', '');
        const spec = (await __turbopack_context__.A("[project]/src/lib/bitget-executor.ts [app-route] (ecmascript, async loader)"))._getSpec(bgSym);
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
            const { setLeverage, setMarginMode } = await __turbopack_context__.A("[project]/src/lib/bitget-executor.ts [app-route] (ecmascript, async loader)");
            const levRes = await setLeverage(symbol, lev, state.risk.marginMode);
            if (!levRes.ok) console.warn('[live] set-leverage failed (continuing):', levRes.error);
            const mmRes = await setMarginMode(symbol, state.risk.marginMode);
            if (!mmRes.ok) console.warn('[live] set-margin-mode failed (continuing):', mmRes.error);
            console.log(`[live] futures ${symbol}: leverage=${lev}x margin=${state.risk.marginMode}`);
        }
        // 1. market entry order (with product + tradeSide + marginMode for futures)
        const entry = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$bitget$2d$executor$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["placeMarketEntry"])(symbol, side, size, {
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
        const sl = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$bitget$2d$executor$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["placeStopOrder"])(symbol, side, size, stopLoss, 'sl', {
            product,
            marginMode: state.risk.marginMode
        });
        if (sl.ok) liveSlOrderId = sl.orderId;
        else console.warn('[live] SL plan order failed:', sl.error);
        // 3. exchange-side take-profit (reduce-only trigger)
        const tp = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$bitget$2d$executor$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["placeStopOrder"])(symbol, side, size, takeProfit, 'tp', {
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
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].trade.create({
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
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].position.upsert({
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
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$bitget$2d$executor$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["cancelOrder"])(symbol, pos.liveSlOrderId, {
                product
            });
        }
        if (pos.liveTpOrderId) {
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$bitget$2d$executor$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["cancelOrder"])(symbol, pos.liveTpOrderId, {
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
        const closeResult = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$bitget$2d$executor$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["placeMarketEntry"])(symbol, closeSide, pos.size, {
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
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].trade.updateMany({
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
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].position.deleteMany({
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
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].agentDecision.create({
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
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].agentDecision.create({
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
        if (__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$types$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["TRADE_SYMBOLS"].length > 0) {
            console.log(`[restoreFromDb] TRADE_SYMBOLS already has ${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$types$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["TRADE_SYMBOLS"].length} symbols (HMR reload — skipping DB reload)`);
        } else {
            const dbSymbols = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].tradingSymbol.findMany({
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
                await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].tradingSymbol.create({
                    data: defaultSymbol
                }).catch(()=>{});
                __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$types$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["TRADE_SYMBOLS"].push({
                    ...defaultSymbol,
                    change24h: 0,
                    volume24h: 0
                });
                seedNewSymbol(defaultSymbol.symbol, defaultSymbol.price);
                console.log(`[restoreFromDb] DB empty — seeded default: XRP/USDT`);
            } else {
                for (const s of dbSymbols){
                    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$types$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["TRADE_SYMBOLS"].push({
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
            console.log(`[restoreFromDb] loaded ${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$types$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["TRADE_SYMBOLS"].length} symbols: ${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$types$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["TRADE_SYMBOLS"].map((s)=>s.symbol).join(', ')}`);
        }
        // Bug #6: Clear BOTH positions AND trades on HMR to avoid duplicates
        state.positions.clear();
        state.trades = [];
        state.decisions = [];
        state.agentOutputs.clear();
        const dbPositions = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].position.findMany();
        for (const p of dbPositions){
            // Skip positions for symbols that are no longer in the active list
            if (!__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$types$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["TRADE_SYMBOLS"].find((s)=>s.symbol === p.symbol)) {
                console.log(`[restoreFromDb] skipping ${p.symbol} position — symbol removed from active list`);
                // delete the stale position from the DB
                await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].position.deleteMany({
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
        const dbTrades = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].trade.findMany({
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
        const lastDecision = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].agentDecision.findFirst({
            orderBy: {
                createdAt: 'desc'
            }
        });
        if (lastDecision) state.cycle = lastDecision.cycle;
        // 6. restore risk settings
        const riskRow = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].riskSettings.findUnique({
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
        if (!__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$types$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["TRADE_SYMBOLS"].find((s)=>s.symbol === pos.symbol)) continue;
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
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$bitget$2d$executor$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["loadContractSpecs"])();
        size = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$bitget$2d$executor$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["roundToContractSize"])(symbol, size);
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
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].agentDecision.deleteMany({}).catch((e)=>console.error('[reset] agentDecision:', e?.message));
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].trade.deleteMany({}).catch((e)=>console.error('[reset] trade:', e?.message));
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].position.deleteMany({}).catch((e)=>console.error('[reset] position:', e?.message));
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
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].trade.deleteMany({}).catch(()=>{});
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].position.deleteMany({}).catch(()=>{});
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].agentDecision.deleteMany({}).catch(()=>{});
}
}),
"[project]/src/app/api/portfolio/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET,
    "dynamic",
    ()=>dynamic,
    "runtime",
    ()=>runtime
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$trading$2d$state$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/trading-state.ts [app-route] (ecmascript)");
;
;
const dynamic = 'force-dynamic';
const runtime = 'nodejs';
async function GET() {
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$trading$2d$state$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["snapshotPortfolio"])());
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__aadd8c23._.js.map