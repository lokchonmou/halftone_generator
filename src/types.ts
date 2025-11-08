export interface HalftoneOptions {
  contrast: number; // 0.8 - 2.0
  threshold: number; // 64 - 192
  mode: 'floyd' | 'binary';
  colorMode: 'bw' | 'gray' | 'color';
  outputWidthCm: number; // 輸出寬度 (公分)
  printDPI: number; // 影印機解析度
}

export interface ProcessJob {
  id: string;
  dataURL: string; // original image data URL
  width: number;
  height: number;
}

export interface WorkerProcessRequest {
  type: 'PROCESS_BATCH';
  jobs: ProcessJob[];
  options: HalftoneOptions;
}

export interface WorkerProgressMessage {
  type: 'PROGRESS';
  current: number;
  total: number;
}

export interface WorkerResultMessage {
  type: 'RESULT';
  results: HalftoneResult[];
  durationMs: number;
}

export interface HalftoneResult {
  id: string;
  original: string; // original dataURL
  halftone: string; // processed dataURL
  width: number;
  height: number;
}

export type WorkerMessage = WorkerProgressMessage | WorkerResultMessage;
