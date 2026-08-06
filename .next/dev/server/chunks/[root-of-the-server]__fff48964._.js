module.exports = [
"[externals]/child_process [external] (child_process, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("child_process", () => require("child_process"));

module.exports = mod;
}),
"[externals]/fs [external] (fs, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("fs", () => require("fs"));

module.exports = mod;
}),
"[externals]/path [external] (path, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("path", () => require("path"));

module.exports = mod;
}),
"[project]/src/instrumentation.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "register",
    ()=>register
]);
// Next.js instrumentation — runs once when the server process starts.
// Boots the market-data microservice automatically (so you only need to
// run `npm run dev` — no separate terminal for the market service).
// Then restores symbols + positions from the database and starts the
// multi-agent engine.
var __TURBOPACK__imported__module__$5b$externals$5d2f$child_process__$5b$external$5d$__$28$child_process$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/child_process [external] (child_process, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$fs__$5b$external$5d$__$28$fs$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/fs [external] (fs, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$path__$5b$external$5d$__$28$path$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/path [external] (path, cjs)");
;
;
;
async function register() {
    if ("TURBOPACK compile-time truthy", 1) {
        const { connectMarket, restoreFromDb } = await __turbopack_context__.A("[project]/src/lib/trading-state.ts [instrumentation] (ecmascript, async loader)");
        const { startAgentEngine } = await __turbopack_context__.A("[project]/src/lib/agent-engine.ts [instrumentation] (ecmascript, async loader)");
        const { db } = await __turbopack_context__.A("[project]/src/lib/db.ts [instrumentation] (ecmascript, async loader)");
        // 1. Auto-start the market-data microservice (port 3003) if not running.
        //    This means you only need ONE command: `npm run dev` — the dashboard
        //    starts the market service automatically as a child process.
        try {
            const res = await fetch('http://localhost:3003/').catch(()=>null);
            if (!res) {
                const marketPath = __TURBOPACK__imported__module__$5b$externals$5d2f$path__$5b$external$5d$__$28$path$2c$__cjs$29$__["default"].join(process.cwd(), 'mini-services', 'market-data', 'index.ts');
                if ((0, __TURBOPACK__imported__module__$5b$externals$5d2f$fs__$5b$external$5d$__$28$fs$2c$__cjs$29$__["existsSync"])(marketPath)) {
                    console.log('[instrumentation] auto-starting market-data service on port 3003...');
                    const child = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$child_process__$5b$external$5d$__$28$child_process$2c$__cjs$29$__["spawn"])('npx', [
                        'tsx',
                        marketPath
                    ], {
                        stdio: 'ignore',
                        detached: true,
                        cwd: __TURBOPACK__imported__module__$5b$externals$5d2f$path__$5b$external$5d$__$28$path$2c$__cjs$29$__["default"].join(process.cwd(), 'mini-services', 'market-data'),
                        env: {
                            ...process.env,
                            FORCE_COLOR: '0'
                        }
                    });
                    child.unref();
                    // wait for it to start
                    await new Promise((resolve)=>setTimeout(resolve, 3000));
                    console.log('[instrumentation] market-data service started');
                }
            } else {
                console.log('[instrumentation] market-data service already running');
            }
        } catch  {
        // ignore — the dashboard's fallback price generator will handle it
        }
        // 2. seed default risk settings row
        db.riskSettings.upsert({
            where: {
                id: 'default'
            },
            create: {
                id: 'default'
            },
            update: {}
        }).catch(()=>{});
        // 3. restore symbols + positions from DB — MUST finish before engine starts
        await restoreFromDb().catch((e)=>console.error('[instrumentation] restoreFromDb failed:', e?.message));
        // 4. connect to the market-data microservice (or use fallback if unavailable)
        connectMarket();
        // 5. start the multi-agent engine AFTER symbols are loaded
        startAgentEngine(60_000);
        console.log('[instrumentation] trading bot bootstrapped — everything running from ONE command');
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__fff48964._.js.map