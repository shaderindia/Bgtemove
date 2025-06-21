
// ========== Ultimate AI Background Remover Full Script ==========

let model, originalImage, segmentationData, canvas = document.getElementById('canvas'), 
    ctx = canvas.getContext('2d'), history = [], historyStep = -1;

const loader = document.getElementById('loader'), toast = document.getElementById('toast');

// Load the AI model
async function loadModel() {
  setLoading(true); showToast("Loading AI Model...");
  model = await bodyPix.load({ architecture: 'MobileNetV1', outputStride: 16, multiplier: 0.75, quantBytes: 2 });
  setLoading(false); showToast("Model Loaded");
}
loadModel();

// Utility: Loader and Toast
function setLoading(state) {
  loader.classList[state ? 'add' : 'remove']('show');
}
function showToast(msg) {
  toast.textContent = msg; toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// History: Undo/Redo Support
function pushHistory() {
  history = history.slice(0, historyStep + 1);
  history.push(canvas.toDataURL()); historyStep++;
  updateUndoRedoButtons();
}
function updateUndoRedoButtons() {
  document.getElementById('undoBtn').disabled = historyStep <= 0;
  document.getElementById('redoBtn').disabled = historyStep >= history.length - 1;
}
function restoreHistory(step) {
  let img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0); img.src = history[step];
}

// File Upload Handling
document.getElementById('imageUpload').onchange = e => {
  let file = e.target.files[0]; if (!file) return;
  let reader = new FileReader();
  reader.onload = evt => {
    let img = new Image();
    img.onload = () => {
      originalImage = img;
      canvas.width = img.width; canvas.height = img.height;
      ctx.drawImage(img, 0, 0); pushHistory();
      enableControls(true);
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
};

// Control Enable Toggle
function enableControls(enabled) {
  ['removeBgBtn','cropBtn','changeBgColorBtn','blurBgBtn','downloadTransparentBtn',
   'downloadWithBgBtn','redoBtn','undoBtn','changeBgImageBtn','filtersBtn','scenePicker'].forEach(id =>
    document.getElementById(id).disabled = !enabled);
  document.getElementById('cropMode').disabled = enabled;
  document.getElementById('bgImageUpload').disabled = !enabled;
}

// Background Removal
document.getElementById('removeBgBtn').onclick = async () => {
  if (!originalImage) return; setLoading(true);
  segmentationData = await model.segmentPerson(originalImage, { internalResolution: 'high', segmentationThreshold: 0.7 });
  applyMask(null); setLoading(false); showToast("BG Removed"); pushHistory();
};

// Apply Segmentation Mask
function applyMask(bg) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  let mask = bodyPix.toMask(segmentationData, { r: 255, g: 255, b: 255, a: 255 }, bg ? { r: 0, g: 0, b: 0, a: 255 } : { r: 0, g: 0, b: 0, a: 0 });
  bodyPix.drawMask(canvas, null, mask, 1, 5, false);
  ctx.globalCompositeOperation = 'source-in';
  ctx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'source-over';
}

// Background Color Replacement
document.getElementById('changeBgColorBtn').onclick = () => {
  if (!segmentationData) return;
  let color = document.getElementById('bgColorPicker').value;
  ctx.fillStyle = color; ctx.fillRect(0, 0, canvas.width, canvas.height);
  applyMask(true); pushHistory(); showToast("Color Applied");
};

// Blur Background
document.getElementById('blurBgBtn').onclick = () => {
  if (!segmentationData) return;
  let temp = document.createElement('canvas'), tctx = temp.getContext('2d');
  temp.width = canvas.width; temp.height = canvas.height;
  tctx.filter = 'blur(10px)'; tctx.drawImage(originalImage, 0, 0, temp.width, temp.height);
  ctx.drawImage(temp, 0, 0); applyMask(true); pushHistory(); showToast("Blurred");
};

// Background Image Replacement
document.getElementById('bgImageUpload').onchange = e => {
  let file = e.target.files[0];
  if (!file) return;
  let reader = new FileReader();
  reader.onload = evt => {
    let img = new Image(); img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      applyMask(true); pushHistory(); showToast("BG Image Applied");
    }; img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
};

// Scene Templates (Office, Park, Beach)
document.getElementById('scenePicker').onchange = e => {
  const scene = e.target.value;
  if (!scene) return;
  let url = 'https://source.unsplash.com/featured/?' + scene;
  let img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    applyMask(true); pushHistory(); showToast(scene + " BG Applied");
  };
  img.src = url;
};

// Undo/Redo
document.getElementById('undoBtn').onclick = () => {
  if (historyStep > 0) restoreHistory(--historyStep);
  updateUndoRedoButtons();
};
document.getElementById('redoBtn').onclick = () => {
  if (historyStep < history.length - 1) restoreHistory(++historyStep);
  updateUndoRedoButtons();
};

// Downloads
document.getElementById('downloadTransparentBtn').onclick = () => {
  let link = document.createElement('a');
  link.href = canvas.toDataURL(); link.download = "transparent.png";
  link.click();
};
document.getElementById('downloadWithBgBtn').onclick = () => {
  let link = document.createElement('a');
  link.href = canvas.toDataURL(); link.download = "with_background.png";
  link.click();
};
