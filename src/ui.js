/**
 * UI wiring for inputs, sliders, brush, before/after slider, downloads, batch
 */

let callbacks = {};
let brushState = { painting: false, mode: 'add', size: 20 };
let comparison = { dragging: false, pos: 50 };

export function initUI(state, handlers) {
  callbacks = handlers;

  // Drop zone + file input
  const drop = document.getElementById('drop-zone');
  const input = document.getElementById('file-input');
  if (drop && input) {
    drop.addEventListener('click', () => input.click());
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('dragover'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      drop.classList.remove('dragover');
      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
      if (files.length) state.batchMode ? files.forEach(f => handlers.onImageLoad(f)) : handlers.onImageLoad(files[0]);
    });
    drop.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
    });
    input.addEventListener('change', (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length) state.batchMode ? files.forEach(f => handlers.onImageLoad(f)) : handlers.onImageLoad(files[0]);
      e.target.value = '';
    });
  }

  // Paste support
  const pasteBtn = document.getElementById('paste-btn');
  pasteBtn?.addEventListener('click', async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        for (const t of item.types) {
          if (t.startsWith('image/')) { const b = await item.getType(t); handlers.onImageLoad(b); showToast('Pasted image', 'success'); return; }
        }
      }
      showToast('No image in clipboard', 'warning');
    } catch {
      showToast('Clipboard read failed', 'error');
    }
  });
  document.addEventListener('paste', (e) => {
    const items = Array.from(e.clipboardData?.items || []);
    for (const it of items) {
      if (it.type.startsWith('image/')) { const b = it.getAsFile(); handlers.onImageLoad(b); showToast('Pasted image', 'success'); break; }
    }
  });

  // Background presets
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.preset-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
      btn.classList.add('active'); btn.setAttribute('aria-pressed', 'true');
      handlers.onBackgroundChange(btn.dataset.preset);
    });
  });
  const color = document.getElementById('custom-color');
  color?.addEventListener('input', (e) => handlers.onBackgroundChange('custom', e.target.value));
  color?.addEventListener('change', (e) => handlers.onBackgroundChange('custom', e.target.value));

  // Edge softness
  const soft = document.getElementById('edge-softness');
  const softVal = document.getElementById('softness-value');
  if (soft && softVal) soft.addEventListener('input', (e) => { const v = parseFloat(e.target.value); softVal.textContent = v; handlers.onEdgeSoftnessChange(v); });

  // Brush controls
  const addBtn = document.getElementById('brush-add');
  const remBtn = document.getElementById('brush-remove');
  const size = document.getElementById('brush-size');
  const sizeVal = document.getElementById('brush-size-value');
  addBtn?.addEventListener('click', () => { brushState.mode = 'add'; addBtn.classList.add('active'); addBtn.setAttribute('aria-checked', 'true'); remBtn?.classList.remove('active'); remBtn?.setAttribute('aria-checked', 'false'); });
  remBtn?.addEventListener('click', () => { brushState.mode = 'remove'; remBtn.classList.add('active'); remBtn.setAttribute('aria-checked', 'true'); addBtn?.classList.remove('active'); addBtn?.setAttribute('aria-checked', 'false'); });
  size?.addEventListener('input', (e) => { brushState.size = parseInt(e.target.value); if (sizeVal) sizeVal.textContent = brushState.size; });

  // Undo/Redo/Reset
  const undo = document.getElementById('undo-btn');
  const redo = document.getElementById('redo-btn');
  const reset = document.getElementById('reset-mask-btn');
  undo?.addEventListener('click', handlers.onUndo);
  redo?.addEventListener('click', handlers.onRedo);
  reset?.addEventListener('click', handlers.onResetMask);

  // Downloads
  const dlPng = document.getElementById('download-png-btn');
  const dlJpg = document.getElementById('download-jpg-btn');
  dlPng?.addEventListener('click', handlers.onDownloadPNG);
  dlJpg?.addEventListener('click', handlers.onDownloadJPG);

  // Batch mode
  const batch = document.getElementById('batch-mode-toggle');
  const queue = document.getElementById('batch-queue');
  batch?.addEventListener('change', (e) => { handlers.onBatchModeToggle(e.target.checked); if (queue) queue.style.display = e.target.checked ? 'block' : 'none'; });

  // Before/after slider
  initComparisonSlider();

  // Brush overlay
  initBrushCanvas(state, handlers);
}

function initComparisonSlider() {
  const slider = document.getElementById('comparison-slider');
  const handle = document.getElementById('slider-handle');
  const after = document.getElementById('after-canvas');
  if (!slider || !handle || !after) return;

  // Initialize to 50%
  comparison.pos = 50;
  after.style.clipPath = `inset(0 ${100 - comparison.pos}% 0 0)`;
  handle.style.left = `${comparison.pos}%`;
  handle.setAttribute('aria-valuenow', `${comparison.pos}`);

  const applyPct = (pct) => {
    comparison.pos = Math.max(0, Math.min(100, pct));
    after.style.clipPath = `inset(0 ${100 - comparison.pos}% 0 0)`;
    handle.style.left = `${comparison.pos}%`;
    handle.setAttribute('aria-valuenow', `${Math.round(comparison.pos)}`);
  };

  const applyFromClientX = (x) => {
    const rect = slider.getBoundingClientRect();
    const pct = ((x - rect.left) / rect.width) * 100;
    applyPct(pct);
  };

  // Pointer/Touch drag
  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const move = (ev) => applyFromClientX(ev.clientX);
    const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });

  handle.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const move = (ev) => applyFromClientX(ev.touches[0].clientX);
    const up = () => { document.removeEventListener('touchmove', move); document.removeEventListener('touchend', up); };
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', up);
  });

  // Keyboard
  handle.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); applyPct(comparison.pos - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); applyPct(comparison.pos + 1); }
  });
}

function initBrushCanvas(state, handlers) {
  const c = document.getElementById('brush-canvas');
  const before = document.getElementById('before-canvas');
  if (!c || !before) return;

  const resize = () => { c.width = before.width; c.height = before.height; c.style.width = '100%'; c.style.height = '100%'; };
  const obs = new ResizeObserver(resize);
  obs.observe(before);

  const paintAt = (clientX, clientY) => {
    if (!state.currentMask) return;
    const rect = c.getBoundingClientRect();
    const sx = c.width / rect.width, sy = c.height / rect.height;
    const x = (clientX - rect.left) * sx;
    const y = (clientY - rect.top) * sy;

    const r = Math.max(1, Math.round(brushState.size / 2));
    const pixels = [], values = [];
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const dist = Math.hypot(dx, dy);
        if (dist <= r) {
          const px = Math.round(x + dx), py = Math.round(y + dy);
          if (px >= 0 && px < c.width && py >= 0 && py < c.height) {
            const idx = py * c.width + px;
            pixels.push(idx);
            const falloff = 1 - (dist / r);
            values.push(brushState.mode === 'add' ? Math.max(falloff, 0) : 0);
          }
        }
      }
    }
    if (pixels.length) handlers.onBrushPaint({ pixels, values });
  };

  c.addEventListener('mousedown', (e) => { brushState.painting = true; paintAt(e.clientX, e.clientY); });
  c.addEventListener('mousemove', (e) => { if (brushState.painting) paintAt(e.clientX, e.clientY); });
  c.addEventListener('mouseup', () => { brushState.painting = false; });
  c.addEventListener('mouseleave', () => { brushState.painting = false; });

  c.addEventListener('touchstart', (e) => { e.preventDefault(); brushState.painting = true; const t = e.touches[0]; paintAt(t.clientX, t.clientY); }, { passive: false });
  c.addEventListener('touchmove', (e) => { e.preventDefault(); if (brushState.painting) { const t = e.touches[0]; paintAt(t.clientX, t.clientY); } }, { passive: false });
  c.addEventListener('touchend', () => { brushState.painting = false; });
}

// Toasts and loading UI
export function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  el.setAttribute('role', 'alert');
  container.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, duration);
}

export function showLoading(text = 'Loading...') {
  const overlay = document.getElementById('loading-overlay');
  const lbl = document.getElementById('loading-text');
  if (overlay) overlay.style.display = 'flex';
  if (lbl) lbl.textContent = text;
}
export function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.style.display = 'none';
}

export function updateHistoryButtons(canUndo, canRedo) {
  const undo = document.getElementById('undo-btn');
  const redo = document.getElementById('redo-btn');
  if (undo) undo.disabled = !canUndo;
  if (redo) redo.disabled = !canRedo;
}

export function togglePreview(show) {
  const empty = document.getElementById('empty-state');
  const preview = document.getElementById('preview-container');
  if (empty) empty.style.display = show ? 'none' : 'flex';
  if (preview) preview.style.display = show ? 'block' : 'none';
}

export function updateBatchQueue(queue) {
  const count = document.getElementById('queue-count');
  const list = document.getElementById('queue-list');
  const btn = document.getElementById('batch-download-btn');
  if (count) count.textContent = String(queue.length);
  if (list) {
    list.innerHTML = '';
    queue.forEach((item, i) => {
      const div = document.createElement('div');
      div.className = 'queue-item';
      div.textContent = `${i + 1}. ${item.name}`;
      list.appendChild(div);
    });
  }
  if (btn) btn.style.display = queue.length ? 'block' : 'none';
}
