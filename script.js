// ==========================================
// ESTADO GLOBAL Y ELEMENTOS DEL DOM
// ==========================================
const mainVideo = document.getElementById('mainVideo');
const videoInput = document.getElementById('videoInput');
const dropArea = document.getElementById('dropArea');
const progressBar = document.getElementById('progressBar');
const btnPlayPause = document.getElementById('btnPlayPause');
const btnStepBack = document.getElementById('btnStepBack');
const btnStepForward = document.getElementById('btnStepForward');
const btnCut = document.getElementById('btnCut');
const btnUndo = document.getElementById('btnUndo');
const btnRedo = document.getElementById('btnRedo');
const btnResetCuts = document.getElementById('btnResetCuts');
const btnCancelPendingCut = document.getElementById('btnCancelPendingCut');
const startTimeLabel = document.getElementById('startTimeLabel');
const endTimeLabel = document.getElementById('endTimeLabel');
const currentTimeLabel = document.getElementById('currentTimeLabel');

const pendingCutMarker = document.getElementById('pendingCutMarker');
const cutSegmentsContainer = document.getElementById('cutSegmentsContainer');

const timelineScrollContainer = document.getElementById('timelineScrollContainer');
const timelineTrackWrapper = document.getElementById('timelineTrackWrapper');
const timelineRuler = document.getElementById('timelineRuler');
const btnZoomIn = document.getElementById('btnZoomIn');
const btnZoomOut = document.getElementById('btnZoomOut');
const btnZoomReset = document.getElementById('btnZoomReset');
const zoomLevelLabel = document.getElementById('zoomLevelLabel');

const volumeSlider = document.getElementById('volumeSlider');
const btnMute = document.getElementById('btnMute');
const speedSelect = document.getElementById('speedSelect');
const btnLoop = document.getElementById('btnLoop');
const btnFullscreen = document.getElementById('btnFullscreen');
const btnDownload = document.getElementById('btnDownload');

const phoneWrapper = document.getElementById('phoneWrapper');

let videoDuration = 0;
let tempMarkStart = null;
let cutIntervals = []; // Guardará las zonas rojas (fragmentos que SE ELIMINAN)
let isSeekingToKeep = false;

// Historial para Deshacer/Rehacer
let historyStack = [];
let redoStack = [];

let currentFrameCount = 1;
let resizeObserver = null;
let phoneWrapperObserver = null;
let renderAnimationFrameId = null;

// Zoom de línea de tiempo
let zoomLevel = 1;
const MIN_ZOOM = 1;
const MAX_ZOOM = 20;

const cropBoxes = [
  { x: 0.05, y: 0.1, width: 0.28, height: 0.8 },
  { x: 0.36, y: 0.1, width: 0.28, height: 0.8 },
  { x: 0.67, y: 0.1, width: 0.28, height: 0.8 },
  { x: 0.1, y: 0.55, width: 0.42, height: 0.4 }
];

const layoutPresets = {
  1: [
    { id: 'full', title: 'Pantalla Completa Vertical (9:16)', type: 'preview-1-full', spans: 1 },
    { id: 'centered-sq', title: 'Cuadrado Centrado (1:1)', type: 'preview-1-sq', spans: 1 },
    { id: 'centered-yt', title: 'Video Horizontal Centrado (16:9)', type: 'preview-1-yt', spans: 1 },
    { id: 'panoramic', title: 'Panorámico Vertical (4:5)', type: 'preview-1-panoramic', spans: 1 }
  ],
  2: [
    { id: 'equal', title: '2 Cuadros Apilados Verticales', type: 'preview-2-equal', spans: 2 },
    { id: '2-side-by-side', title: '2 Cuadros Horizontales Centrados', type: 'preview-2-horizontal', spans: 2 },
    { id: 'yt-top', title: 'Arriba 16:9 / Abajo 1:1', type: 'preview-2-yt-top', spans: 2 },
    { id: 'yt-bottom', title: 'Arriba 1:1 / Abajo 16:9', type: 'preview-2-yt-bottom', spans: 2 },
    { id: 'pip', title: 'Imagen en Imagen (PiP)', type: 'preview-2-pip', spans: 2 }
  ],
  3: [
    { id: 'equal-3', title: '3 Cuadros Apilados', type: 'preview-3-stack', spans: 3 },
    { id: '3-side-by-side', title: '3 Cuadros Horizontales Centrados', type: 'preview-3-horizontal', spans: 3 },
    { id: '1-top-2-bottom', title: '1 Arriba / 2 Abajo', type: 'preview-3-grid-1-2', spans: 3 },
    { id: '2-top-1-bottom', title: '2 Arriba / 1 Abajo', type: 'preview-3-grid-2-1', spans: 3 },
    { id: 'main-plus-2-side', title: 'Grande Izquierda + 2 Derecha', type: 'preview-3-main-side', spans: 3 }
  ],
  4: [
    { id: 'grid-2x2', title: 'Grid 2x2', type: 'preview-4-grid', spans: 4 },
    { id: '4-stack', title: '4 Cuadros Apilados', type: 'preview-4-stack', spans: 4 },
    { id: '1-plus-3', title: '1 Grande + 3 Pequeños', type: 'preview-4-main-plus-3', spans: 4 }
  ]
};

// ==========================================
// HISTORIAL (DESHACER / REHACER)
// ==========================================
function saveStateToHistory() {
  historyStack.push(JSON.stringify(cutIntervals));
  redoStack = [];
  updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
  if (btnUndo) btnUndo.disabled = historyStack.length === 0;
  if (btnRedo) btnRedo.disabled = redoStack.length === 0;
}

if (btnUndo) {
  btnUndo.addEventListener('click', () => {
    if (historyStack.length === 0) return;
    redoStack.push(JSON.stringify(cutIntervals));
    const previousState = historyStack.pop();
    cutIntervals = JSON.parse(previousState);
    resetCutButtonUI();
    renderCutSegments();
    updateUndoRedoButtons();
    enforceCutSkip();
  });
}

if (btnRedo) {
  btnRedo.addEventListener('click', () => {
    if (redoStack.length === 0) return;
    historyStack.push(JSON.stringify(cutIntervals));
    const nextState = redoStack.pop();
    cutIntervals = JSON.parse(nextState);
    resetCutButtonUI();
    renderCutSegments();
    updateUndoRedoButtons();
    enforceCutSkip();
  });
}

if (btnResetCuts) {
  btnResetCuts.addEventListener('click', () => {
    if (cutIntervals.length === 0) return;
    if (!confirm('¿Eliminar todos los cortes y restaurar el video completo?')) return;
    saveStateToHistory();
    cutIntervals = [];
    resetCutButtonUI();
    renderCutSegments();
    updateCanvasPreviews();
  });
}

// ==========================================
// DIMENSIONES DE RENDERIZADO DEL VIDEO
// ==========================================
function getVideoRenderDimensions() {
  const containerRect = dropArea.getBoundingClientRect();
  const vWidth = mainVideo.videoWidth;
  const vHeight = mainVideo.videoHeight;

  if (!vWidth || !vHeight) {
    return { width: containerRect.width, height: containerRect.height, left: 0, top: 0 };
  }

  const containerRatio = containerRect.width / containerRect.height;
  const videoRatio = vWidth / vHeight;

  let renderWidth, renderHeight;

  if (videoRatio > containerRatio) {
    renderWidth = containerRect.width;
    renderHeight = containerRect.width / videoRatio;
  } else {
    renderHeight = containerRect.height;
    renderWidth = containerRect.height * videoRatio;
  }

  const left = (containerRect.width - renderWidth) / 2;
  const top = (containerRect.height - renderHeight) / 2;

  return { width: renderWidth, height: renderHeight, left, top };
}

// ==========================================
// CARGA Y GESTIÓN DE VIDEO / DRAG & DROP
// ==========================================
if (videoInput) {
  videoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) loadVideoFile(file);
  });
}

if (dropArea) {
  ['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropArea.classList.add('drag-active');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropArea.classList.remove('drag-active');
    });
  });

  dropArea.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
      loadVideoFile(file);
    }
  });
}

function loadVideoFile(file) {
  const url = URL.createObjectURL(file);
  mainVideo.src = url;
  mainVideo.load();
}

mainVideo.addEventListener('loadedmetadata', () => {
  videoDuration = mainVideo.duration;
  cutIntervals = [];
  historyStack = [];
  redoStack = [];
  tempMarkStart = null;
  zoomLevel = 1;
  resetCutButtonUI();

  if (progressBar) {
    progressBar.max = videoDuration;
    progressBar.value = 0;
  }

  if (endTimeLabel) endTimeLabel.textContent = `Duración: ${formatTime(videoDuration)}`;
  if (currentTimeLabel) currentTimeLabel.textContent = `Tiempo: ${formatTime(0)}`;

  // El wrapper del video tiene tamaño fijo (16:9) por CSS, así que no se mueve el layout.
  renderCropOverlayBoxes();
  renderPhoneFrames(currentFrameCount);
  renderCutSegments();
  updateUndoRedoButtons();

  applyTimelineWidth();
  renderTimelineRuler();
});

// ==========================================
// LÓGICA DE RECORTE Y ELIMINACIÓN DE FRAGMENTOS
// ==========================================
if (btnCut) {
  btnCut.addEventListener('click', () => {
    if (!videoDuration) return;

    if (tempMarkStart === null) {
      // Paso 1: Fijar punto de INICIO del fragmento a eliminar
      tempMarkStart = mainVideo.currentTime;
      const percent = (tempMarkStart / videoDuration) * 100;

      if (pendingCutMarker) {
        pendingCutMarker.style.left = `${percent}%`;
        pendingCutMarker.style.display = 'block';
      }

      btnCut.textContent = '✂ Fin Recorte';
      btnCut.classList.replace('btn-danger', 'btn-primary');
      if (startTimeLabel) startTimeLabel.textContent = `Inicio: ${formatTime(tempMarkStart)}`;
    } else {
      // Paso 2: Fijar punto de FIN y CREAR EL CORTE (zona roja)
      const tempMarkEnd = mainVideo.currentTime;

      if (tempMarkEnd <= tempMarkStart) {
        alert("El punto final debe ser mayor al punto de inicio.");
        return;
      }

      saveStateToHistory();

      cutIntervals.push({
        id: Date.now(),
        start: tempMarkStart,
        end: tempMarkEnd
      });

      resetCutButtonUI();
      renderCutSegments();
      enforceCutSkip();
    }
  });
}

// Permite cancelar la selección de corte en curso (antes de confirmar el fin)
if (btnCancelPendingCut) {
  btnCancelPendingCut.addEventListener('click', (e) => {
    e.stopPropagation();
    resetCutButtonUI();
  });
}

function resetCutButtonUI() {
  tempMarkStart = null;
  if (pendingCutMarker) pendingCutMarker.style.display = 'none';
  if (btnCut) {
    btnCut.textContent = '✂ Recortar';
    btnCut.className = 'btn btn-danger';
  }
  if (startTimeLabel) startTimeLabel.textContent = 'Corte: Inactivo';
}

function renderCutSegments() {
  if (!cutSegmentsContainer || !videoDuration) return;
  cutSegmentsContainer.innerHTML = '';

  cutIntervals.forEach((interval) => {
    const leftPercent = (interval.start / videoDuration) * 100;
    const widthPercent = ((interval.end - interval.start) / videoDuration) * 100;

    const segment = document.createElement('div');
    segment.className = 'cut-segment';
    segment.style.left = `${leftPercent}%`;
    segment.style.width = `${widthPercent}%`;
    segment.title = `Corte: ${formatTime(interval.start)} - ${formatTime(interval.end)}`;

    // Botón BASURA: elimina este corte y RESTAURA el video en ese tramo
    const trashBtn = document.createElement('button');
    trashBtn.className = 'trash-btn';
    trashBtn.innerHTML = '🗑';
    trashBtn.title = 'Eliminar este corte (restaurar la sección)';
    trashBtn.type = 'button';

    trashBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      removeCutInterval(interval.id);
    });

    segment.appendChild(trashBtn);
    cutSegmentsContainer.appendChild(segment);
  });
}

// ELIMINAR EL CORTE = RESTAURAR EL FRAGMENTO EN EL VIDEO
function removeCutInterval(id) {
  saveStateToHistory();
  cutIntervals = cutIntervals.filter(item => item.id !== id);
  renderCutSegments();
  updateCanvasPreviews();
}

// ==========================================
// OMISIÓN AUTOMÁTICA DE FRAGMENTOS ELIMINADOS
// ==========================================
function enforceCutSkip() {
  if (!videoDuration || isSeekingToKeep) return;

  const currentTime = mainVideo.currentTime;

  for (let cut of cutIntervals) {
    if (currentTime >= cut.start && currentTime < cut.end) {
      isSeekingToKeep = true;
      mainVideo.currentTime = cut.end; // Salta automáticamente el tramo eliminado

      if (cut.end >= videoDuration) {
        mainVideo.pause();
        if (btnPlayPause) btnPlayPause.textContent = '▶ Play';
      }

      setTimeout(() => { isSeekingToKeep = false; }, 50);
      break;
    }
  }
}

// ==========================================
// CONTROLES DE REPRODUCCIÓN
// ==========================================
if (btnPlayPause) {
  btnPlayPause.addEventListener('click', () => {
    if (mainVideo.paused) {
      enforceCutSkip();
      mainVideo.play();
      btnPlayPause.textContent = '⏸ Pausa';
    } else {
      mainVideo.pause();
      btnPlayPause.textContent = '▶ Play';
    }
  });
}

function stepFrame(framesCount) {
  if (!videoDuration) return;
  const fps = 30;
  mainVideo.pause();
  if (btnPlayPause) btnPlayPause.textContent = '▶ Play';

  let newTime = mainVideo.currentTime + (framesCount / fps);
  mainVideo.currentTime = Math.max(0, Math.min(videoDuration, newTime));
  enforceCutSkip();
  updateCanvasPreviews();
}

if (btnStepBack) btnStepBack.addEventListener('click', () => stepFrame(-1));
if (btnStepForward) btnStepForward.addEventListener('click', () => stepFrame(1));

mainVideo.addEventListener('play', () => startSmoothRenderLoop());
mainVideo.addEventListener('pause', () => {
  stopSmoothRenderLoop();
  updateCanvasPreviews();
});
mainVideo.addEventListener('seeking', () => updateCanvasPreviews());

mainVideo.addEventListener('timeupdate', () => {
  if (progressBar) progressBar.value = mainVideo.currentTime;
  if (currentTimeLabel) currentTimeLabel.textContent = `Tiempo: ${formatTime(mainVideo.currentTime)}`;
  enforceCutSkip();
  autoScrollTimelineToPlayhead();
});

if (progressBar) {
  progressBar.addEventListener('input', () => {
    mainVideo.currentTime = parseFloat(progressBar.value);
    enforceCutSkip();
    updateCanvasPreviews();
  });
}

function formatTime(seconds) {
  if (isNaN(seconds)) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// ==========================================
// ATAJOS DE TECLADO
// ==========================================
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

  switch (e.key) {
    case 'ArrowLeft':
      e.preventDefault();
      stepFrame(-1);
      break;
    case 'ArrowRight':
      e.preventDefault();
      stepFrame(1);
      break;
    case 'j': case 'J':
      e.preventDefault();
      mainVideo.currentTime = Math.max(0, mainVideo.currentTime - 1);
      enforceCutSkip();
      break;
    case 'l': case 'L':
      e.preventDefault();
      mainVideo.currentTime = Math.min(videoDuration, mainVideo.currentTime + 1);
      enforceCutSkip();
      break;
    case 'c': case 'C':
      e.preventDefault();
      if (btnCut) btnCut.click();
      break;
    case 'Escape':
      if (tempMarkStart !== null) {
        e.preventDefault();
        resetCutButtonUI();
      }
      break;
    case 'z': case 'Z':
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.shiftKey) {
          if (btnRedo) btnRedo.click();
        } else {
          if (btnUndo) btnUndo.click();
        }
      }
      break;
    case ' ':
      e.preventDefault();
      if (btnPlayPause) btnPlayPause.click();
      break;
  }
});

// ==========================================
// BUCLE DE RENDERIZADO OPTIMIZADO (60 FPS)
// ==========================================
function startSmoothRenderLoop() {
  if (renderAnimationFrameId) return;

  const renderLoop = () => {
    if (!mainVideo.paused && !mainVideo.ended) {
      updateCanvasPreviews();
      renderAnimationFrameId = requestAnimationFrame(renderLoop);
    } else {
      renderAnimationFrameId = null;
    }
  };

  renderAnimationFrameId = requestAnimationFrame(renderLoop);
}

function stopSmoothRenderLoop() {
  if (renderAnimationFrameId) {
    cancelAnimationFrame(renderAnimationFrameId);
    renderAnimationFrameId = null;
  }
}

// ==========================================
// CUADROS INTERACTIVOS SOBRE EL VIDEO (CROP)
// ==========================================
function renderCropOverlayBoxes() {
  const oldBoxes = dropArea.querySelectorAll('.video-crop-box');
  oldBoxes.forEach(box => box.remove());

  for (let i = 0; i < currentFrameCount; i++) {
    createCropBoxElement(i);
  }
}

function createCropBoxElement(index) {
  const boxData = cropBoxes[index];
  const boxEl = document.createElement('div');
  boxEl.className = `video-crop-box crop-box-${index + 1}`;
  boxEl.dataset.index = index;

  const label = document.createElement('span');
  label.className = 'crop-label';
  label.textContent = `Cuadro ${index + 1}`;

  const handle = document.createElement('div');
  handle.className = 'resize-handle';

  boxEl.appendChild(label);
  boxEl.appendChild(handle);
  dropArea.appendChild(boxEl);

  positionCropBoxElement(boxEl, boxData);
  enableBoxDragAndResize(boxEl, index);
}

function positionCropBoxElement(element, data) {
  const videoDim = getVideoRenderDimensions();
  element.style.left = `${videoDim.left + (data.x * videoDim.width)}px`;
  element.style.top = `${videoDim.top + (data.y * videoDim.height)}px`;
  element.style.width = `${data.width * videoDim.width}px`;
  element.style.height = `${data.height * videoDim.height}px`;
}

function enableBoxDragAndResize(element, index) {
  let isDragging = false;
  let isResizing = false;
  let startX, startY, initialX, initialY, initialW, initialH;

  element.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const isHandle = e.target.classList.contains('resize-handle');
    const videoDim = getVideoRenderDimensions();

    if (isHandle) {
      isResizing = true;
    } else {
      isDragging = true;
    }

    startX = e.clientX;
    startY = e.clientY;

    initialX = cropBoxes[index].x * videoDim.width;
    initialY = cropBoxes[index].y * videoDim.height;
    initialW = cropBoxes[index].width * videoDim.width;
    initialH = cropBoxes[index].height * videoDim.height;

    const onMouseMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      if (isDragging) {
        let newX = Math.max(0, Math.min(videoDim.width - initialW, initialX + dx));
        let newY = Math.max(0, Math.min(videoDim.height - initialH, initialY + dy));
        cropBoxes[index].x = newX / videoDim.width;
        cropBoxes[index].y = newY / videoDim.height;
      } else if (isResizing) {
        let newW = Math.max(30, Math.min(videoDim.width - initialX, initialW + dx));
        let newH = Math.max(30, Math.min(videoDim.height - initialY, initialH + dy));
        cropBoxes[index].width = newW / videoDim.width;
        cropBoxes[index].height = newH / videoDim.height;
      }

      positionCropBoxElement(element, cropBoxes[index]);
      updateCanvasPreviews();
    };

    const onMouseUp = () => {
      isDragging = false;
      isResizing = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });
}

// ==========================================
// VISTA PREVIA CELULAR: AJUSTE EXACTO 9:16 POR JS
// ==========================================
function fitPhoneScreen() {
  const phoneScreen = document.getElementById('phoneScreen');
  if (!phoneWrapper || !phoneScreen || document.fullscreenElement) return;

  const rect = phoneWrapper.getBoundingClientRect();
  const availW = rect.width;
  const availH = rect.height;
  if (availW <= 0 || availH <= 0) return;

  const ratio = 9 / 16; // ancho / alto

  let w = availH * ratio;
  let h = availH;

  if (w > availW) {
    w = availW;
    h = availW / ratio;
  }

  phoneScreen.style.width = `${Math.floor(w)}px`;
  phoneScreen.style.height = `${Math.floor(h)}px`;

  resizeCanvases();
}

// ==========================================
// VISTA PREVIA Y FORMATOS DEL TELÉFONO
// ==========================================
function setLayout(count, event) {
  currentFrameCount = count;

  if (event) {
    document.querySelectorAll('.btn-layout').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
  }

  renderPresetIconPicker(count);
  renderCropOverlayBoxes();
  renderPhoneFrames(count);
}

function renderPresetIconPicker(count) {
  const container = document.getElementById('presetPicker');
  if (!container) return;

  container.innerHTML = '';
  const presets = layoutPresets[count] || [];

  presets.forEach((preset, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `icon-btn ${index === 0 ? 'active' : ''}`;
    btn.title = preset.title;

    let spansHTML = '';
    for (let i = 0; i < preset.spans; i++) spansHTML += '<span></span>';

    btn.innerHTML = `<div class="layout-preview-box ${preset.type}">${spansHTML}</div>`;

    btn.addEventListener('click', () => {
      container.querySelectorAll('.icon-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      changeFormatPreset(preset.id);
    });

    container.appendChild(btn);
  });

  if (presets.length > 0) {
    changeFormatPreset(presets[0].id);
  }
}

function changeFormatPreset(presetId) {
  const phoneScreen = document.getElementById('phoneScreen');
  if (!phoneScreen) return;

  phoneScreen.className = 'phone-screen';

  switch (presetId) {
    case 'full': phoneScreen.classList.add('layout-1-full'); break;
    case 'centered-sq': phoneScreen.classList.add('layout-1-sq'); break;
    case 'centered-yt': phoneScreen.classList.add('layout-1-yt'); break;
    case 'panoramic': phoneScreen.classList.add('layout-1-panoramic'); break;

    case 'equal': phoneScreen.classList.add('layout-2-equal'); break;
    case '2-side-by-side': phoneScreen.classList.add('layout-2-horizontal'); break;
    case 'yt-top': phoneScreen.classList.add('layout-2-yt-top'); break;
    case 'yt-bottom': phoneScreen.classList.add('layout-2-yt-bottom'); break;
    case 'pip': phoneScreen.classList.add('layout-2-pip'); break;

    case 'equal-3': phoneScreen.classList.add('layout-3-equal'); break;
    case '3-side-by-side': phoneScreen.classList.add('layout-3-horizontal'); break;
    case '1-top-2-bottom': phoneScreen.classList.add('layout-3-grid-1-2'); break;
    case '2-top-1-bottom': phoneScreen.classList.add('layout-3-grid-2-1'); break;
    case 'main-plus-2-side': phoneScreen.classList.add('layout-3-main-side'); break;

    case 'grid-2x2': phoneScreen.classList.add('layout-4-grid'); break;
    case '4-stack': phoneScreen.classList.add('layout-4-stack'); break;
    case '1-plus-3': phoneScreen.classList.add('layout-4-main-plus-3'); break;
  }

  requestAnimationFrame(() => {
    fitPhoneScreen();
  });
}

function renderPhoneFrames(count) {
  const phoneScreen = document.getElementById('phoneScreen');
  if (!phoneScreen) return;

  if (resizeObserver) {
    resizeObserver.disconnect();
  }

  phoneScreen.innerHTML = '';

  resizeObserver = new ResizeObserver(() => {
    resizeCanvases();
  });

  for (let i = 1; i <= count; i++) {
    const frameBox = document.createElement('div');
    frameBox.className = `frame-box frame-${i}`;

    const tag = document.createElement('span');
    tag.className = `phone-frame-tag tag-${i}`;
    tag.textContent = `Cuadro ${i}`;

    const canvas = document.createElement('canvas');
    canvas.id = `phoneCanvas${i}`;

    frameBox.appendChild(tag);
    frameBox.appendChild(canvas);
    phoneScreen.appendChild(frameBox);

    resizeObserver.observe(frameBox);
  }

  requestAnimationFrame(() => {
    fitPhoneScreen();
  });
}

function resizeCanvases() {
  for (let i = 0; i < currentFrameCount; i++) {
    const canvas = document.getElementById(`phoneCanvas${i + 1}`);
    if (!canvas) continue;

    const parent = canvas.parentElement;
    const rect = parent.getBoundingClientRect();

    if (rect.width > 0 && rect.height > 0) {
      canvas.width = Math.floor(rect.width);
      canvas.height = Math.floor(rect.height);
    }
  }
  updateCanvasPreviews();
}

function updateCanvasPreviews() {
  if (!mainVideo.videoWidth || !mainVideo.videoHeight) return;

  const vWidth = mainVideo.videoWidth;
  const vHeight = mainVideo.videoHeight;

  for (let i = 0; i < currentFrameCount; i++) {
    const canvas = document.getElementById(`phoneCanvas${i + 1}`);
    if (!canvas) continue;

    const ctx = canvas.getContext('2d', { alpha: false });
    const crop = cropBoxes[i];

    const sourceX = crop.x * vWidth;
    const sourceY = crop.y * vHeight;
    const sourceW = crop.width * vWidth;
    const sourceH = crop.height * vHeight;

    if (sourceW > 0 && sourceH > 0 && canvas.width > 0 && canvas.height > 0) {
      ctx.drawImage(
        mainVideo,
        sourceX, sourceY, sourceW, sourceH,
        0, 0, canvas.width, canvas.height
      );
    }
  }
}

// ==========================================
// ZOOM DE LA LÍNEA DE TIEMPO + REGLA DE TIEMPO
// (Solo afecta timelineTrackWrapper / timelineRuler dentro de su scroll-container)
// ==========================================
function applyTimelineWidth() {
  if (!timelineScrollContainer || !timelineTrackWrapper) return;
  const baseWidth = timelineScrollContainer.clientWidth;
  const widthPx = baseWidth * zoomLevel;
  timelineTrackWrapper.style.width = `${widthPx}px`;
  timelineRuler.style.width = `${widthPx}px`;
  if (zoomLevelLabel) zoomLevelLabel.textContent = `${Math.round(zoomLevel * 100)}%`;
}

function renderTimelineRuler() {
  if (!timelineRuler || !videoDuration) return;
  timelineRuler.innerHTML = '';

  const trackWidthPx = timelineTrackWrapper.clientWidth || timelineScrollContainer.clientWidth;
  const minPxGap = 70;
  const candidates = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600];

  let interval = candidates[candidates.length - 1];
  for (const c of candidates) {
    const px = (c / videoDuration) * trackWidthPx;
    if (px >= minPxGap) {
      interval = c;
      break;
    }
  }

  for (let t = 0; t <= videoDuration; t += interval) {
    const leftPercent = (t / videoDuration) * 100;

    const tick = document.createElement('div');
    tick.className = 'ruler-tick';
    tick.style.left = `${leftPercent}%`;

    const label = document.createElement('span');
    label.className = 'ruler-label';
    label.textContent = formatRulerLabel(t, interval);

    tick.appendChild(label);
    timelineRuler.appendChild(tick);
  }
}

function formatRulerLabel(seconds, interval) {
  if (interval < 1) {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins.toString().padStart(2, '0')}:${secs.padStart(4, '0')}`;
  }
  return formatTime(seconds);
}

function setZoom(newZoom, pivotClientX) {
  newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newZoom));
  if (newZoom === zoomLevel) return;

  const containerRect = timelineScrollContainer.getBoundingClientRect();
  const oldWidth = timelineTrackWrapper.clientWidth || 1;
  const pivotX = pivotClientX !== undefined
    ? (pivotClientX - containerRect.left) + timelineScrollContainer.scrollLeft
    : timelineScrollContainer.scrollLeft + containerRect.width / 2;
  const timeAtPivot = videoDuration ? (pivotX / oldWidth) * videoDuration : 0;

  zoomLevel = newZoom;
  applyTimelineWidth();
  renderTimelineRuler();

  const newWidth = timelineTrackWrapper.clientWidth || 1;
  const newPivotX = videoDuration ? (timeAtPivot / videoDuration) * newWidth : 0;
  const offsetInViewport = pivotClientX !== undefined ? (pivotClientX - containerRect.left) : containerRect.width / 2;
  timelineScrollContainer.scrollLeft = Math.max(0, newPivotX - offsetInViewport);
}

if (btnZoomIn) {
  btnZoomIn.addEventListener('click', () => setZoom(zoomLevel + 1));
}
if (btnZoomOut) {
  btnZoomOut.addEventListener('click', () => setZoom(zoomLevel - 1));
}
if (btnZoomReset) {
  btnZoomReset.addEventListener('click', () => setZoom(1));
}

if (timelineScrollContainer) {
  timelineScrollContainer.addEventListener('wheel', (e) => {
    if (!videoDuration) return;

    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const direction = e.deltaY > 0 ? -1 : 1;
      setZoom(zoomLevel + direction, e.clientX);
    } else if (zoomLevel > 1) {
      e.preventDefault();
      timelineScrollContainer.scrollLeft += e.deltaY;
    }
  }, { passive: false });
}

function autoScrollTimelineToPlayhead() {
  if (!videoDuration || zoomLevel <= 1 || mainVideo.paused) return;

  const trackWidthPx = timelineTrackWrapper.clientWidth;
  const playheadPx = (mainVideo.currentTime / videoDuration) * trackWidthPx;
  const viewLeft = timelineScrollContainer.scrollLeft;
  const viewRight = viewLeft + timelineScrollContainer.clientWidth;

  if (playheadPx < viewLeft + 30 || playheadPx > viewRight - 30) {
    timelineScrollContainer.scrollLeft = playheadPx - timelineScrollContainer.clientWidth / 2;
  }
}

// ==========================================
// CONTROLES ADICIONALES: VOLUMEN, VELOCIDAD, LOOP, FULLSCREEN
// ==========================================
if (volumeSlider) {
  volumeSlider.addEventListener('input', () => {
    mainVideo.volume = parseFloat(volumeSlider.value);
    mainVideo.muted = mainVideo.volume === 0;
    updateMuteIcon();
  });
}

if (btnMute) {
  btnMute.addEventListener('click', () => {
    mainVideo.muted = !mainVideo.muted;
    updateMuteIcon();
  });
}

function updateMuteIcon() {
  if (!btnMute) return;
  btnMute.textContent = mainVideo.muted || mainVideo.volume === 0 ? '🔇' : '🔊';
}

if (speedSelect) {
  speedSelect.addEventListener('change', () => {
    mainVideo.playbackRate = parseFloat(speedSelect.value);
  });
}

if (btnLoop) {
  btnLoop.addEventListener('click', () => {
    mainVideo.loop = !mainVideo.loop;
    btnLoop.classList.toggle('active', mainVideo.loop);
  });
}

if (btnFullscreen) {
  btnFullscreen.addEventListener('click', () => {
    const phoneScreen = document.getElementById('phoneScreen');
    if (!phoneScreen) return;

    if (!document.fullscreenElement) {
      phoneScreen.requestFullscreen().catch(err => {
        console.warn('No se pudo activar pantalla completa:', err);
      });
    } else {
      document.exitFullscreen();
    }
  });
}

document.addEventListener('fullscreenchange', () => {
  requestAnimationFrame(() => {
    if (!document.fullscreenElement) {
      fitPhoneScreen();
    } else {
      resizeCanvases();
    }
  });
});

// ==========================================
// EXPORTACIÓN Y DESCARGA DEL VIDEO EDITADO
// ==========================================
if (btnDownload) {
  btnDownload.addEventListener('click', () => {
    exportEditedVideo();
  });
}

async function exportEditedVideo() {
  if (!mainVideo.src || !videoDuration) {
    alert('Primero carga un video para poder exportarlo.');
    return;
  }

  if (!('MediaRecorder' in window) || !HTMLCanvasElement.prototype.captureStream) {
    alert('Tu navegador no soporta la grabación de video (MediaRecorder / captureStream). Prueba con Chrome o Edge actualizados.');
    return;
  }

  const originalText = btnDownload.textContent;
  btnDownload.disabled = true;

  mainVideo.pause();
  if (btnPlayPause) btnPlayPause.textContent = '▶ Play';

  const phoneScreen = document.getElementById('phoneScreen');
  const phoneRect = phoneScreen.getBoundingClientRect();

  const EXPORT_HEIGHT = 1920;
  const EXPORT_WIDTH = Math.max(2, Math.round(EXPORT_HEIGHT * (phoneRect.width / phoneRect.height)));

  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = EXPORT_WIDTH;
  exportCanvas.height = EXPORT_HEIGHT;
  const ctx = exportCanvas.getContext('2d');

  const scale = EXPORT_HEIGHT / phoneRect.height;

  const canvasStream = exportCanvas.captureStream(30);
  let combinedStream = canvasStream;

  try {
    let audioSourceStream = null;
    if (typeof mainVideo.captureStream === 'function') {
      audioSourceStream = mainVideo.captureStream();
    } else if (typeof mainVideo.mozCaptureStream === 'function') {
      audioSourceStream = mainVideo.mozCaptureStream();
    }
    if (audioSourceStream) {
      const audioTracks = audioSourceStream.getAudioTracks();
      if (audioTracks.length > 0) {
        combinedStream = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);
      }
    }
  } catch (err) {
    console.warn('No se pudo capturar el audio original, se exportará sin audio.', err);
  }

  let mimeType = 'video/webm;codecs=vp9,opus';
  if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm;codecs=vp8,opus';
  if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';

  const recorder = new MediaRecorder(combinedStream, { mimeType });
  const chunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const wasLoop = mainVideo.loop;
  mainVideo.loop = false;

  // Ir al inicio y esperar a que el frame esté listo
  await new Promise((resolve) => {
    const onSeeked = () => {
      mainVideo.removeEventListener('seeked', onSeeked);
      resolve();
    };
    mainVideo.addEventListener('seeked', onSeeked);
    mainVideo.currentTime = 0;
  });

  enforceCutSkip();

  recorder.start(250);
  btnDownload.textContent = '⏺ Grabando 0%';

  let drawing = true;

  function drawFrame() {
    if (!drawing) return;

    for (let i = 0; i < currentFrameCount; i++) {
      const frameBox = document.querySelector(`.frame-${i + 1}`);
      if (!frameBox) continue;

      const fRect = frameBox.getBoundingClientRect();
      const dx = (fRect.left - phoneRect.left) * scale;
      const dy = (fRect.top - phoneRect.top) * scale;
      const dw = fRect.width * scale;
      const dh = fRect.height * scale;

      const crop = cropBoxes[i];
      const vW = mainVideo.videoWidth;
      const vH = mainVideo.videoHeight;
      const sx = crop.x * vW;
      const sy = crop.y * vH;
      const sw = crop.width * vW;
      const sh = crop.height * vH;

      if (sw > 0 && sh > 0 && dw > 0 && dh > 0) {
        ctx.drawImage(mainVideo, sx, sy, sw, sh, dx, dy, dw, dh);
      }
    }

    const progressPct = videoDuration ? Math.min(100, Math.round((mainVideo.currentTime / videoDuration) * 100)) : 0;
    btnDownload.textContent = `⏺ Grabando ${progressPct}%`;

    if (isExportFinished()) {
      drawing = false;
      return;
    }

    requestAnimationFrame(drawFrame);
  }

  function isExportFinished() {
    if (mainVideo.ended) return true;
    if (mainVideo.paused && mainVideo.currentTime >= videoDuration - 0.2) return true;
    return false;
  }

  mainVideo.play();
  requestAnimationFrame(drawFrame);

  // Esperar a que termine de dibujar (fin del video, respetando los cortes)
  await new Promise((resolve) => {
    const check = () => {
      if (!drawing) {
        resolve();
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });

  await new Promise((resolve) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `clip-editado-${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      resolve();
    };
    recorder.stop();
  });

  mainVideo.loop = wasLoop;
  btnDownload.disabled = false;
  btnDownload.textContent = originalText;
}

window.addEventListener('resize', () => {
  renderCropOverlayBoxes();
  fitPhoneScreen();
  renderCutSegments();
  applyTimelineWidth();
  renderTimelineRuler();
});

document.addEventListener('DOMContentLoaded', () => {
  setLayout(1);
  updateMuteIcon();

  // Mantiene la vista previa en formato celular exacto ante cualquier cambio de tamaño del panel
  if (phoneWrapper) {
    phoneWrapperObserver = new ResizeObserver(() => fitPhoneScreen());
    phoneWrapperObserver.observe(phoneWrapper);
  }
  fitPhoneScreen();
});