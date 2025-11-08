import { HalftoneOptions, ProcessJob, WorkerProcessRequest, WorkerMessage, HalftoneResult } from './types';
import { fileToDataURL } from './utils/image';
import { downloadDataURL, downloadAllZip } from './download';

// State
interface AppState {
  files: File[];
  jobs: ProcessJob[];
  results: HalftoneResult[];
  worker?: Worker;
  processing: boolean;
  selected: Set<string>; // selected result IDs
}

const state: AppState = {
  files: [],
  jobs: [],
  results: [],
  processing: false,
  selected: new Set(),
};

// DOM refs
const uploadArea = document.getElementById('uploadArea')!;
const fileInput = document.getElementById('fileInput') as HTMLInputElement;
const fileList = document.getElementById('fileList')!;
const imagePreviewSection = document.getElementById('imagePreviewSection')!;
const imagePreviewGrid = document.getElementById('imagePreviewGrid')!;
const processBtn = document.getElementById('processBtn') as HTMLButtonElement;
const downloadSelectedBtn = document.getElementById('downloadSelectedBtn') as HTMLButtonElement;
const downloadAllZipBtn = document.getElementById('downloadAllZipBtn') as HTMLButtonElement;
const outputPreviewSection = document.getElementById('outputPreviewSection')!;
const outputPreviewGrid = document.getElementById('outputPreviewGrid')!;
const progressFill = document.getElementById('progressFill')!;
const progressText = document.getElementById('progressText')!;
const logBox = document.getElementById('logBox')!;
const clearLogBtn = document.getElementById('clearLogBtn') as HTMLButtonElement;
const previewModal = document.getElementById('previewModal')!;
const modalImage = document.getElementById('modalImage') as HTMLImageElement;
const modalCaption = document.getElementById('modalCaption')!;
const modalClose = document.getElementById('modalClose')!;

// Params
const outputWidthInput = document.getElementById('outputWidth') as HTMLInputElement;
const outputWidthValue = document.getElementById('outputWidthValue')!;
const printDPISelect = document.getElementById('printDPI') as HTMLSelectElement;
const colorModeSelect = document.getElementById('colorMode') as HTMLSelectElement;
const contrastInput = document.getElementById('contrast') as HTMLInputElement;
const thresholdInput = document.getElementById('threshold') as HTMLInputElement;
const ditherModeSelect = document.getElementById('ditherMode') as HTMLSelectElement;
const contrastValue = document.getElementById('contrastValue')!;
const thresholdValue = document.getElementById('thresholdValue')!;
const outputInfoText = document.getElementById('outputInfoText')!;

function log(msg: string, type: 'info'|'success'|'error'|'warning'|'progress' = 'info') {
  const div = document.createElement('div');
  div.className = `log-entry ${type}`;
  const ts = new Date().toLocaleTimeString('zh-TW');
  div.textContent = `[${ts}] ${msg}`;
  logBox.appendChild(div);
  logBox.scrollTop = logBox.scrollHeight;
}

clearLogBtn.addEventListener('click', () => { logBox.innerHTML=''; log('日誌已清除'); });

// File handling
uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('dragover'); });
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
uploadArea.addEventListener('drop', e => { e.preventDefault(); uploadArea.classList.remove('dragover'); handleFiles(e.dataTransfer!.files); });
fileInput.addEventListener('change', () => handleFiles(fileInput.files!));

async function handleFiles(fileListInput: FileList) {
  state.files = Array.from(fileListInput);
  fileList.innerHTML = '';
  imagePreviewGrid.innerHTML = '';
  state.jobs = [];
  for (let i = 0; i < state.files.length; i++) {
    const f = state.files[i];
    const item = document.createElement('div');
    item.className = 'file-item';
    const sizeMB = (f.size / 1024 / 1024).toFixed(2);
    item.innerHTML = `<div class="file-info"><div class="file-name">${f.name}</div><div class="file-size">${sizeMB} MB</div></div>`;
    fileList.appendChild(item);
    try {
      const url = await fileToDataURL(f);
      const img = await dataURLToImage(url);
      const prev = document.createElement('div');
      prev.className = 'image-preview-item';
      prev.innerHTML = `<img src="${url}" alt="preview"><div class="preview-label">${f.name}</div>`;
      imagePreviewGrid.appendChild(prev);
      state.jobs.push({ id: `${i}`, dataURL: url, width: img.naturalWidth, height: img.naturalHeight });
    } catch (err) {
      log(`載入失敗: ${f.name}`, 'warning');
    }
  }
  if (state.jobs.length) {
    imagePreviewSection.style.display = 'block';
    processBtn.disabled = false;
    log(`已準備 ${state.jobs.length} 個圖片`, 'success');
    updateOutputInfo();
  } else {
    imagePreviewSection.style.display = 'none';
    processBtn.disabled = true;
  }
}

function dataURLToImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img); img.onerror = reject; img.src = url;
  });
}

// Param updates
function bindRange(input: HTMLInputElement, display: HTMLElement) {
  const update = () => {
    display.textContent = input.value;
    if (input === outputWidthInput) {
      outputWidthValue.textContent = `${input.value} cm`;
      updateOutputInfo();
    }
  };
  input.addEventListener('input', update); update();
}
bindRange(contrastInput, contrastValue);
bindRange(thresholdInput, thresholdValue);
bindRange(outputWidthInput, outputWidthValue);

// 更新輸出資訊
function updateOutputInfo() {
  if (!state.jobs.length) {
    outputInfoText.textContent = `寬 ${outputWidthInput.value}cm × 高 ? cm，約 ? × ? pixels @ ${printDPISelect.value} DPI`;
    return;
  }
  const widthCm = parseFloat(outputWidthInput.value);
  const dpi = parseInt(printDPISelect.value, 10);
  const widthPx = Math.round(widthCm / 2.54 * dpi);
  const job = state.jobs[0];
  const aspectRatio = job.height / job.width;
  const heightPx = Math.round(widthPx * aspectRatio);
  const heightCm = (heightPx / dpi * 2.54).toFixed(1);
  outputInfoText.textContent = `寬 ${widthCm}cm × 高 ${heightCm}cm，約 ${widthPx} × ${heightPx} pixels @ ${dpi} DPI`;
}

outputWidthInput.addEventListener('input', updateOutputInfo);
printDPISelect.addEventListener('change', updateOutputInfo);
colorModeSelect.addEventListener('change', () => {
  // 隱藏/顯示半色調參數
  const halftoneParams = document.querySelectorAll('.params-grid')[1] as HTMLElement;
  if (colorModeSelect.value === 'color') {
    halftoneParams.style.opacity = '0.5';
    halftoneParams.style.pointerEvents = 'none';
  } else {
    halftoneParams.style.opacity = '1';
    halftoneParams.style.pointerEvents = 'auto';
  }
});

function collectOptions(): HalftoneOptions {
  return {
    contrast: parseFloat(contrastInput.value),
    threshold: parseInt(thresholdInput.value, 10),
    mode: ditherModeSelect.value as 'floyd' | 'binary',
    colorMode: colorModeSelect.value as 'bw' | 'gray' | 'color',
    outputWidthCm: parseFloat(outputWidthInput.value),
    printDPI: parseInt(printDPISelect.value, 10),
  };
}

// Processing
processBtn.addEventListener('click', () => startProcessing());

function startProcessing() {
  if (!state.jobs.length) { log('沒有圖片可處理', 'warning'); return; }
  if (state.processing) return;
  state.processing = true;
  processBtn.disabled = true;
  progressFill.setAttribute('style', 'width:0%');
  progressText.textContent = '開始處理...';
  log('🚀 開始半色調轉換', 'progress');
  state.results = []; state.selected.clear();
  outputPreviewGrid.innerHTML = ''; outputPreviewSection.style.display = 'none';
  initWorker();
  const options = collectOptions();
  const req: WorkerProcessRequest = { type: 'PROCESS_BATCH', jobs: state.jobs, options };
  state.worker!.postMessage(req);
}

function initWorker() {
  if (state.worker) return; // reuse
  state.worker = new Worker(new URL('./worker/halftoneWorker.ts', import.meta.url), { type: 'module' });
  state.worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
    if (e.data.type === 'PROGRESS') {
      const { current, total } = e.data;
      const pct = Math.round(current / total * 100);
      progressFill.setAttribute('style', `width:${pct}%`);
      progressText.textContent = `進度: ${pct}% (${current}/${total})`;
    } else if (e.data.type === 'RESULT') {
      const { results, durationMs } = e.data;
      log(`✅ 完成，耗時 ${(durationMs/1000).toFixed(2)}s`, 'success');
      state.results = results;
      renderResults(results);
      state.processing = false;
      processBtn.disabled = false;
      downloadSelectedBtn.style.display = 'inline-block';
      downloadAllZipBtn.style.display = 'inline-block';
    }
  };
}

function renderResults(results: HalftoneResult[]) {
  outputPreviewGrid.innerHTML = '';
  const widthCm = parseFloat(outputWidthInput.value);
  const dpi = parseInt(printDPISelect.value, 10);
  results.forEach(r => {
    const div = document.createElement('div');
    div.className = 'output-preview-item';
    const heightCm = (r.height / dpi * 2.54).toFixed(1);
    div.innerHTML = `<img src="${r.halftone}" alt="halftone"><div class="preview-label">${r.width}×${r.height}px (${widthCm}×${heightCm}cm)</div>`;
    div.addEventListener('click', () => {
      modalImage.src = r.halftone;
      modalCaption.textContent = `尺寸: ${r.width}×${r.height}px (${widthCm}×${heightCm}cm @ ${dpi} DPI)`;
      previewModal.setAttribute('style','display:flex');
    });
    div.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      toggleSelect(r.id, div);
    });
    outputPreviewGrid.appendChild(div);
  });
  outputPreviewSection.style.display = 'block';
  log('預覽已生成 (右鍵選取圖片)', 'info');
}

function toggleSelect(id: string, el: HTMLElement) {
  if (state.selected.has(id)) {
    state.selected.delete(id);
    el.style.outline = '';
  } else {
    state.selected.add(id);
    el.style.outline = '3px solid var(--accent-color)';
  }
  log(`選取數: ${state.selected.size}`, 'progress');
}

// Download buttons
downloadSelectedBtn.addEventListener('click', () => {
  if (!state.selected.size) { log('未選取任何圖片 (右鍵圖片以選取)', 'warning'); return; }
  let idx = 1;
  state.results.forEach(r => {
    if (state.selected.has(r.id)) {
      downloadDataURL(r.halftone, `halftone_${idx}_${r.width}x${r.height}.png`);
      idx++;
    }
  });
  log(`已下載 ${state.selected.size} 個圖片`, 'success');
});

downloadAllZipBtn.addEventListener('click', () => {
  if (!state.results.length) { log('沒有結果可打包', 'warning'); return; }
  downloadAllZip(state.results);
  log('ZIP 打包下載觸發', 'success');
});

// Modal handlers
modalClose.addEventListener('click', () => previewModal.setAttribute('style','display:none'));
previewModal.addEventListener('click', (e) => { if (e.target === previewModal) previewModal.setAttribute('style','display:none'); });

document.addEventListener('keydown', e => { if (e.key === 'Escape' && previewModal.style.display === 'flex') previewModal.setAttribute('style','display:none'); });

// Init log
log('應用已就緒 - 請選擇圖片檔案', 'success');

export {};