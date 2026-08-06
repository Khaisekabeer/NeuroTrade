(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push(["chunks/_6c53cc66._.js",
"[project]/ [instrumentation-edge] (unsupported edge import 'child_process', ecmascript)", ((__turbopack_context__, module, exports) => {

__turbopack_context__.n(__import_unsupported(`child_process`));
}),
"[project]/ [instrumentation-edge] (unsupported edge import 'fs', ecmascript)", ((__turbopack_context__, module, exports) => {

__turbopack_context__.n(__import_unsupported(`fs`));
}),
"[project]/ [instrumentation-edge] (unsupported edge import 'path', ecmascript)", ((__turbopack_context__, module, exports) => {

__turbopack_context__.n(__import_unsupported(`path`));
}),
"[project]/src/instrumentation.ts [instrumentation-edge] (ecmascript)", ((__turbopack_context__) => {
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
var __TURBOPACK__imported__module__$5b$project$5d2f$__$5b$instrumentation$2d$edge$5d$__$28$unsupported__edge__import__$27$child_process$272c$__ecmascript$29$__ = __turbopack_context__.i("[project]/ [instrumentation-edge] (unsupported edge import 'child_process', ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$__$5b$instrumentation$2d$edge$5d$__$28$unsupported__edge__import__$27$fs$272c$__ecmascript$29$__ = __turbopack_context__.i("[project]/ [instrumentation-edge] (unsupported edge import 'fs', ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$__$5b$instrumentation$2d$edge$5d$__$28$unsupported__edge__import__$27$path$272c$__ecmascript$29$__ = __turbopack_context__.i("[project]/ [instrumentation-edge] (unsupported edge import 'path', ecmascript)");
;
;
;
async function register() {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
}
}),
"[project]/node_modules/next/dist/esm/build/templates/edge-wrapper.js { MODULE => \"[project]/src/instrumentation.ts [instrumentation-edge] (ecmascript)\" } [instrumentation-edge] (ecmascript)", ((__turbopack_context__, module, exports) => {

// The wrapped module could be an async module, we handle that with the proxy
// here. The comma expression makes sure we don't call the function with the
// module as the "this" arg.
// Turn exports into functions that are also a thenable. This way you can await the whole object
// or  exports (e.g. for Components) or call them directly as though they are async functions
// (e.g. edge functions/middleware, this is what the Edge Runtime does).
// Catch promise to prevent UnhandledPromiseRejectionWarning, this will be propagated through
// the awaited export(s) anyway.
self._ENTRIES ||= {};
const modProm = Promise.resolve().then(()=>__turbopack_context__.i("[project]/src/instrumentation.ts [instrumentation-edge] (ecmascript)"));
modProm.catch(()=>{});
self._ENTRIES["middleware_instrumentation"] = new Proxy(modProm, {
    get (innerModProm, name) {
        if (name === 'then') {
            return (res, rej)=>innerModProm.then(res, rej);
        }
        let result = (...args)=>innerModProm.then((mod)=>(0, mod[name])(...args));
        result.then = (res, rej)=>innerModProm.then((mod)=>mod[name]).then(res, rej);
        return result;
    }
}); //# sourceMappingURL=edge-wrapper.js.map
}),
]);

//# sourceMappingURL=_6c53cc66._.js.map