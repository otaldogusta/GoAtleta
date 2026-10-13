import { copyFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
const require = createRequire(import.meta.url);
const source = dirname(require.resolve('onnxruntime-web'));
const target = new URL('../public/scouting-ai/runtime/', import.meta.url);
await mkdir(target, { recursive: true });
for (const file of ['ort.all.bundle.min.mjs', 'ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.jsep.mjs', 'ort-wasm-simd-threaded.jsep.wasm']) {
  await copyFile(join(source, file), new URL(file, target));
}
console.log('Scouting: runtime local preparado.');
