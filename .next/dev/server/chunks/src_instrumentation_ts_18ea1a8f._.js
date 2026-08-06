module.exports = [
"[project]/src/instrumentation.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Next.js instrumentation — runs once when the server process starts.
// 
// ARCHITECTURE CHANGE: The TypeScript dashboard is now a PURE FRONTEND.
// All trading logic, AI predictions, and Bitget execution happen in the
// Python Core (server.py on port 8000). 
//
// The TypeScript server does NOT start its own agent engine anymore.
// It simply serves the UI and proxies API requests to Python.
//
// To start the trading engine: run `python server.py` in the python-core folder,
// then click "Start Bot" in the dashboard UI.
__turbopack_context__.s([
    "register",
    ()=>register
]);
async function register() {
    if ("TURBOPACK compile-time truthy", 1) {
        console.log('[instrumentation] TypeScript dashboard started (pure frontend mode)');
        console.log('[instrumentation] Waiting for Python Core on http://localhost:8000...');
        console.log('[instrumentation] Start it with: cd python-core && python server.py');
    }
}
}),
];

//# sourceMappingURL=src_instrumentation_ts_18ea1a8f._.js.map