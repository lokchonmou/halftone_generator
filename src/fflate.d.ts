// Simple type declaration for fflate
declare module 'fflate' {
  export function zipSync(data: Record<string, Uint8Array>, options?: { level?: number }): Uint8Array;
  export function strToU8(str: string): Uint8Array;
}
