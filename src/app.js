/**
 * Main application entry point
 * Coordinates model loading, UI initialization, and image processing pipeline
 */

import { initModel, processImage, getExecutionProvider } from './model.js';
import { initUI, showToast, showLoading, hideLoading, updateHistoryButtons, togglePreview } from './ui.js';
import { loadImage, composeOutput } from './image.js';

const state = {
    originalImage: null,
    originalMask: null,
    currentMask: null,
    maskHistory: [],
    historyIndex: -1,
    modelReady: false,
    backgroundMode: 'transparent',
    customColor: '#ffffff',
    edgeSoftness: 0,
    brushMode: 'add',
    brushSize: 20,
    batchMode: false,
    batchQueue: []
};

async function init() {
    try {
        showLoading('Loading AI model...');
        await initModel();
        state.modelReady = true;
        
        const provider = getExecutionProvider();
        const providerEl = document.getElementById('execution-provider');
        if (providerEl) providerEl.textContent = provider;
        
        const statusDot = document.querySelector('.status-dot');
        if (statusDot) statusDot.classList.add('active');
        
        hideLoading();
        showToast(`Model loaded (${provider})`, 'success');
        
        initUI(state, {
            onImageLoad: handleImageLoad,
            onBackgroundChange: handleBackgroundChange,
            onEdgeSoftnessChange: handleEdgeSoftnessChange,
            onBrushPaint: handleBrushPaint,
            onUndo: handleUndo,
            onRedo: handleRedo,
            onResetMask: handleResetMask,
            onDownloadPNG: handleDownloadPNG,
            onDownloadJPG: handleDownloadJPG,
            onBatchModeToggle: handleBatchModeToggle
        });
    } catch (error) {
        hideLoading();
        showToast(`Failed to load model: ${error.message}`, 'error');
        console.error('Init error:', error);
    }
}

async function handleImageLoad(file) {
    if (!state.modelReady) {
        showToast('Model not ready yet', 'warning');
        return;
    }
    if (file.size > 50 * 1024 * 1024) {
        showToast('File too large (max 50MB)', 'error');
        return;
    }
    
    try {
        showLoading('Processing image...');
        const { image, canvas } = await loadImage(file);
        state.originalImage = { image, canvas };
        
        const mask = await processImage(canvas);
        state.originalMask = mask;
        state.currentMask = new Float32Array(mask);
        state.maskHistory = [new Float32Array(mask)];
        state.historyIndex = 0;
        
        hideLoading();
        togglePreview(true);
        updatePreview();
        updateHistoryButtons(false, false);
        showToast('Background removed!', 'success');
    } catch (error) {
        hideLoading();
        showToast(`Processing failed: ${error.message}`, 'error');
    }
}

function handleBackgroundChange(mode, color) {
    state.backgroundMode = mode;
    if (color) state.customColor = color;
    updatePreview();
}

function handleEdgeSoftnessChange(value) {
    state.edgeSoftness = value;
    updatePreview();
}

function handleBrushPaint(paintData) {
    if (!state.currentMask) return;
    const mode = paintData.mode || 'add';
    paintData.pixels.forEach((idx, i) => {
        const strength = Math.max(0, Math.min(1, paintData.values[i]));
        const cur = state.currentMask[idx];
        let next = cur;
        if (mode === 'add') {
            next = Math.max(cur, strength);
        } else {
            // remove: reduce alpha by brush strength
            next = cur * (1 - strength);
        }
        state.currentMask[idx] = Math.max(0, Math.min(1, next));
    });
    addToHistory();
    updatePreview();
}

function addToHistory() {
    state.maskHistory = state.maskHistory.slice(0, state.historyIndex + 1);
    state.maskHistory.push(new Float32Array(state.currentMask));
    state.historyIndex++;
    if (state.maskHistory.length > 50) {
      state.maskHistory.shift();
      state.historyIndex--;
    }
    updateHistoryButtons(state.historyIndex > 0, false);
}

function handleUndo() {
    if (state.historyIndex > 0) {
        state.historyIndex--;
        state.currentMask = new Float32Array(state.maskHistory[state.historyIndex]);
        updatePreview();
        updateHistoryButtons(
            state.historyIndex > 0,
            state.historyIndex < state.maskHistory.length - 1
        );
    }
}

function handleRedo() {
    if (state.historyIndex < state.maskHistory.length - 1) {
        state.historyIndex++;
        state.currentMask = new Float32Array(state.maskHistory[state.historyIndex]);
        updatePreview();
        updateHistoryButtons(
            state.historyIndex > 0,
            state.historyIndex < state.maskHistory.length - 1
        );
    }
}

function handleResetMask() {
    if (state.originalMask) {
        state.currentMask = new Float32Array(state.originalMask);
        state.maskHistory = [new Float32Array(state.originalMask)];
        state.historyIndex = 0;
        updatePreview();
        updateHistoryButtons(false, false);
        showToast('Mask reset', 'info');
    }
}

function updatePreview() {
    if (!state.originalImage || !state.currentMask) return;
    
    const output = composeOutput(
        state.originalImage.canvas,
        state.currentMask,
        state.backgroundMode,
        state.customColor,
        state.edgeSoftness
    );
    
    const beforeCanvas = document.getElementById('before-canvas');
    const afterCanvas = document.getElementById('after-canvas');
    
    if (beforeCanvas && afterCanvas) {
        beforeCanvas.width = state.originalImage.canvas.width;
        beforeCanvas.height = state.originalImage.canvas.height;
        beforeCanvas.getContext('2d').drawImage(state.originalImage.canvas, 0, 0);
        
        afterCanvas.width = output.width;
        afterCanvas.height = output.height;
        afterCanvas.getContext('2d').drawImage(output, 0, 0);
    }
}

function handleDownloadPNG() {
    if (!state.originalImage || !state.currentMask) {
        showToast('No image to download', 'warning');
        return;
    }
    const output = composeOutput(
        state.originalImage.canvas,
        state.currentMask,
        'transparent',
        null,
        state.edgeSoftness
    );
    downloadCanvas(output, 'background-removed.png');
    showToast('PNG downloaded', 'success');
}

function handleDownloadJPG() {
    if (!state.originalImage || !state.currentMask) {
        showToast('No image to download', 'warning');
        return;
    }
    const bgMode = state.backgroundMode === 'transparent' ? 'white' : state.backgroundMode;
    const output = composeOutput(
        state.originalImage.canvas,
        state.currentMask,
        bgMode,
        state.customColor,
        state.edgeSoftness
    );
    downloadCanvas(output, 'background-removed.jpg', 'image/jpeg');
    showToast('JPG downloaded', 'success');
}

function downloadCanvas(canvas, filename, mimeType = 'image/png') {
    canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, mimeType, 0.95);
}

function handleBatchModeToggle(enabled) {
    state.batchMode = enabled;
    if (!enabled) state.batchQueue = [];
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
    }
});
