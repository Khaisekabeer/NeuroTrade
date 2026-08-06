module.exports = [
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
];

//# sourceMappingURL=src_lib_bitget-executor_ts_23f1e77b._.js.map