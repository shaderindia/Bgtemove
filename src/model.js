/**
 * Model loading and inference module
 * Uses ONNX Runtime Web with WebGPU/WebGL/WASM fallback
 */

let session = null;
let executionProvider = 'WASM';

// Model path with version for cache-busting
const MODEL_URL = 'public/u2netp.onnx?v=20251104';

// Will be filled after session creation
let MODEL_IO = {
  inputName: null,
  outputName: null,
  inputSize: 320
};

/**
 * Initialize ONNX session with EP fallback
 */
export async function initModel() {
  if (!window.ort) {
    throw new Error('onnxruntime-web (ort) not found. Make sure public/ort.min.js is loaded.');
  }

  // Ensure ORT knows where to fetch wasm binaries if WASM EP is used
  if (ort?.env?.wasm) {
    ort.env.wasm.wasmPaths = 'public/';
  }

  const tryProviders = [
    { name: 'WEBGPU', list: ['webgpu'] },
    { name: 'WEBGL', list: ['webgl'] },
    { name: 'WASM',   list: ['wasm'] }
  ];

  let lastError = null;
  for (const ep of tryProviders) {
    try {
      session = await ort.InferenceSession.create(MODEL_URL, { executionProviders: ep.list });
      executionProvider = ep.name;

      // Detect model I/O names from metadata
      if (session.inputNames?.length) MODEL_IO.inputName = session.inputNames[0];
      if (session.outputNames?.length) MODEL_IO.outputName = session.outputNames[0];

      // Fallback defaults if not reported
      if (!MODEL_IO.inputName) MODEL_IO.inputName = 'input';
      if (!MODEL_IO.outputName) MODEL_IO.outputName = 'output';
      return;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError || new Error('Failed to initialize ONNX session');
}

export function getExecutionProvider() {
  return executionProvider;
}

/**
 * Resize + normalize to float32 CHW in [0,1]
 */
function preprocess(canvas) {
  const size = MODEL_IO.inputSize;
  const tmp = document.createElement('canvas');
  tmp.width = size;
  tmp.height = size;
  const tctx = tmp.getContext('2d');
  tctx.drawImage(canvas, 0, 0, size, size);
  const { data } = tctx.getImageData(0, 0, size, size);

  const chw = new Float32Array(3 * size * size);
  for (let i = 0; i < size * size; i++) {
    chw[i] = data[i * 4] / 255;
    chw[size * size + i] = data[i * 4 + 1] / 255;
    chw[size * size * 2 + i] = data[i * 4 + 2] / 255;
  }
  return { tensor: new ort.Tensor('float32', chw, [1, 3, size, size]) };
}

/**
 * Bilinear upscale from model size to original size
 */
function bilinearUpscale(src, srcW, srcH, dstW, dstH) {
  const dst = new Float32Array(dstW * dstH);
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;
  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const sx = x * xRatio, sy = y * yRatio;
      const x1 = Math.floor(sx), y1 = Math.floor(sy);
      const x2 = Math.min(x1 + 1, srcW - 1), y2 = Math.min(y1 + 1, srcH - 1);
      const dx = sx - x1, dy = sy - y1;

      const p11 = src[y1 * srcW + x1];
      const p12 = src[y1 * srcW + x2];
      const p21 = src[y2 * srcW + x1];
      const p22 = src[y2 * srcW + x2];

      dst[y * dstW + x] =
        p11 * (1 - dx) * (1 - dy) +
        p12 * dx * (1 - dy) +
        p21 * (1 - dx) * dy +
        p22 * dx * dy;
    }
  }
  return dst;
}

/**
 * Run inference and return mask as Float32Array [0..1] of original size
 */
export async function processImage(origCanvas) {
  if (!session) throw new Error('Model not initialized');

  const { tensor } = preprocess(origCanvas);
  const feeds = { [MODEL_IO.inputName]: tensor };
  const outputs = await session.run(feeds);

  // Pick first available output if name unknown
  const outKey = MODEL_IO.outputName in outputs
    ? MODEL_IO.outputName
    : Object.keys(outputs)[0];

  const out = outputs[outKey];
  const data = out.data; // Float32Array
  const modelSize = MODEL_IO.inputSize;

  let src;
  if (data instanceof Float32Array && data.length === modelSize * modelSize) {
    src = data;
  } else if (data instanceof Float32Array && out.dims?.length === 4) {
    const h = out.dims[2], w = out.dims[3];
    if (h === modelSize && w === modelSize) {
      src = data;
    } else {
      const flat = new Float32Array(h * w);
      for (let i = 0; i < h * w; i++) flat[i] = data[i];
      const up = bilinearUpscale(flat, w, h, origCanvas.width, origCanvas.height);
      for (let i = 0; i < up.length; i++) up[i] = Math.max(0, Math.min(1, up[i]));
      return up;
    }
  } else {
    src = new Float32Array(modelSize * modelSize);
    for (let i = 0; i < src.length && i < data.length; i++) src[i] = data[i];
  }

  const up = bilinearUpscale(src, modelSize, modelSize, origCanvas.width, origCanvas.height);
  for (let i = 0; i < up.length; i++) up[i] = Math.max(0, Math.min(1, up[i]));
  return up;
}
