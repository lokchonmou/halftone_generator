// Floyd-Steinberg Dithering - 完全按照 Python 版本邏輯
// 用於將彩色圖片轉換為黑白半色調，適合影印機使用
// 參考: halftone_generator.py

import { HalftoneOptions } from '../types';

/**
 * 轉換 RGBA 為灰階
 * 使用標準亮度公式: 0.299*R + 0.587*G + 0.114*B
 */
function toGrayscale(data: Uint8ClampedArray): Float64Array {
  const pixels = data.length / 4;
  const gray = new Float64Array(pixels);
  for (let i = 0; i < pixels; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return gray;
}

/**
 * 增強對比度 - 對應 Python 的 ImageEnhance.Contrast
 * contrast = 1.0 無變化
 * contrast > 1.0 增強對比度
 * contrast < 1.0 降低對比度
 */
function applyContrast(gray: Float64Array, contrast: number): void {
  for (let i = 0; i < gray.length; i++) {
    const v = gray[i];
    const adjusted = (v - 128) * contrast + 128;
    gray[i] = Math.max(0, Math.min(255, adjusted));
  }
}

/**
 * Floyd-Steinberg Dithering - 完全按照 Python 版本
 * 將灰階圖片轉換為黑白點陣，通過誤差擴散模擬灰階效果
 * 適合影印機使用，避免大片黑色
 */
function floydSteinberg(gray: Float64Array, width: number, height: number, threshold: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const oldPixel = gray[idx];
      
      // 量化為黑白 (閾值判斷)
      const newPixel = oldPixel > threshold ? 255 : 0;
      out[idx] = newPixel;
      
      // 計算量化誤差
      const quantError = oldPixel - newPixel;
      
      // 將誤差分散到鄰近像素 (Floyd-Steinberg 權重)
      if (x + 1 < width) {
        gray[idx + 1] += quantError * 7 / 16;
      }
      
      if (y + 1 < height) {
        if (x > 0) {
          gray[idx + width - 1] += quantError * 3 / 16;
        }
        gray[idx + width] += quantError * 5 / 16;
        if (x + 1 < width) {
          gray[idx + width + 1] += quantError * 1 / 16;
        }
      }
    }
  }
  
  return out;
}

/**
 * 簡單閾值二值化 (不使用誤差擴散)
 */
function binaryThreshold(gray: Float64Array, threshold: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(gray.length);
  for (let i = 0; i < gray.length; i++) {
    out[i] = gray[i] > threshold ? 255 : 0;
  }
  return out;
}

/**
 * 將黑白陣列轉換為 RGBA 格式
 */
function toRGBA(bw: Uint8ClampedArray): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(bw.length * 4);
  for (let i = 0; i < bw.length; i++) {
    const v = bw[i];
    rgba[i * 4] = v;
    rgba[i * 4 + 1] = v;
    rgba[i * 4 + 2] = v;
    rgba[i * 4 + 3] = 255;
  }
  return rgba;
}

/**
 * 主處理函數 - 支援黑白/灰階/彩色
 * 
 * @param rgba - 原始 RGBA 像素資料
 * @param width - 圖片寬度
 * @param height - 圖片高度  
 * @param options - 處理選項
 * @returns 處理後的 RGBA 資料
 */
export function halftoneProcess(
  rgba: Uint8ClampedArray, 
  width: number, 
  height: number, 
  options: HalftoneOptions
): Uint8ClampedArray {
  // 彩色模式：直接返回原圖
  if (options.colorMode === 'color') {
    return rgba;
  }
  
  // 1. 轉灰階
  const gray = toGrayscale(rgba);
  
  // 2. 增強對比度
  applyContrast(gray, options.contrast);
  
  // 灰階模式：直接返回灰階（不 dither）
  if (options.colorMode === 'gray') {
    const result = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < gray.length; i++) {
      const v = Math.round(gray[i]);
      result[i * 4] = v;
      result[i * 4 + 1] = v;
      result[i * 4 + 2] = v;
      result[i * 4 + 3] = 255;
    }
    return result;
  }
  
  // 黑白模式：Floyd-Steinberg dithering 或簡單閾值
  let bw: Uint8ClampedArray;
  if (options.mode === 'floyd') {
    bw = floydSteinberg(gray, width, height, options.threshold);
  } else {
    bw = binaryThreshold(gray, options.threshold);
  }
  
  return toRGBA(bw);
}
