/**
 * Image loading and processing utilities
 * @module image
 */

/**
 * Load image from File/Blob with EXIF orientation handling (basic)
 * @param {File|Blob} file - Image file
 * @returns {Promise<{image: HTMLImageElement, canvas: HTMLCanvasElement}>}
 */
export async function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      resolve({ image: img, canvas });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

/**
 * Box-blur feather on a mask
 * @param {Float32Array} mask
 * @param {number} width
 * @param {number} height
 * @param {number} featherPx
 * @returns {Float32Array}
 */
export function featherMask(mask, width, height, featherPx) {
  if (!featherPx) return mask;
  const out = new Float32Array(mask.length);
  const r = Math.ceil(featherPx);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0, count = 0;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = Math.max(0, Math.min(width - 1, x + dx));
          const ny = Math.max(0, Math.min(height - 1, y + dy));
          sum += mask[ny * width + nx];
          count++;
        }
      }
      out[y * width + x] = sum / count;
    }
  }
  return out;
}

/**
 * Simple canvas blur (CSS filter, fast)
 * @param {HTMLCanvasElement} canvas
 * @param {number} radius
 * @returns {HTMLCanvasElement}
 */
export function blurCanvas(canvas, radius = 20) {
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext('2d');
  ctx.filter = `blur(${radius}px)`;
  ctx.drawImage(canvas, 0, 0);
  return out;
}

/**
 * Compose foreground and background with alpha mask
 * @param {HTMLCanvasElement} srcCanvas - original image
 * @param {Float32Array} mask - alpha [0..1]
 * @param {'transparent'|'white'|'black'|'blur'|'custom'} bgMode
 * @param {string|null} bgColor - hex for custom
 * @param {number} edgeSoftness - feather pixels
 * @returns {HTMLCanvasElement}
 */
export function composeOutput(srcCanvas, mask, bgMode, bgColor, edgeSoftness) {
  const w = srcCanvas.width, h = srcCanvas.height;

  const finalMask = edgeSoftness ? featherMask(mask, w, h, edgeSoftness) : mask;

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d', { willReadFrequently: true });

  // Draw background
  if (bgMode === 'white') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
  } else if (bgMode === 'black') {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
  } else if (bgMode === 'custom' && bgColor) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);
  } else if (bgMode === 'blur') {
    ctx.drawImage(blurCanvas(srcCanvas, 20), 0, 0);
  } else {
    // transparent -> leave as is
    ctx.clearRect(0, 0, w, h);
  }

  // Compose with alpha
  const sctx = srcCanvas.getContext('2d', { willReadFrequently: true });
  const src = sctx.getImageData(0, 0, w, h).data;
  const outData = ctx.getImageData(0, 0, w, h);
  const dst = outData.data;

  if (bgMode === 'transparent') {
    for (let i = 0; i < finalMask.length; i++) {
      const a = Math.max(0, Math.min(1, finalMask[i]));
      const p = i * 4;
      dst[p] = src[p];
      dst[p + 1] = src[p + 1];
      dst[p + 2] = src[p + 2];
      dst[p + 3] = Math.round(a * 255);
    }
  } else {
    // dst already contains bg; alpha composite: fg * a + bg * (1-a)
    for (let i = 0; i < finalMask.length; i++) {
      const a = Math.max(0, Math.min(1, finalMask[i]));
      const p = i * 4;
      dst[p] = Math.round(src[p] * a + dst[p] * (1 - a));
      dst[p + 1] = Math.round(src[p + 1] * a + dst[p + 1] * (1 - a));
      dst[p + 2] = Math.round(src[p + 2] * a + dst[p + 2] * (1 - a));
      dst[p + 3] = 255;
    }
  }

  ctx.putImageData(outData, 0, 0);
  return out;
}

/**
 * Bilinear upscale utility (exported for tests)
 * @param {Float32Array} src
 * @param {number} srcW
 * @param {number} srcH
 * @param {number} dstW
 * @param {number} dstH
 * @returns {Float32Array}
 */
export function bilinearUpscale(src, srcW, srcH, dstW, dstH) {
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
 * Fast guided filter (simple approximation)
 * @param {Float32Array} mask
 * @param {ImageData} guide
 * @param {number} radius
 * @param {number} eps
 * @returns {Float32Array}
 */
export function applyGuidedFilter(mask, guide, radius = 2, eps = 0.01) {
  const { width, height, data } = guide;
  const refined = new Float32Array(mask.length);
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4] / 255, g = data[i * 4 + 1] / 255, b = data[i * 4 + 2] / 255;
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sumM = 0, sumG = 0, sumGM = 0, sumG2 = 0, cnt = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = Math.max(0, Math.min(width - 1, x + dx));
          const ny = Math.max(0, Math.min(height - 1, y + dy));
          const idx = ny * width + nx;
          const g = gray[idx], m = mask[idx];
          sumM += m;
          sumG += g;
          sumGM += g * m;
          sumG2 += g * g;
          cnt++;
        }
      }
      const meanM = sumM / cnt;
      const meanG = sumG / cnt;
      const cov = sumGM / cnt - meanG * meanM;
      const varG = sumG2 / cnt - meanG * meanG;
      const a = cov / (varG + eps);
      const b = meanM - a * meanG;
      refined[y * width + x] = a * gray[y * width + x] + b;
    }
  }
  return refined;
}
