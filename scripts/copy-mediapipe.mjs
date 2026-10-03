// Copies the MediaPipe vision engine (WebAssembly) from node_modules into
// public/mediapipe/wasm before dev/build, so the clock-in face check loads it
// from this site (lib/face-detector.ts). Not committed — ~22 MB.
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const src = join(process.cwd(), "node_modules", "@mediapipe", "tasks-vision", "wasm");
const dest = join(process.cwd(), "public", "mediapipe", "wasm");
if (!existsSync(src)) {
  console.warn("copy-mediapipe: @mediapipe/tasks-vision not installed — skipping");
  process.exit(0);
}
mkdirSync(dest, { recursive: true });
// Only the two engines FilesetResolver picks between (SIMD / no SIMD).
for (const f of readdirSync(src)) {
  if (/^vision_wasm_(nosimd_)?internal\.(js|wasm)$/.test(f)) cpSync(join(src, f), join(dest, f));
}
console.log("copy-mediapipe: copied to public/mediapipe/wasm");
