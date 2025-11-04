#!/usr/bin/env bash
set -euo pipefail

# onnxruntime-web version to pin
VER="${1:-1.16.3}"

mkdir -p public

echo "Downloading onnxruntime-web v${VER}..."
curl -fsSL "https://cdn.jsdelivr.net/npm/onnxruntime-web@${VER}/dist/ort.min.js" -o public/ort.min.js

# Optional: download WASM binaries to enable WASM EP and offline fallback.
# Comment out the lines below if you only target WebGPU/WebGL.
curl -fsSL "https://cdn.jsdelivr.net/npm/onnxruntime-web@${VER}/dist/ort-wasm.wasm" -o public/ort-wasm.wasm
curl -fsSL "https://cdn.jsdelivr.net/npm/onnxruntime-web@${VER}/dist/ort-wasm-simd.wasm" -o public/ort-wasm-simd.wasm
curl -fsSL "https://cdn.jsdelivr.net/npm/onnxruntime-web@${VER}/dist/ort-wasm-threaded.wasm" -o public/ort-wasm-threaded.wasm
curl -fsSL "https://cdn.jsdelivr.net/npm/onnxruntime-web@${VER}/dist/ort-wasm-simd-threaded.wasm" -o public/ort-wasm-simd-threaded.wasm

# Write metadata file for traceability
cat > public/ort.meta.json <<JSON
{
  "name": "onnxruntime-web",
  "version": "${VER}",
  "files": [
    "ort.min.js",
    "ort-wasm.wasm",
    "ort-wasm-simd.wasm",
    "ort-wasm-threaded.wasm",
    "ort-wasm-simd-threaded.wasm"
  ],
  "source": "https://cdn.jsdelivr.net/npm/onnxruntime-web@${VER}/dist/"
}
JSON

echo "Done. Files saved in ./public"
