// Utility to embed or update PNG DPI (pHYs chunk) so Word/Office respects physical size
// Reference: PNG spec (pHYs chunk) - pixels per unit, unit = meter (1)
// If a pHYs chunk already exists, we leave it unchanged for simplicity.

function crc32(buf: Uint8Array): number {
  let table = crc32.table;
  if (!table) {
    table = new Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c >>> 0;
    }
    crc32.table = table;
  }
  let crc = 0 ^ -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ -1) >>> 0;
}
crc32.table = undefined as any;

export async function setPNGdpiBlob(blob: Blob, dpi: number): Promise<Blob> {
  const ab = await blob.arrayBuffer();
  const bytes = new Uint8Array(ab);
  // PNG signature
  const signature = [137,80,78,71,13,10,26,10];
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== signature[i]) {
      // Not PNG, return original
      return blob;
    }
  }
  // Scan for existing pHYs
  let offset = 8;
  let hasPhys = false;
  while (offset + 8 < bytes.length) {
    const length = (bytes[offset] << 24) | (bytes[offset+1] << 16) | (bytes[offset+2] << 8) | bytes[offset+3];
    const type = String.fromCharCode(bytes[offset+4], bytes[offset+5], bytes[offset+6], bytes[offset+7]);
    if (type === 'pHYs') { hasPhys = true; break; }
    // IHDR must be first chunk; after we pass it we can decide insertion point.
    offset += 8 + length + 4; // chunk total = len(4)+type(4)+data(length)+crc(4)
    if (type === 'IEND') break; // end
  }
  if (hasPhys) {
    // Already has DPI/phys info, keep original
    return blob;
  }
  // Need to insert after IHDR chunk.
  // Find end of IHDR: after signature, IHDR chunk length always 13.
  const ihdrLength = (bytes[8] << 24) | (bytes[9] << 16) | (bytes[10] << 8) | bytes[11];
  const ihdrEnd = 8 + 8 + ihdrLength + 4; // signature + chunk(header+data+crc)
  // Compute pixels per meter
  const ppm = Math.round(dpi / 0.0254); // dpi * 39.37007874
  const physData = new Uint8Array(9);
  // X axis ppm
  physData[0] = (ppm >>> 24) & 0xFF;
  physData[1] = (ppm >>> 16) & 0xFF;
  physData[2] = (ppm >>> 8) & 0xFF;
  physData[3] = (ppm) & 0xFF;
  // Y axis ppm (same)
  physData[4] = physData[0];
  physData[5] = physData[1];
  physData[6] = physData[2];
  physData[7] = physData[3];
  // Unit specifier: 1 = meter
  physData[8] = 1;
  const typeBytes = new Uint8Array([112,72,89,115]); // 'pHYs'
  const crcInput = new Uint8Array(typeBytes.length + physData.length);
  crcInput.set(typeBytes, 0);
  crcInput.set(physData, typeBytes.length);
  const crcVal = crc32(crcInput);
  const crcBytes = new Uint8Array([
    (crcVal >>> 24) & 0xFF,
    (crcVal >>> 16) & 0xFF,
    (crcVal >>> 8) & 0xFF,
    (crcVal) & 0xFF
  ]);
  const lengthBytes = new Uint8Array([0,0,0,9]);
  // Build new file bytes
  const before = bytes.slice(0, ihdrEnd);
  const after = bytes.slice(ihdrEnd);
  const newSize = before.length + 4 + 4 + 9 + 4 + after.length;
  const out = new Uint8Array(newSize);
  let p = 0;
  out.set(before, p); p += before.length;
  out.set(lengthBytes, p); p += 4;
  out.set(typeBytes, p); p += 4;
  out.set(physData, p); p += 9;
  out.set(crcBytes, p); p += 4;
  out.set(after, p);
  return new Blob([out], { type: 'image/png' });
}

export async function setPNGdpiDataURL(dataURL: string, dpi: number): Promise<string> {
  // decode base64, then embed, then re-encode
  const resp = await fetch(dataURL);
  const blob = await resp.blob();
  const outBlob = await setPNGdpiBlob(blob, dpi);
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(outBlob);
  });
}
