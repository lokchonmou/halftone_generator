import { HalftoneResult } from './types';
import { buildZip } from './zip';

export function downloadDataURL(dataURL: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataURL; a.download = filename; a.click();
}

export function downloadAllZip(results: HalftoneResult[]) {
  const blob = buildZip(results);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `halftone_batch_${Date.now()}.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
