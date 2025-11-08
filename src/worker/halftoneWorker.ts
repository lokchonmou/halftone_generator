import { halftoneProcess } from '../algorithms/floydSteinberg';
import { HalftoneOptions, WorkerProcessRequest, WorkerResultMessage, WorkerProgressMessage, HalftoneResult } from '../types';
import { setPNGdpiBlob } from '../utils/pngDpi';

// Worker context
const ctx: Worker = self as any;

ctx.onmessage = async (e: MessageEvent<WorkerProcessRequest>) => {
  const msg = e.data;
  if (msg.type === 'PROCESS_BATCH') {
    const start = performance.now();
    const results: HalftoneResult[] = [];
    const total = msg.jobs.length;
    for (let i = 0; i < msg.jobs.length; i++) {
      const job = msg.jobs[i];
      try {
        const imageData = await dataURLToImageData(job.dataURL);
        
          console.log(`[Worker] 原始尺寸: ${imageData.width}×${imageData.height}`);
        
        // 計算目標尺寸 (根據 DPI 和 cm 調整)
        const targetWidthPx = Math.round(msg.options.outputWidthCm / 2.54 * msg.options.printDPI);
        const aspectRatio = imageData.height / imageData.width;
        const targetHeightPx = Math.round(targetWidthPx * aspectRatio);
        
          console.log(`[Worker] 目標尺寸: ${targetWidthPx}×${targetHeightPx} (${msg.options.outputWidthCm}cm @ ${msg.options.printDPI} DPI)`);
        
        // 縮放圖片到目標尺寸
        const resized = resizeImage(imageData, targetWidthPx, targetHeightPx);
        
          console.log(`[Worker] 縮放後尺寸: ${resized.width}×${resized.height}`);
          console.log(`[Worker] colorMode: ${msg.options.colorMode}, mode: ${msg.options.mode}`);
        
        // 處理圖片 (半色調 / 灰階 / 彩色)
        const processed = halftoneProcess(resized.data, resized.width, resized.height, msg.options);
        
        // 輸出
        const c = new OffscreenCanvas(resized.width, resized.height);
        const context = c.getContext('2d');
        if (!context) throw new Error('No 2D context');
        
        const outImageData = new ImageData(new Uint8ClampedArray(processed), resized.width, resized.height);
        context.putImageData(outImageData, 0, 0);
        
        let outBlob: Blob;
        if (c.convertToBlob) {
          outBlob = await c.convertToBlob();
        } else {
          // Fallback path
          const dataURL = await canvasToDataURLFallback(outImageData);
          const resp = await fetch(dataURL);
          outBlob = await resp.blob();
        }
        // Embed DPI so Word respects physical size
        const dpiBlob = await setPNGdpiBlob(outBlob, msg.options.printDPI);
        const halftoneURL = await blobToDataURL(dpiBlob);
        results.push({ id: job.id, original: job.dataURL, halftone: halftoneURL, width: resized.width, height: resized.height });
      } catch (err) {
          console.error('[Worker] 處理失敗:', err);
        results.push({ id: job.id, original: job.dataURL, halftone: job.dataURL, width: job.width, height: job.height });
      }
      const progress: WorkerProgressMessage = { type: 'PROGRESS', current: i + 1, total };
      ctx.postMessage(progress);
    }
    const durationMs = performance.now() - start;
    const resultMsg: WorkerResultMessage = { type: 'RESULT', results, durationMs };
    ctx.postMessage(resultMsg);
  }
};

async function dataURLToImageData(dataURL: string): Promise<ImageData> {
  // 使用 fetch + createImageBitmap 於 Worker 內解碼圖片
  const resp = await fetch(dataURL);
  const blob = await resp.blob();
  if (typeof createImageBitmap === 'function') {
    const bmp = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot get 2D context');
    ctx.drawImage(bmp, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }
  // 理論上現代瀏覽器皆支援，否則拋出清晰錯誤
  throw new Error('createImageBitmap not supported in this environment');
}

function resizeImage(imageData: ImageData, targetWidth: number, targetHeight: number): ImageData {
  const srcCanvas = new OffscreenCanvas(imageData.width, imageData.height);
  const srcCtx = srcCanvas.getContext('2d');
  if (!srcCtx) throw new Error('No 2D context');
  srcCtx.putImageData(imageData, 0, 0);
  
  const dstCanvas = new OffscreenCanvas(targetWidth, targetHeight);
  const dstCtx = dstCanvas.getContext('2d');
  if (!dstCtx) throw new Error('No 2D context');
  dstCtx.drawImage(srcCanvas, 0, 0, targetWidth, targetHeight);
  
  return dstCtx.getImageData(0, 0, targetWidth, targetHeight);
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

async function canvasToDataURLFallback(imageData: ImageData): Promise<string> {
  // If OffscreenCanvas blob not supported, fallback (rare modern case)
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width; canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Missing 2D context');
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

export {};