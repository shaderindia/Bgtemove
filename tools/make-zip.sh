#!/usr/bin/env bash
set -euo pipefail

VER="${1:-1.16.3}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[1/3] Fetching onnxruntime-web v${VER} into public/ ..."
mkdir -p public
curl -fsSL "https://cdn.jsdelivr.net/npm/onnxruntime-web@${VER}/dist/ort.min.js" -o public/ort.min.js

# Optional WASM binaries for WASM fallback + offline
curl -fsSL "https://cdn.jsdelivr.net/npm/onnxruntime-web@${VER}/dist/ort-wasm.wasm" -o public/ort-wasm.wasm || true
curl -fsSL "https://cdn.jsdelivr.net/npm/onnxruntime-web@${VER}/dist/ort-wasm-simd.wasm" -o public/ort-wasm-simd.wasm || true
curl -fsSL "https://cdn.jsdelivr.net/npm/onnxruntime-web@${VER}/dist/ort-wasm-threaded.wasm" -o public/ort-wasm-threaded.wasm || true
curl -fsSL "https://cdn.jsdelivr.net/npm/onnxruntime-web@${VER}/dist/ort-wasm-simd-threaded.wasm" -o public/ort-wasm-simd-threaded.wasm || true

echo "[2/3] Verifying required files ..."
REQUIRED=( index.html service-worker.js manifest.webmanifest public/styles.css public/u2netp.onnx public/ort.min.js src/app.js src/model.js src/image.js src/ui.js src/pwa.js )
for f in "${REQUIRED[@]}"; do
  [[ -f "$f" ]] || { echo "Missing required file: $f" >&2; exit 1; }
done

echo "[3/3] Creating ZIP ..."
OUT="bgremove-offline.zip"
rm -f "$OUT"
zip -r "$OUT" . \
  -x ".git/*" ".github/*" "node_modules/*" "tools/*" \
  -x "*.DS_Store"

echo "Done. ZIP created: $OUT"
