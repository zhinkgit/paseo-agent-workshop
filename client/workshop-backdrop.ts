// Diegetic 4-zone studio-workshop room tilemap generator:
// Top wall: Doorway (Open) + Wall Signboard (Project/Workspace) + Wall Resource Gauge
// Left aisle: Interactive props (Mailbox = Send Message, Power Breaker = Stop Processes)
// Upper floor: Workbenches + Process Gear Pods on pastel-blue dotted carpet
// Lower floor: In-room Pixel Big Screen (left) + Cozy Sage Sofa Lounge (right) + Archive Cabinet (corner)
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
  loungeCapacity: number;
  /** Top-left wall wooden door (Open session). */
  doorPos: { x: number; y: number };
  /** Wall-mounted project/workspace plaque rect on the top wall. */
  signRect: Rect;
  /** Wall-mounted CPU/RAM/Process gauge rect on the top-right wall. */
  gaugeRect: Rect;
  /** Left aisle interactive Mailbox (Send message). */
  mailboxPos: { x: number; y: number };
  /** Left aisle interactive Power Breaker (Stop processes). */
  breakerPos: { x: number; y: number };
  /** In-room floor-standing Big Screen monitor rect (Click to open details). */
  bigScreenRect: Rect;
  /** Bottom-right corner Archive Cabinet (Archive / view closed). */
  chestPos: { x: number; y: number };
  stationOrigin: (index: number) => { x: number; y: number };
  loungeSpot: (index: number) => { x: number; y: number };
}

const BORDER = 3;
const WALL_H = 26; // Spacious architectural top wall for door + plaque + gauge
const WALKWAY_W = 22; // Left interactive prop aisle (mailbox + breaker)
const STATION_W = 42;
const STATION_H = 38;
const LOWER_H = 56; // Lower zone: In-room Big Screen (left) + Sofa Lounge (right) + Cabinet

export function computeRoomGeometry(stationCount: number, maxCols: number): RoomGeometry {
  const count = Math.max(1, stationCount);
  const cols = Math.max(2, Math.min(maxCols, count));
  const rows = Math.max(1, Math.ceil(count / cols));

  const minInnerW = 166; // Guarantees room is wide enough for Big Screen + Lounge + Signboard
  const workW = Math.max(minInnerW, cols * STATION_W + 16);
  const width = BORDER * 2 + WALKWAY_W + workW;
  const workBottom = WALL_H + rows * STATION_H + 6;
  const height = workBottom + LOWER_H + BORDER;

  const workLeft = BORDER + WALKWAY_W;
  const bigScreenW = Math.min(112, Math.max(88, Math.floor(workW * 0.56)));
  const bigScreenH = 44;
  const bigScreenX = workLeft + 2;
  const bigScreenY = workBottom + 4;

  const loungeLeft = bigScreenX + bigScreenW + 6;
  const loungeW = Math.max(36, width - BORDER - 20 - loungeLeft);
  const loungeCapacity = Math.max(1, Math.floor(loungeW / 16));

  const gaugeW = 54;
  const signX = BORDER + 20;
  const signW = Math.max(60, width - BORDER - gaugeW - 4 - signX);

  return {
    width,
    height,
    cols,
    rows,
    loungeCapacity,
    doorPos: { x: BORDER + 4, y: BORDER + 5 },
    signRect: { x: signX, y: BORDER + 3, w: signW, h: WALL_H - BORDER - 6 },
    gaugeRect: { x: width - BORDER - gaugeW - 2, y: BORDER + 4, w: gaugeW, h: WALL_H - BORDER - 8 },
    mailboxPos: { x: BORDER + 5, y: WALL_H + 12 },
    breakerPos: { x: BORDER + 5, y: WALL_H + 34 },
    bigScreenRect: { x: bigScreenX, y: bigScreenY, w: bigScreenW, h: bigScreenH },
    chestPos: { x: width - BORDER - 17, y: height - BORDER - 18 },
    stationOrigin(index: number) {
      const col = index % cols;
      const row = Math.floor(index / cols);
      return {
        x: workLeft + 4 + col * STATION_W,
        y: WALL_H + 4 + row * STATION_H,
      };
    },
    loungeSpot(index: number) {
      const slot = index % loungeCapacity;
      return {
        x: loungeLeft + 4 + slot * 16,
        y: workBottom + 24,
      };
    },
  };
}

const BACKDROP_CACHE = new Map<string, PixelBitmap>();

export function buildWorkshopBackdrop(geom: RoomGeometry): PixelBitmap {
  const key = `diegetic-bg-${geom.width}x${geom.height}`;
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

  const lowerTop = height - BORDER - LOWER_H;
  const workLeft = BORDER + WALKWAY_W;

  // 1. Crisp white studio tile walkway
  for (let y = WALL_H; y < height - BORDER; y++) {
    for (let x = BORDER; x < width - BORDER; x++) {
      const seam = (x - BORDER) % 12 === 0 || (y - WALL_H) % 12 === 0;
      set(x, y, seam ? "z" : "f");
    }
  }

  // 2. Soft pastel-blue dotted carpet under the workbench area
  for (let y = WALL_H; y < lowerTop; y++) {
    for (let x = workLeft; x < width - BORDER; x++) {
      const dot = (x + y) % 4 === 0 && y % 2 === 0;
      set(x, y, dot ? "K" : "k");
    }
  }

  // 3. Soft mint-sage diagonal-stripe lounge rug on the right side of the lower floor
  const rugX = geom.bigScreenRect.x + geom.bigScreenRect.w + 4;
  const rugW = Math.max(24, width - BORDER - rugX - 18);
  const rugY = lowerTop + 10;
  const rugH = LOWER_H - 12;
  for (let y = rugY; y < rugY + rugH; y++) {
    for (let x = rugX; x < rugX + rugW; x++) {
      set(x, y, (x + y) % 4 < 2 ? "u" : "U");
    }
  }

  // 4. Top architectural plaster wall with subtle seams & baseboard
  fillRect(BORDER, BORDER, width - BORDER * 2, WALL_H - BORDER, "n");
  for (let x = BORDER + 20; x < width - BORDER; x += 28) {
    for (let y = BORDER; y < WALL_H - 2; y++) set(x, y, "N");
  }
  fillRect(BORDER, WALL_H - 3, width - BORDER * 2, 2, "N");
  fillRect(BORDER, WALL_H - 1, width - BORDER * 2, 1, "o");

  // 5. Welcome mat beneath the interactive wooden door
  fillRect(geom.doorPos.x + 1, WALL_H + 3, 12, 5, "t");
  strokeRect(geom.doorPos.x + 1, WALL_H + 3, 12, 5, "T");

  // 6. Big Screen floor stand legs & subtle ground shadow under bigScreenRect
  const bs = geom.bigScreenRect;
  fillRect(bs.x + 10, bs.y + bs.h, 6, 4, "j");
  fillRect(bs.x + bs.w - 16, bs.y + bs.h, 6, 4, "j");
  fillRect(bs.x + 4, bs.y + bs.h + 3, bs.w - 8, 2, "q");

  // 7. Cozy sage sofa + warm coffee table + potted plant in the right lounge zone
  if (rugW >= 26) {
    const sofaW = Math.min(28, Math.max(18, rugW - 8));
    const sofaX = rugX + Math.floor((rugW - sofaW) / 2);
    const sofaY = lowerTop + 4;
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

  // Potted plant tucked near top-right corner of the lounge
  const plantX = width - BORDER - 11;
  const plantY = lowerTop + 3;
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
