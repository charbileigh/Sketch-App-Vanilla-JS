const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

// Resize the canvas to fit display size
function resizeCanvasToDisplaySize() {
  const wrap = document.querySelector('.canvas-wrap');
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const rect = wrap.getBoundingClientRect();
  const displayWidth = Math.floor(rect.width);
  const displayHeight = Math.floor(rect.height);

  if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
    let snapshot = null;
    try {
      snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch (e) {}
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingQuality = 'high';
    if (snapshot) ctx.putImageData(snapshot, 0, 0);
  } else {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

// Basic state
let drawing = false;
let lastX = 0, lastY = 0;
let mode = 'brush';
let strokeColor = document.getElementById('color').value;
let brushSize = +document.getElementById('size').value;
let opacity = +document.getElementById('opacity').value;

// Undo/redo history
const undoStack = [];
const redoStack = [];
const MAX_HISTORY = 30;

function pushHistory() {
  try {
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    undoStack.push(img);
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack.length = 0;
  } catch (e) {
    console.warn('History push failed:', e);
  }
}

function undo() {
  if (!undoStack.length) return;
  const current = ctx.getImageData(0, 0, canvas.width, canvas.height);
  redoStack.push(current);
  const prev = undoStack.pop();
  ctx.putImageData(prev, 0, 0);
}

function redo() {
  if (!redoStack.length) return;
  const current = ctx.getImageData(0, 0, canvas.width, canvas.height);
  undoStack.push(current);
  const next = redoStack.pop();
  ctx.putImageData(next, 0, 0);
}

// Update toolbar status
function setStatus() {
  const st = document.getElementById('status');
  const hex = strokeColor.toUpperCase();
  st.textContent = `${mode === 'brush' ? 'Brush' : 'Eraser'}: ${brushSize}px · ${mode==='brush'?hex:'bg'}`;
}

// Drawing functions
function beginStroke(x, y) {
  pushHistory();
  drawing = true;
  lastX = x; lastY = y;
  ctx.beginPath();
  ctx.moveTo(x, y);
}

function drawStroke(x, y) {
  if (!drawing) return;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = brushSize;
  if (mode === 'brush') {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = hexWithAlpha(strokeColor, opacity);
  } else {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
  }
  ctx.lineTo(x, y);
  ctx.stroke();
  lastX = x;
  lastY = y;
}

function endStroke() {
  if (!drawing) return;
  drawing = false;
  ctx.closePath();
}

function hexWithAlpha(hex, a) {
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  }
  return `rgba(${r},${g},${b},${a})`;
}

// Get position for pointer/touch events
function getPos(evt) {
  const rect = canvas.getBoundingClientRect();
  if (evt.touches && evt.touches[0]) {
    return { x: evt.touches[0].clientX - rect.left, y: evt.touches[0].clientY - rect.top };
  }
  return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
}

// Pointer events
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  const { x, y } = getPos(e);
  beginStroke(x, y);
});
canvas.addEventListener('pointermove', (e) => {
  const { x, y } = getPos(e);
  drawStroke(x, y);
});
canvas.addEventListener('pointerup', () => endStroke());
canvas.addEventListener('pointercancel', () => endStroke());
canvas.addEventListener('pointerleave', () => endStroke());

// Toolbar controls
const colorEl = document.getElementById('color');
const sizeEl = document.getElementById('size');
const opacityEl = document.getElementById('opacity');
const brushBtn = document.getElementById('brushBtn');
const eraserBtn = document.getElementById('eraserBtn');

function setMode(next) {
  mode = next;
  brushBtn.setAttribute('aria-pressed', next === 'brush');
  eraserBtn.setAttribute('aria-pressed', next === 'eraser');
  setStatus();
}

brushBtn.addEventListener('click', () => setMode('brush'));
eraserBtn.addEventListener('click', () => setMode('eraser'));

colorEl.addEventListener('input', (e) => { strokeColor = e.target.value; setStatus(); });
sizeEl.addEventListener('input', (e) => { brushSize = +e.target.value; setStatus(); });
opacityEl.addEventListener('input', (e) => { opacity = +e.target.value; setStatus(); });

document.getElementById('clearBtn').addEventListener('click', () => {
  pushHistory();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

document.getElementById('saveBtn').addEventListener('click', () => {
  const exportScale = 2;
  const off = document.createElement('canvas');
  off.width = canvas.width * exportScale / (window.devicePixelRatio || 1);
  off.height = canvas.height * exportScale / (window.devicePixelRatio || 1);
  const octx = off.getContext('2d');
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(canvas, 0, 0, off.width, off.height);
  const url = off.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = `sketch-${Date.now()}.png`;
  a.click();
});

document.getElementById('undoBtn').addEventListener('click', undo);
document.getElementById('redoBtn').addEventListener('click', redo);

// Keyboard shortcuts
window.addEventListener('keydown', (e) => {
  if (e.key === 'b' || e.key === 'B') setMode('brush');
  if (e.key === 'e' || e.key === 'E') setMode('eraser');
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
    e.preventDefault();
    undo();
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && e.shiftKey) {
    e.preventDefault();
    redo();
  }
});

// Initialize canvas and status
const ro = new ResizeObserver(() => resizeCanvasToDisplaySize());
ro.observe(document.querySelector('.canvas-wrap'));
resizeCanvasToDisplaySize();
pushHistory();
setStatus();
