import { zipSync, strToU8 } from 'fflate';
import { HalftoneResult } from './types';

export function buildZip(results: HalftoneResult[]): Blob {
  const files: Record<string, Uint8Array> = {};
  results.forEach((r, idx) => {
    // dataURL to binary
    const base64 = r.halftone.split(',')[1];
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    const filename = `halftone_${idx + 1}_${r.width}x${r.height}.png`;
    files[filename] = bytes;
  });
  const zipped = zipSync(files, { level: 6 });
  return new Blob([zipped], { type: 'application/zip' });
}
