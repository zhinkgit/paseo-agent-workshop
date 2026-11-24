// Procedural 2.5D Retro RPG Workshop room tilemap generator.
// Renders an entire room's stone/timber walls, sconces, fireplace alcove, wooden floorboards,
// woven guild rug, potted plant, and doorway into ONE crisp cached PixelBitmap!
import type { PixelBitmap } from "./pixel-png.ts";

export interface RoomGeometry {
  /** Total art pixels wide & tall. */
  width: number;
  height: number;
  cols: number;
  rows: number;
  /** Art-pixel anchor (top-left of each station slot). */
  stationOrigin: (index: number) => { x: number; y: number };
  /** Art-pixel position of the hearth fire on the top wall. */
  hearthPos: { x: number; y: number };
  /** Art-pixel position of the archive chest in the bottom-right corner. */
  chestPos: { x: number; y: number };
  /** Art-pixel lounge rug spots where idle/ready artisans can stroll. */
  loungeSpot: (index: number) => { x: number; y: number };
}

const WALL_H = 26; // Top 2.5D stone/timber wall height in art pixels
const BORDER = 4; // Side/bottom timber wall thickness in art pixels
const STATION_W = 54; // Width per workbench + mini-machine slot in art pixels
const STATION_H = 44; // Height per workbench row in art pixels
const FLOOR_PAD_X = 12;
const FLOOR_PAD_TOP = 10;
const LOUNGE_H = 28; // Bottom cozy rug / aisle strip

export function computeRoomGeometry(stationCount: number, maxCols: number): RoomGeometry {
  const count = Math.max(1, stationCount);
  const cols = Math.max(2, Math.min(maxCols, count));
  const rows = Math.max(1, Math.ceil(count / cols));

  const innerW = cols * STATION_W + FLOOR_PAD_X * 2;
  const innerH = FLOOR_PAD_TOP + rows * STATION_H + LOUNGE_H;
  const width = innerW + BORDER * 2;
  const height = WALL_H + innerH + BORDER;

  return {
    width,
    height,
    cols,
    rows,
    stationOrigin(index: number) {
      const col = index % cols;
      const row = Math.floor(index / cols);
      return {
        x: BORDER + FLOOR_PAD_X + col * STATION_W,
        y: WALL_H + FLOOR_PAD_TOP + row * STATION_H,
      };
    },
    hearthPos: {
      x: Math.floor(width / 2) - 6,
      y: 12,
    },
    chestPos: {
      x: width - BORDER - 22,
      y: height - BORDER - 18,
    },
    loungeSpot(index: number) {
      const spacing = 22;
      const startX = BORDER + 16;
      const maxSpots = Math.max(1, Math.floor((innerW - 44) / spacing));
      const slot = index % maxSpots;
      return {
        x: startX + slot * spacing,
        y: height - BORDER - 22,
      };
    },
  };
}

const BACKDROP_CACHE = new Map<string, PixelBitmap>();

/**
 * Generates a single crisp pixel-art room backdrop bitmap for a given `(width, height)`.
 * Rooms of the same size share the exact same bitmap & PNG cache entry.
 */
export function buildWorkshopBackdrop(geom: RoomGeometry): PixelBitmap {
  const key = `room-bg-${geom.width}x${geom.height}`;
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

  // 1. Warm wooden plank floor with staggered plank seams & subtle grain
  for (let y = WALL_H; y < height - BORDER; y++) {
    const plankIdx = Math.floor((y - WALL_H) / 6);
    const inPlank = (y - WALL_H) % 6;
    const stagger = (plankIdx % 2) * 14;
    for (let x = BORDER; x < width - BORDER; x++) {
      let ch = inPlank === 0 ? "z" : plankIdx % 2 === 0 ? "f" : "F";
      if ((x + stagger) % 28 === 0 && inPlank > 0) ch = "z";
      else if (inPlank === 3 && (x + plankIdx * 7) % 19 === 0) ch = "F";
      set(x, y, ch);
    }
  }

  // 2. Soft drop shadow cast by the top wall onto the floorboards
  fillRect(BORDER, WALL_H, width - BORDER * 2, 2, "z");

  // 3. Cozy woven guild rug in the bottom-left lounge zone
  const rugW = Math.min(72, Math.max(38, width - BORDER * 2 - 42));
  const rugH = 16;
  const rugX = BORDER + 10;
  const rugY = height - BORDER - rugH - 5;
  fillRect(rugX, rugY, rugW, rugH, "u");
  // Rug gold border & inner diamond motif
  for (let x = rugX; x < rugX + rugW; x++) {
    set(x, rugY, "U");
    set(x, rugY + rugH - 1, "U");
    set(x, rugY + 1, "y");
    set(x, rugY + rugH - 2, "y");
  }
  for (let y = rugY; y < rugY + rugH; y++) {
    set(rugX, y, "U");
    set(rugX + rugW - 1, y, "U");
    if (y > rugY && y < rugY + rugH - 1) {
      set(rugX + 1, y, "y");
      set(rugX + rugW - 2, y, "y");
    }
  }
  for (let x = rugX + 6; x < rugX + rugW - 6; x += 8) {
    set(x, rugY + Math.floor(rugH / 2), "y");
    set(x + 1, rugY + Math.floor(rugH / 2) - 1, "U");
    set(x + 1, rugY + Math.floor(rugH / 2) + 1, "U");
  }

  // 4. Top 2.5D stone-brick wall + timber beam wainscoting
  for (let y = 2; y < WALL_H - 6; y++) {
    const brickRow = Math.floor((y - 2) / 5);
    const inBrick = (y - 2) % 5;
    const offset = (brickRow % 2) * 6;
    for (let x = BORDER; x < width - BORDER; x++) {
      let ch = inBrick === 0 ? "v" : (x + offset) % 12 === 0 ? "v" : brickRow % 2 === 0 ? "n" : "N";
      set(x, y, ch);
    }
  }
  // Wooden wainscoting trim along the lower wall
  fillRect(BORDER, WALL_H - 6, width - BORDER * 2, 1, "o");
  fillRect(BORDER, WALL_H - 5, width - BORDER * 2, 2, "w");
  fillRect(BORDER, WALL_H - 3, width - BORDER * 2, 2, "W");
  fillRect(BORDER, WALL_H - 1, width - BORDER * 2, 1, "d");

  // 5. Stone Hearth / Fireplace centered on the top wall
  const hx = geom.hearthPos.x - 3;
  fillRect(hx, 6, 18, WALL_H - 6, "N");
  fillRect(hx, 5, 18, 2, "w");
  fillRect(hx, 4, 18, 1, "o");
  fillRect(hx + 2, 9, 14, WALL_H - 10, "o");
  fillRect(hx + 3, 10, 12, WALL_H - 11, "v");
  // Hearth stone floor apron
  fillRect(hx + 1, WALL_H, 16, 4, "N");
  fillRect(hx + 2, WALL_H + 1, 14, 2, "n");

  // 6. Warm hanging lanterns / wall sconces flanking the hearth
  const sconceXs = [BORDER + 14, width - BORDER - 18];
  for (const sx of sconceXs) {
    if (Math.abs(sx - hx) < 16) continue;
    set(sx + 1, 8, "j");
    set(sx + 1, 9, "b");
    fillRect(sx, 10, 3, 3, "a");
    set(sx + 1, 11, "p");
    set(sx + 1, 13, "B");
  }

  // 7. Potted workshop plant in the top-left corner
  const px = BORDER + 3;
  const py = WALL_H - 2;
  fillRect(px + 1, py + 4, 5, 4, "W");
  fillRect(px, py + 3, 7, 1, "w");
  fillRect(px + 1, py, 5, 3, "l");
  set(px + 2, py - 1, "l");
  set(px + 4, py - 1, "l");
  set(px + 1, py + 2, "L");
  set(px + 5, py + 2, "L");

  // 8. Outer timber & outline room walls (left, right, top, bottom with doorway)
  fillRect(0, 0, width, 2, "d");
  fillRect(0, 0, width, 1, "o");
  fillRect(0, 0, BORDER, height, "d");
  fillRect(width - BORDER, 0, BORDER, height, "d");
  fillRect(0, height - BORDER, width, BORDER, "d");
  for (let y = 0; y < height; y++) {
    set(0, y, "o");
    set(width - 1, y, "o");
    set(BORDER - 1, y, "W");
    set(width - BORDER, y, "W");
  }
  for (let x = 0; x < width; x++) {
    set(x, height - 1, "o");
  }

  // Doorway opening in the bottom wall (center)
  const doorW = 18;
  const doorX = Math.floor((width - doorW) / 2);
  fillRect(doorX, height - BORDER, doorW, BORDER, "F");
  fillRect(doorX + 2, height - BORDER - 2, doorW - 4, 3, "b");
  fillRect(doorX + 3, height - BORDER - 1, doorW - 6, 1, "B");

  const bitmap: PixelBitmap = {
    key,
    width,
    height,
    rows: grid.map((row) => row.join("")),
  };
  BACKDROP_CACHE.set(key, bitmap);
  return bitmap;
}
