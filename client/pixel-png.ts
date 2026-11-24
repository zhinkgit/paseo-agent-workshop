// Pure-TypeScript crisp RGBA PNG data-URI encoder with LRU cache.
// Zero external dependencies; renders razor-sharp pixel art across Desktop, Web, iOS, and Android.

export interface PixelBitmap {
  key: string;
  width: number;
  height: number;
  /** ASCII rows where each char maps to a hex color in palette, or '.' / ' ' for transparent. */
  rows: readonly string[];
}

export type ColorMap = Readonly<Record<string, string>>;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ (bytes[i] ?? 0)) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < bytes.length; i++) {
    a = (a + (bytes[i] ?? 0)) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function writeU32(out: Uint8Array, offset: number, value: number) {
  out[offset] = (value >>> 24) & 0xff;
  out[offset + 1] = (value >>> 16) & 0xff;
  out[offset + 2] = (value >>> 8) & 0xff;
  out[offset + 3] = value & 0xff;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  writeU32(out, 0, data.length);
  out[4] = type.charCodeAt(0);
  out[5] = type.charCodeAt(1);
  out[6] = type.charCodeAt(2);
  out[7] = type.charCodeAt(3);
  out.set(data, 8);
  const crcInput = out.subarray(4, 8 + data.length);
  writeU32(out, 8 + data.length, crc32(crcInput));
  return out;
}

/** Wrap raw bytes in an uncompressed zlib stream (stored blocks, max 65535 bytes per block). */
function zlibStore(raw: Uint8Array): Uint8Array {
  const maxBlock = 65535;
  const blocks = Math.max(1, Math.ceil(raw.length / maxBlock));
  const out = new Uint8Array(2 + raw.length + blocks * 5 + 4);
  out[0] = 0x78;
  out[1] = 0x01;
  let dst = 2;
  let src = 0;
  for (let b = 0; b < blocks; b++) {
    const len = Math.min(maxBlock, raw.length - src);
    const isFinal = b === blocks - 1 ? 1 : 0;
    out[dst++] = isFinal;
    out[dst++] = len & 0xff;
    out[dst++] = (len >>> 8) & 0xff;
    const nlen = (~len) & 0xffff;
    out[dst++] = nlen & 0xff;
    out[dst++] = (nlen >>> 8) & 0xff;
    out.set(raw.subarray(src, src + len), dst);
    dst += len;
    src += len;
  }
  writeU32(out, dst, adler32(raw));
  return out;
}

function parseHex(hex: string): [number, number, number, number] {
  const clean = hex.startsWith("#") ? hex.slice(1) : hex;
  if (clean.length === 3) {
    const r = parseInt(clean[0]! + clean[0]!, 16);
    const g = parseInt(clean[1]! + clean[1]!, 16);
    const b = parseInt(clean[2]! + clean[2]!, 16);
    return [r, g, b, 255];
  }
  if (clean.length === 6) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
      255,
    ];
  }
  if (clean.length === 8) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
      parseInt(clean.slice(6, 8), 16),
    ];
  }
  return [0, 0, 0, 0];
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function toBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1] ?? 0;
    const b2 = bytes[i + 2] ?? 0;
    const n = (b0 << 16) | (b1 << 8) | b2;
    out += B64[(n >>> 18) & 63];
    out += B64[(n >>> 12) & 63];
    out += i + 1 < bytes.length ? B64[(n >>> 6) & 63] : "=";
    out += i + 2 < bytes.length ? B64[n & 63] : "=";
  }
  return out;
}

const URI_CACHE = new Map<string, string>();
const MAX_CACHE_ENTRIES = 768;

export function encodePixelPng(
  bitmap: PixelBitmap,
  colors: ColorMap,
  pixelScale: number,
  paletteKey: string,
): string {
  const scale = Math.max(1, Math.round(pixelScale));
  const cacheKey = `${bitmap.key}|${paletteKey}|${scale}`;
  const cached = URI_CACHE.get(cacheKey);
  if (cached) return cached;

  const rgbaByChar = new Map<string, [number, number, number, number]>();
  for (const [ch, hex] of Object.entries(colors)) {
    rgbaByChar.set(ch, parseHex(hex));
  }

  const width = bitmap.width * scale;
  const height = bitmap.height * scale;
  const stride = 1 + width * 4;
  const raw = new Uint8Array(stride * height);

  for (let y = 0; y < bitmap.height; y++) {
    const rowStr = bitmap.rows[y] ?? "";
    for (let x = 0; x < bitmap.width; x++) {
      const ch = rowStr[x] ?? ".";
      if (ch === "." || ch === " ") continue;
      const rgba = rgbaByChar.get(ch);
      if (!rgba || rgba[3] === 0) continue;
      for (let sy = 0; sy < scale; sy++) {
        const rowOffset = (y * scale + sy) * stride + 1;
        for (let sx = 0; sx < scale; sx++) {
          const idx = rowOffset + (x * scale + sx) * 4;
          raw[idx] = rgba[0];
          raw[idx + 1] = rgba[1];
          raw[idx + 2] = rgba[2];
          raw[idx + 3] = rgba[3];
        }
      }
    }
  }

  const ihdr = new Uint8Array(13);
  writeU32(ihdr, 0, width);
  writeU32(ihdr, 4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const cIhdr = pngChunk("IHDR", ihdr);
  const cIdat = pngChunk("IDAT", zlibStore(raw));
  const cIend = pngChunk("IEND", new Uint8Array(0));

  const png = new Uint8Array(sig.length + cIhdr.length + cIdat.length + cIend.length);
  let offset = 0;
  png.set(sig, offset);
  offset += sig.length;
  png.set(cIhdr, offset);
  offset += cIhdr.length;
  png.set(cIdat, offset);
  offset += cIdat.length;
  png.set(cIend, offset);

  const uri = `data:image/png;base64,${toBase64(png)}`;
  if (URI_CACHE.size >= MAX_CACHE_ENTRIES) {
    const oldest = URI_CACHE.keys().next().value;
    if (oldest) URI_CACHE.delete(oldest);
  }
  URI_CACHE.set(cacheKey, uri);
  return uri;
}
