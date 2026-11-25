// Clean, gallery-grade architectural studio-workshop room tilemap generator (Lobby-inspired).
// Renders crisp slate double-line walls, airy white tiled walkway, pastel-blue dotted work carpet,
// soft mint striped lounge rug, cozy sage sofa, craft counter, potted plant, and wooden doorway.
import type { PixelBitmap } from "./pixel-png.ts";

export interface RoomGeometry {
  width: number;
  height: number;
  cols: number;
  rows: number;
  loungeCapacity: number;
  stationOrigin: (index: number) => { x: number; y: number };
  chestPos: { x: number; y: number };
  loungeSpot: (index: number) => { x: number; y: number };
}

const BORDER = 3;
const WALL_H = 18;
const WALKWAY_W = 20; // Clean white tiled entrance strip on the left
const STATION_W = 42; // Tight side-by-side workbench + gear pod width
const STATION_H = 38;
const LOUNGE_H = 34; // Cozy sofa + craft counter lounge strip at bottom

export function computeRoomGeometry(stationCount: number, maxCols: number): RoomGeometry {
  const count = Math.max(1, stationCount);
  const cols = Math.max(2, Math.min(maxCols, count));
  const rows = Math.max(1, Math.ceil(count / cols));

  const workW = cols * STATION_W + 14;
  const width = BORDER * 2 + WALKWAY_W + workW;
  const height = BORDER + WALL_H + rows * STATION_H + LOUNGE_H + BORDER;

  const loungeCapacity = Math.max(1, Math.floor((workW - 28) / 18));

  return {
    width,
    height,
    cols,
    rows,
    loungeCapacity,
    stationOrigin(index: number) {
      const col = index % cols;
      const row = Math.floor(index / cols);
      return {
        x: BORDER + WALKWAY_W + 4 + col * STATION_W,
        y: WALL_H + 4 + row * STATION_H,
      };
    },
    chestPos: {
      x: width - BORDER - 16,
      y: height - BORDER - 22,
    },
    loungeSpot(index: number) {
      const startX = BORDER + WALKWAY_W + 10;
      const spacing = 18;
      const slot = index % loungeCapacity;
      return {
        x: startX + slot * spacing,
        y: height - BORDER - 20,
      };
    },
  };
}

const BACKDROP_CACHE = new Map<string, PixelBitmap>();

export function buildWorkshopBackdrop(geom: RoomGeometry): PixelBitmap {
  const key = `studio-bg-${geom.width}x${geom.height}`;
  const cached = BACKDROP_CACHE.get(key);
  if (cached) return cached;

  const { width, height } = geom;
  const grid: string[][] = Array.from({ length: height }, () => Array<string>(width).fill("f"));

  const set = (x: number, y: number, ch: string) => {
    if (x >= 0 && x < width && y >= 0 && y < height) grid[y]![x] = ch;
  };
  const fillRect = (x0: number, y0: number, w: number, h: number, ch: string) => {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) set(x, y, ch);
    }
  };
  const strokeRect = (x0: number, y0: number, w: number, h: number, ch: string) => {
    for (let x = x0; x < x0 + w; x++) {
      set(x, y0, ch);
      set(x, y0 + h - 1, ch);
    }
    for (let y = y0; y < y0 + h; y++) {
      set(x0, y, ch);
      set(x0 + w - 1, y, ch);
    }
  };

  const loungeTop = height - BORDER - LOUNGE_H;
  const workLeft = BORDER + WALKWAY_W;

  // 1. Clean airy white/off-white studio tile walkway (left strip + margins)
  for (let y = WALL_H; y < height - BORDER; y++) {
    for (let x = BORDER; x < width - BORDER; x++) {
      const seam = (x - BORDER) % 12 === 0 || (y - WALL_H) % 12 === 0;
      set(x, y, seam ? "z" : "f");
    }
  }

  // 2. Soft pastel-blue dotted carpet under the workbench area
  for (let y = WALL_H; y < loungeTop; y++) {
    for (let x = workLeft; x < width - BORDER; x++) {
      const dot = (x + y) % 4 === 0 && y % 2 === 0;
      set(x, y, dot ? "K" : "k");
    }
  }

  // 3. Soft mint-sage diagonal-stripe lounge rug (bottom-right lounge zone)
  const rugX = workLeft + 26;
  const rugW = Math.max(28, width - BORDER - rugX - 20);
  const rugY = loungeTop + 12;
  const rugH = LOUNGE_H - 13;
  for (let y = rugY; y < rugY + rugH; y++) {
    for (let x = rugX; x < rugX + rugW; x++) {
      set(x, y, (x + y) % 4 < 2 ? "u" : "U");
    }
  }

  // 4. Subtle checkerboard pantry/craft tiles (bottom-left of lounge)
  for (let y = loungeTop + 10; y < height - BORDER; y++) {
    for (let x = workLeft; x < Math.min(rugX, width - BORDER); x++) {
      const check = ((Math.floor((x - workLeft) / 6) + Math.floor((y - loungeTop) / 6)) & 1) === 0;
      set(x, y, check ? "F" : "z");
    }
  }

  // 5. Top architectural plaster wall with subtle panel seams & baseboard
  fillRect(BORDER, BORDER, width - BORDER * 2, WALL_H - BORDER, "n");
  for (let x = BORDER + 16; x < width - BORDER; x += 24) {
    for (let y = BORDER; y < WALL_H - 2; y++) set(x, y, "N");
  }
  fillRect(BORDER, WALL_H - 3, width - BORDER * 2, 2, "N");
  fillRect(BORDER, WALL_H - 1, width - BORDER * 2, 1, "o");

  // 6. Cozy wooden doorway + welcome mat on top-left wall
  const doorX = BORDER + 4;
  fillRect(doorX, BORDER + 2, 12, WALL_H - BORDER - 2, "o");
  fillRect(doorX + 1, BORDER + 3, 10, WALL_H - BORDER - 3, "w");
  fillRect(doorX + 2, BORDER + 4, 8, WALL_H - BORDER - 5, "W");
  set(doorX + 9, BORDER + 9, "b");
  // Warm welcome mat below doorway
  fillRect(doorX + 1, WALL_H + 3, 10, 5, "t");
  strokeRect(doorX + 1, WALL_H + 3, 10, 5, "T");

  // 7. Lounge furniture: cozy sage sofa + warm coffee table + potted plant + oak craft counter
  // Oak craft counter on left side of lounge
  const counterX = workLeft + 2;
  const counterY = loungeTop + 2;
  if (width > 120) {
    fillRect(counterX, counterY, 18, 9, "W");
    fillRect(counterX + 1, counterY + 1, 16, 4, "w");
    strokeRect(counterX, counterY, 18, 9, "o");
    // Tiny brass kettle / craft box on counter
    fillRect(counterX + 4, counterY - 2, 5, 4, "m");
    strokeRect(counterX + 4, counterY - 2, 5, 4, "o");
    set(counterX + 6, counterY - 1, "g");
  }

  // Potted pixel plant beside sofa
  const plantX = rugX - 9;
  const plantY = loungeTop + 1;
  if (plantX > workLeft + 18) {
    fillRect(plantX + 1, plantY + 5, 5, 4, "t");
    strokeRect(plantX + 1, plantY + 5, 5, 4, "o");
    fillRect(plantX, plantY + 1, 7, 4, "l");
    set(plantX + 2, plantY, "l");
    set(plantX + 4, plantY, "l");
    set(plantX + 1, plantY + 3, "L");
    set(plantX + 5, plantY + 3, "L");
  }

  // Cozy sage sofa centered on the mint rug
  const sofaW = Math.min(28, Math.max(18, rugW - 10));
  const sofaX = rugX + Math.floor((rugW - sofaW) / 2);
  const sofaY = loungeTop + 1;
  fillRect(sofaX, sofaY, sofaW, 10, "s");
  fillRect(sofaX + 1, sofaY + 5, sofaW - 2, 4, "S");
  strokeRect(sofaX, sofaY, sofaW, 10, "o");
  // Armrests
  fillRect(sofaX, sofaY + 2, 3, 8, "S");
  fillRect(sofaX + sofaW - 3, sofaY + 2, 3, 8, "S");
  strokeRect(sofaX, sofaY + 2, 3, 8, "o");
  strokeRect(sofaX + sofaW - 3, sofaY + 2, 3, 8, "o");

  // Warm wooden coffee table in front of the sofa
  const tblW = Math.max(12, sofaW - 8);
  const tblX = sofaX + Math.floor((sofaW - tblW) / 2);
  const tblY = sofaY + 13;
  fillRect(tblX, tblY, tblW, 8, "t");
  strokeRect(tblX, tblY, tblW, 8, "T");
  strokeRect(tblX - 1, tblY - 1, tblW + 2, 10, "o");

  // 8. Crisp architectural slate double-line room border
  fillRect(0, 0, width, BORDER, "v");
  fillRect(0, height - BORDER, width, BORDER, "v");
  fillRect(0, 0, BORDER, height, "v");
  fillRect(width - BORDER, 0, BORDER, height, "v");
  strokeRect(0, 0, width, height, "o");
  strokeRect(1, 1, width - 2, height - 2, "h");
  strokeRect(BORDER - 1, BORDER - 1, width - (BORDER - 1) * 2, height - (BORDER - 1) * 2, "o");

  const bitmap: PixelBitmap = {
    key,
    width,
    height,
    rows: grid.map((row) => row.join("")),
  };
  BACKDROP_CACHE.set(key, bitmap);
  return bitmap;
}
