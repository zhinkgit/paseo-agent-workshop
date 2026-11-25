// Balanced 4-zone diegetic studio-workshop room tilemap generator:
// - Compact rooms (1-2 stations): Upper-left = Benches, Upper-right = Big Screen (zero empty void!),
//   Lower = Full-width spacious Lounge (sofa, table, plant, wide rug for 6+ resting agents) + Archive Cabinet.
// - Larger rooms (3+ stations): Upper = Full rows of Benches, Lower = Wide split (Big Screen + Spacious Lounge + Cabinet).
import type { PixelBitmap } from "./pixel-png.ts";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RoomGeometry {
  width: number;
  height: number;
  cols: number;
  rows: number;
  compactMode: boolean;
  loungeCapacity: number;
  doorPos: { x: number; y: number };
  signRect: Rect;
  gaugeRect: Rect;
  mailboxPos: { x: number; y: number };
  breakerPos: { x: number; y: number };
  bigScreenRect: Rect;
  chestPos: { x: number; y: number };
  stationOrigin: (index: number) => { x: number; y: number };
  loungeSpot: (index: number) => { x: number; y: number };
}

const BORDER = 3;
const WALL_H = 26;
const WALKWAY_W = 24; // Generous left prop aisle so Mailbox & Breaker never overlap
const STATION_W = 44;
const STATION_H = 38;

export function computeRoomGeometry(stationCount: number, maxCols: number): RoomGeometry {
  const count = Math.max(1, stationCount);
  const compactMode = count <= 2;

  if (compactMode) {
    // 1-2 agents: Upper-left = 1 col of 1-2 benches (or 1 bench), Upper-right = Big Screen!
    // Lower = Full-width spacious Lounge so ALL idle/ready agents rest comfortably with zero cramping.
    const cols = 1;
    const rows = count; // 1 or 2 rows on the left
    const benchAreaW = STATION_W + 10; // 54
    const bigScreenW = 104;
    const bigScreenH = 44;
    const innerW = benchAreaW + bigScreenW + 14; // 172
    const width = BORDER * 2 + WALKWAY_W + innerW; // 202

    const upperH = Math.max(rows * STATION_H + 8, bigScreenH + 14);
    const lowerH = 46;
    const height = WALL_H + upperH + lowerH + BORDER;

    const workLeft = BORDER + WALKWAY_W;
    const bigScreenX = workLeft + benchAreaW + 4;
    const bigScreenY = WALL_H + 6;

    const loungeLeft = workLeft + 4;
    const loungeUsableW = width - BORDER - 22 - loungeLeft;
    const loungeCols = Math.max(4, Math.floor(loungeUsableW / 18));
    const loungeCapacity = loungeCols * 2; // 2 cozy rows in the lounge -> 8+ resting spots!

    const gaugeW = 54;
    const signX = BORDER + 21;
    const signW = Math.max(64, width - BORDER - gaugeW - 4 - signX);

    return {
      width,
      height,
      cols,
      rows,
      compactMode: true,
      loungeCapacity,
      doorPos: { x: BORDER + 4, y: BORDER + 5 },
      signRect: { x: signX, y: BORDER + 3, w: signW, h: WALL_H - BORDER - 6 },
      gaugeRect: { x: width - BORDER - gaugeW - 2, y: BORDER + 4, w: gaugeW, h: WALL_H - BORDER - 8 },
      mailboxPos: { x: BORDER + 6, y: WALL_H + 10 },
      breakerPos: { x: BORDER + 6, y: WALL_H + 40 },
      bigScreenRect: { x: bigScreenX, y: bigScreenY, w: bigScreenW, h: bigScreenH },
      chestPos: { x: width - BORDER - 18, y: height - BORDER - 20 },
      stationOrigin(index: number) {
        return {
          x: workLeft + 4,
          y: WALL_H + 4 + index * STATION_H,
        };
      },
      loungeSpot(index: number) {
        const col = index % loungeCols;
        const row = Math.floor(index / loungeCols) % 2;
        return {
          x: loungeLeft + 4 + col * 18,
          y: WALL_H + upperH + 6 + row * 16,
        };
      },
    };
  }

  // 3+ agents: Upper = Full grid of workbenches, Lower = Generous 50/50 Big Screen + Spacious Lounge
  const cols = Math.max(2, Math.min(maxCols, count));
  const rows = Math.max(1, Math.ceil(count / cols));
  const innerW = Math.max(188, cols * STATION_W + 14);
  const width = BORDER * 2 + WALKWAY_W + innerW;
  const upperH = rows * STATION_H + 8;
  const lowerH = 58;
  const height = WALL_H + upperH + lowerH + BORDER;

  const workLeft = BORDER + WALKWAY_W;
  const bigScreenW = Math.min(108, Math.max(88, Math.floor(innerW * 0.48)));
  const bigScreenH = 44;
  const bigScreenX = workLeft + 2;
  const bigScreenY = WALL_H + upperH + 5;

  const loungeLeft = bigScreenX + bigScreenW + 6;
  const loungeUsableW = Math.max(54, width - BORDER - 22 - loungeLeft);
  const loungeCols = Math.max(3, Math.floor(loungeUsableW / 17));
  const loungeCapacity = loungeCols * 2; // 2 resting rows -> 6-10+ resting spots!

  const gaugeW = 54;
  const signX = BORDER + 21;
  const signW = Math.max(64, width - BORDER - gaugeW - 4 - signX);

  return {
    width,
    height,
    cols,
    rows,
    compactMode: false,
    loungeCapacity,
    doorPos: { x: BORDER + 4, y: BORDER + 5 },
    signRect: { x: signX, y: BORDER + 3, w: signW, h: WALL_H - BORDER - 6 },
    gaugeRect: { x: width - BORDER - gaugeW - 2, y: BORDER + 4, w: gaugeW, h: WALL_H - BORDER - 8 },
    mailboxPos: { x: BORDER + 6, y: WALL_H + 10 },
    breakerPos: { x: BORDER + 6, y: WALL_H + 40 },
    bigScreenRect: { x: bigScreenX, y: bigScreenY, w: bigScreenW, h: bigScreenH },
    chestPos: { x: width - BORDER - 18, y: height - BORDER - 20 },
    stationOrigin(index: number) {
      const col = index % cols;
      const row = Math.floor(index / cols);
      return {
        x: workLeft + 4 + col * STATION_W,
        y: WALL_H + 4 + row * STATION_H,
      };
    },
    loungeSpot(index: number) {
      const col = index % loungeCols;
      const row = Math.floor(index / loungeCols) % 2;
      return {
        x: loungeLeft + 2 + col * 17,
        y: WALL_H + upperH + 12 + row * 18,
      };
    },
  };
}

const BACKDROP_CACHE = new Map<string, PixelBitmap>();

export function buildWorkshopBackdrop(geom: RoomGeometry): PixelBitmap {
  const key = `balanced-bg-${geom.width}x${geom.height}-${geom.compactMode ? "c" : "w"}`;
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

  const workLeft = BORDER + WALKWAY_W;
  const lowerH = geom.compactMode ? 46 : 58;
  const lowerTop = height - BORDER - lowerH;

  // 1. Crisp white studio tile walkway
  for (let y = WALL_H; y < height - BORDER; y++) {
    for (let x = BORDER; x < width - BORDER; x++) {
      const seam = (x - BORDER) % 12 === 0 || (y - WALL_H) % 12 === 0;
      set(x, y, seam ? "z" : "f");
    }
  }

  // 2. Soft pastel-blue dotted carpet under the workbench area
  const carpetRight = geom.compactMode ? geom.bigScreenRect.x - 3 : width - BORDER;
  for (let y = WALL_H; y < lowerTop; y++) {
    for (let x = workLeft; x < carpetRight; x++) {
      const dot = (x + y) % 4 === 0 && y % 2 === 0;
      set(x, y, dot ? "K" : "k");
    }
  }

  // 3. Soft mint-sage diagonal-stripe lounge rug
  const rugX = geom.compactMode ? workLeft + 4 : geom.bigScreenRect.x + geom.bigScreenRect.w + 4;
  const rugW = Math.max(36, width - BORDER - rugX - 22);
  const rugY = lowerTop + 6;
  const rugH = lowerH - 10;
  for (let y = rugY; y < rugY + rugH; y++) {
    for (let x = rugX; x < rugX + rugW; x++) {
      set(x, y, (x + y) % 4 < 2 ? "u" : "U");
    }
  }

  // 4. Top architectural plaster wall
  fillRect(BORDER, BORDER, width - BORDER * 2, WALL_H - BORDER, "n");
  for (let x = BORDER + 20; x < width - BORDER; x += 28) {
    for (let y = BORDER; y < WALL_H - 2; y++) set(x, y, "N");
  }
  fillRect(BORDER, WALL_H - 3, width - BORDER * 2, 2, "N");
  fillRect(BORDER, WALL_H - 1, width - BORDER * 2, 1, "o");

  // 5. Welcome mat beneath door
  fillRect(geom.doorPos.x + 1, WALL_H + 2, 12, 4, "t");
  strokeRect(geom.doorPos.x + 1, WALL_H + 2, 12, 4, "T");

  // 6. Big Screen stand legs & shadow
  const bs = geom.bigScreenRect;
  fillRect(bs.x + 10, bs.y + bs.h, 6, 4, "j");
  fillRect(bs.x + bs.w - 16, bs.y + bs.h, 6, 4, "j");
  fillRect(bs.x + 4, bs.y + bs.h + 3, bs.w - 8, 2, "q");

  // 7. Cozy sage sofa + coffee table + potted plant nicely centered in the lounge
  if (rugW >= 32) {
    const sofaW = Math.min(30, Math.max(20, Math.floor(rugW * 0.42)));
    const sofaX = rugX + Math.floor((rugW - sofaW) / 2);
    const sofaY = rugY + 2;
    fillRect(sofaX, sofaY, sofaW, 10, "s");
    fillRect(sofaX + 1, sofaY + 5, sofaW - 2, 4, "S");
    strokeRect(sofaX, sofaY, sofaW, 10, "o");
    fillRect(sofaX, sofaY + 2, 3, 8, "S");
    fillRect(sofaX + sofaW - 3, sofaY + 2, 3, 8, "S");
    strokeRect(sofaX, sofaY + 2, 3, 8, "o");
    strokeRect(sofaX + sofaW - 3, sofaY + 2, 3, 8, "o");

    const tblW = Math.max(12, sofaW - 8);
    const tblX = sofaX + Math.floor((sofaW - tblW) / 2);
    const tblY = sofaY + 13;
    fillRect(tblX, tblY, tblW, 8, "t");
    strokeRect(tblX, tblY, tblW, 8, "T");
    strokeRect(tblX - 1, tblY - 1, tblW + 2, 10, "o");
  }

  // Potted plant tucked cleanly near bottom-right above the cabinet
  const plantX = width - BORDER - 11;
  const plantY = lowerTop + 2;
  fillRect(plantX + 1, plantY + 5, 5, 4, "t");
  strokeRect(plantX + 1, plantY + 5, 5, 4, "o");
  fillRect(plantX, plantY + 1, 7, 4, "l");
  set(plantX + 2, plantY, "l");
  set(plantX + 4, plantY, "l");
  set(plantX + 1, plantY + 3, "L");
  set(plantX + 5, plantY + 3, "L");

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
