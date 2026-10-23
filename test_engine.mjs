import fs from 'fs';
const mainJsText = fs.readFileSync('main.js', 'utf8');
const WASM_START = '/*WASM-START*/';
const WASM_END = '/*WASM-END*/';
const wsIdx = mainJsText.indexOf(WASM_START);
const weIdx = mainJsText.indexOf(WASM_END, wsIdx);
console.log('markers found:', wsIdx, weIdx);
const stripped = mainJsText.slice(0, wsIdx) + mainJsText.slice(weIdx + WASM_END.length);
const bytes = new TextEncoder().encode(stripped);
const H_START = 2166136261;
const H_END = 16777619;
let h = H_START;
for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, H_END) >>> 0;
}
const engineId = h >>> 0;
console.log('engineId:', engineId);

// load wasm
const wasmModule = await import('./engine.js');
const wasmBinary = fs.readFileSync('engine_bg.wasm', 'utf8');
const payload = wasmBinary.slice(wasmBinary.indexOf(WASM_START) + WASM_START.length, wasmBinary.indexOf(WASM_END));
const wasmBin = Uint8Array.from(atob(payload), c => c.charCodeAt(0));
await wasmModule.default({ module_or_path: wasmBin });
const engine = new wasmModule.InrefensEngine('en', true, engineId);
console.log('engine created OK');
EOF