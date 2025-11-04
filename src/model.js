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
    // If you placed ort-wasm*.wasm next to ort.min.js in /public/, this is correct
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

// ... rest of file unchanged
