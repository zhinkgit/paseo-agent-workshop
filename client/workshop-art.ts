// High-craft Retro RPG / Workshop pixel-art sprite catalog (16px tile scale, 3-tone shading, 4-frame loops).
import type { PluginTheme } from "@getpaseo/plugin";
import type { ColorMap, PixelBitmap } from "./pixel-png.ts";

export type WorkshopState =
  | "needs-input"
  | "failed"
  | "runaway"
  | "working"
  | "ready"
  | "idle"
  | "closed";

export type MachineLoad = "none" | "calm" | "hot" | "runaway";

export interface WorkshopPalette {
  key: string;
  isDark: boolean;
  canvasBg: string;
  roomFrame: string;
  roomHeaderBg: string;
  roomHeaderText: string;
  roomHeaderMuted: string;
  selectedRing: string;
  colors: ColorMap;
}

const SKINS = [
  { hi: "#fde2c4", mid: "#f2c496", sh: "#cc9362" },
  { hi: "#f5cfa0", mid: "#e0aa74", sh: "#b57d4a" },
  { hi: "#d9a06c", mid: "#ba7e4a", sh: "#8c5930" },
  { hi: "#a87048", mid: "#875332", sh: "#5e361f" },
] as const;

const HAIRS = [
  { hi: "#524059", mid: "#34273b", sh: "#1e1624" },
  { hi: "#8c5734", mid: "#633a20", sh: "#3d2211" },
  { hi: "#e6b450", mid: "#c48d2d", sh: "#8f6118" },
  { hi: "#c9533c", mid: "#9c3826", sh: "#692014" },
  { hi: "#6c7a8f", mid: "#4c5769", sh: "#2f3745" },
  { hi: "#3b5978", mid: "#253c54", sh: "#152536" },
] as const;

const TUNICS = [
  { hi: "#6aa8f2", mid: "#447fd1", sh: "#295599" }, // Guild cobalt
  { hi: "#eb8d4b", mid: "#c76728", sh: "#8c4314" }, // Blacksmith copper
  { hi: "#64bf89", mid: "#3d9462", sh: "#23613e" }, // Herbalist forest
  { hi: "#b384e0", mid: "#8858ba", sh: "#593482" }, // Alchemist violet
  { hi: "#e8728c", mid: "#bf4765", sh: "#82273e" }, // Tinker rose
  { hi: "#59bfbf", mid: "#359194", sh: "#1f5f63" }, // Clockmaker teal
] as const;

const PANTS = ["#364059", "#4a3e35", "#2d4740", "#45384d"] as const;

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function isDarkHex(hex: string): boolean {
  const clean = hex.replace("#", "");
  if (clean.length < 6) return true;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b < 128;
}

export function workshopPalette(theme: PluginTheme): WorkshopPalette {
  const dark = isDarkHex(theme.colors.surface0);
  if (dark) {
    return {
      key: `w-dark-${theme.colors.accent}`,
      isDark: true,
      canvasBg: "#16120f",
      roomFrame: "#3b2c22",
      roomHeaderBg: "#261d17",
      roomHeaderText: "#f2e5ce",
      roomHeaderMuted: "#b5a086",
      selectedRing: "#f5c451",
      colors: {
        o: "#17110e", // crisp pixel outline
        q: "#140f0c66", // soft ground shadow
        e: "#1f1815", // eyes
        // Wood & architecture
        w: "#a87040", // wood light
        W: "#7d4f2a", // wood mid
        d: "#523219", // wood dark
        // Stone & wall
        n: "#544740", // stone light
        N: "#3d332e", // stone mid
        v: "#29211d", // stone dark / mortar
        // Floorboards
        f: "#382b22", // plank light
        F: "#2e231b", // plank mid
        z: "#231a14", // plank seam / shadow
        // Rug
        u: "#7d353b", // rug mid
        U: "#592228", // rug dark
        y: "#c99642", // rug gold trim
        // Metal & brass
        m: "#b8c4d0", // steel highlight
        M: "#7b8794", // steel mid
        j: "#48515c", // steel dark
        b: "#ebb854", // brass highlight
        B: "#b5822b", // brass mid
        // Foliage
        l: "#5cb874", // leaf light
        L: "#347849", // leaf dark
        // Semantic glows & FX
        g: "#4ade80", // emerald ok
        G: "#15803d", // emerald dark
        r: "#f87171", // ruby alert
        R: "#b91c1c", // ruby dark
        a: "#fbbf24", // amber fire / lamp
        A: "#d97706", // amber mid
        c: "#60a5fa", // arcane spark
        C: "#2563eb", // spark dark
        p: "#fbf3df", // parchment / bright spark
        P: "#decba6", // parchment shade
        k: "#9ca3af", // smoke light
        K: "#4b5563", // smoke dark
        x: "#e11d48", // wax seal
      },
    };
  }
  return {
    key: `w-light-${theme.colors.accent}`,
    isDark: false,
    canvasBg: "#e6dccb",
    roomFrame: "#8c6b4b",
    roomHeaderBg: "#f2e7d3",
    roomHeaderText: "#362618",
    roomHeaderMuted: "#755c43",
    selectedRing: "#d97706",
    colors: {
      o: "#2b1e15",
      q: "#3b2a1c44",
      e: "#241914",
      w: "#c78e56",
      W: "#9c6838",
      d: "#6b4320",
      n: "#d1c3b2",
      N: "#b5a490",
      v: "#8c7b68",
      f: "#ebd9bc",
      F: "#dfc8a4",
      z: "#c7ad87",
      u: "#b54c54",
      U: "#87333b",
      y: "#d9a23b",
      m: "#cfd8e3",
      M: "#8c99a8",
      j: "#525d6b",
      b: "#f0be52",
      B: "#b88220",
      l: "#4cad66",
      L: "#2b7040",
      g: "#22c55e",
      G: "#15803d",
      r: "#ef4444",
      R: "#991b1b",
      a: "#f59e0b",
      A: "#b45309",
      c: "#3b82f6",
      C: "#1d4ed8",
      p: "#fffcf2",
      P: "#e3d2b1",
      k: "#94a3b8",
      K: "#64748b",
      x: "#e11d48",
    },
  };
}

export function artisanColors(
  base: WorkshopPalette,
  agentId: string,
  role: string | null,
): { colors: ColorMap; key: string } {
  const hash = hashString(agentId);
  const skin = SKINS[hash % SKINS.length]!;
  const hair = HAIRS[(hash >>> 3) % HAIRS.length]!;
  const tunic = TUNICS[(hash >>> 6) % TUNICS.length]!;
  const pant = PANTS[(hash >>> 9) % PANTS.length]!;
  const r = role?.toLowerCase();
  const accent =
    r === "overseer"
      ? "#fbbf24"
      : r === "nexus"
        ? "#60a5fa"
        : r === "meow"
          ? "#f472b6"
          : null;
  return {
    key: `${base.key}-c${hash % 199}-${accent ?? "n"}`,
    colors: {
      ...base.colors,
      "1": skin.hi,
      "2": skin.mid,
      "3": skin.sh,
      "4": hair.hi,
      "5": hair.mid,
      "6": hair.sh,
      "7": tunic.hi,
      "8": tunic.mid,
      "9": tunic.sh,
      "0": pant,
      "*": accent ?? hair.hi,
    },
  };
}

// 14x18 Cozy RPG Artisan sprites with soft ground shadow (q), 3-tone hair/tunic, and 4-frame animations!
const WORKING_FRAMES: readonly PixelBitmap[] = [
  {
    key: "art-work-0",
    width: 14,
    height: 18,
    rows: [
      "....oooooo....",
      "...o**4455o...",
      "..o44555566o..",
      "..o55122256o..",
      "..o51e22e16o..",
      "..o62233226o..",
      "...oooooooo...",
      "..oo778888oo..",
      ".o1o788889o1o.",
      ".o2o88bb89oMo.",
      "..oo889999omo.",
      "...o999999o...",
      "...o00oo00o...",
      "...o00oo00o...",
      "...oddo.ddo...",
      "..qqooooooqq..",
      ".qqqqqqqqqqqq.",
      "..qqqqqqqqqq..",
    ],
  },
  {
    key: "art-work-1",
    width: 14,
    height: 18,
    rows: [
      "....oooooo..c.",
      "...o**4455oa..",
      "..o44555566o..",
      "..o55122256o..",
      "..o51e22e16o..",
      "..o62233226o..",
      "...oooooooo.m.",
      "..oo778888oMo.",
      ".o1o788889o1o.",
      ".o2o88bb89oo..",
      "..oo889999o...",
      "...o999999o...",
      "...o00oo00o...",
      "...o00oo00o...",
      "...oddo.ddo...",
      "..qqooooooqq..",
      ".qqqqqqqqqqqq.",
      "..qqqqqqqqqq..",
    ],
  },
  {
    key: "art-work-2",
    width: 14,
    height: 18,
    rows: [
      "....oooooo.p..",
      "...o**4455o.c.",
      "..o44555566o..",
      "..o55122256o..",
      "..o51e22e16o..",
      "..o62233226o..",
      "...oooooooo...",
      "..oo778888oo..",
      ".o1o788889o1o.",
      ".o2o88bb89oMo.",
      "..oo889999omo.",
      "...o999999o...",
      "...o00oo00o...",
      "...o00oo00o...",
      "...oddo.ddo...",
      "..qqooooooqq..",
      ".qqqqqqqqqqqq.",
      "..qqqqqqqqqq..",
    ],
  },
  {
    key: "art-work-3",
    width: 14,
    height: 18,
    rows: [
      "....oooooo....",
      "...o**4455o...",
      "..o44555566o..",
      "..o55122256o..",
      "..o51e22e16o..",
      "..o62233226o..",
      "...oooooooo...",
      "..oo778888oo..",
      ".o1o788889o1o.",
      ".o2o88bb89o2o.",
      "..oo889999oo..",
      "...o999999o...",
      "...o00oo00o...",
      "...o00oo00o...",
      "...oddo.ddo...",
      "..qqooooooqq..",
      ".qqqqqqqqqqqq.",
      "..qqqqqqqqqq..",
    ],
  },
];

const WALK_FRAMES: readonly PixelBitmap[] = [
  {
    key: "art-walk-0",
    width: 14,
    height: 18,
    rows: [
      "....oooooo....",
      "...o**4455o...",
      "..o44555566o..",
      "..o55122256o..",
      "..o51e22e16o..",
      "..o62233226o..",
      "...oooooooo...",
      "..oo778888oo..",
      ".o1o788889o...",
      "..oo88bb89o1o.",
      "...o889999oo..",
      "...o999999o...",
      "..o00o..o00o..",
      "..o00o...o0o..",
      "..oddo...ddo..",
      "..qqooooooqq..",
      ".qqqqqqqqqqqq.",
      "..qqqqqqqqqq..",
    ],
  },
  {
    key: "art-walk-1",
    width: 14,
    height: 18,
    rows: [
      "..............",
      "....oooooo....",
      "...o**4455o...",
      "..o44555566o..",
      "..o55122256o..",
      "..o51e22e16o..",
      "..o62233226o..",
      "...oooooooo...",
      "..oo778888oo..",
      "..o17888891o..",
      "..oo88bb89oo..",
      "...o889999o...",
      "...o00oo00o...",
      "...o00oo00o...",
      "...oddo.ddo...",
      "..qqooooooqq..",
      ".qqqqqqqqqqqq.",
      "..qqqqqqqqqq..",
    ],
  },
  {
    key: "art-walk-2",
    width: 14,
    height: 18,
    rows: [
      "....oooooo....",
      "...o**4455o...",
      "..o44555566o..",
      "..o55122256o..",
      "..o51e22e16o..",
      "..o62233226o..",
      "...oooooooo...",
      "..oo778888oo..",
      "...o788889o1o.",
      ".o1o88bb89oo..",
      "..oo889999o...",
      "...o999999o...",
      "..o00o..o00o..",
      "..o0o...o00o..",
      "..ddo...oddo..",
      "..qqooooooqq..",
      ".qqqqqqqqqqqq.",
      "..qqqqqqqqqq..",
    ],
  },
  {
    key: "art-walk-3",
    width: 14,
    height: 18,
    rows: [
      "..............",
      "....oooooo....",
      "...o**4455o...",
      "..o44555566o..",
      "..o55122256o..",
      "..o51e22e16o..",
      "..o62233226o..",
      "...oooooooo...",
      "..oo778888oo..",
      "..o17888891o..",
      "..oo88bb89oo..",
      "...o889999o...",
      "...o00oo00o...",
      "...o00oo00o...",
      "...oddo.ddo...",
      "..qqooooooqq..",
      ".qqqqqqqqqqqq.",
      "..qqqqqqqqqq..",
    ],
  },
];

const NEEDS_INPUT_FRAMES: readonly PixelBitmap[] = [
  {
    key: "art-ask-0",
    width: 14,
    height: 18,
    rows: [
      "....oaaaao....",
      "....oapapo....",
      "....oaaaao....",
      "...o**4455o...",
      "..o44555566o..",
      "..o51e22e16o..",
      "..o62233226o..",
      ".o1oooooooo1o.",
      ".o2o778888o2o.",
      "..oo88bb89oo..",
      "...o889999o...",
      "...o999999o...",
      "...o00oo00o...",
      "...o00oo00o...",
      "...oddo.ddo...",
      "..qqooooooqq..",
      ".qqqqqqqqqqqq.",
      "..qqqqqqqqqq..",
    ],
  },
  {
    key: "art-ask-1",
    width: 14,
    height: 18,
    rows: [
      ".....oao......",
      "....oapapo....",
      "....oaaaao....",
      "...o**4455o...",
      "..o44555566o..",
      "..o51e22e16o..",
      "..o62233226o..",
      "..oooooooooo..",
      ".o1o778888o1o.",
      ".o2o88bb89o2o.",
      "..oo889999oo..",
      "...o999999o...",
      "...o00oo00o...",
      "...o00oo00o...",
      "...oddo.ddo...",
      "..qqooooooqq..",
      ".qqqqqqqqqqqq.",
      "..qqqqqqqqqq..",
    ],
  },
];

const FAILED_FRAMES: readonly PixelBitmap[] = [
  {
    key: "art-fail-0",
    width: 14,
    height: 18,
    rows: [
      ".r..........r.",
      "..r.oooooo.r..",
      "...o**4455o...",
      "..o44555566o..",
      "..o51r22r16o..",
      "..o62233226o..",
      "...oooooooo...",
      "..oo778888oo..",
      ".o1o788889o1o.",
      "..oo88bb89oo..",
      "...o889999o...",
      "...o999999o...",
      "...o00oo00o...",
      "...o00oo00o...",
      "...oddo.ddo...",
      "..qqooooooqq..",
      ".qqqqqqqqqqqq.",
      "..qqqqqqqqqq..",
    ],
  },
  {
    key: "art-fail-1",
    width: 14,
    height: 18,
    rows: [
      "..r........r..",
      ".r..oooooo..r.",
      "...o**4455o...",
      "..o44555566o..",
      "..o51r22r16o..",
      "..o62233226o..",
      "...oooooooo...",
      "..oo778888oo..",
      ".o1o788889o1o.",
      "..oo88bb89oo..",
      "...o889999o...",
      "...o999999o...",
      "...o00oo00o...",
      "...o00oo00o...",
      "...oddo.ddo...",
      "..qqooooooqq..",
      ".qqqqqqqqqqqq.",
      "..qqqqqqqqqq..",
    ],
  },
];

const READY_FRAMES: readonly PixelBitmap[] = [
  {
    key: "art-ready-0",
    width: 14,
    height: 18,
    rows: [
      ".....gggg.....",
      "....ggppgg....",
      "...o**4455o...",
      "..o44555566o..",
      "..o51e22e16o..",
      "..o62233226o..",
      ".o1oooooooo1o.",
      "..oo778888oo..",
      "..o78888889o..",
      "..oo88bb89oo..",
      "...o889999o...",
      "...o999999o...",
      "...o00oo00o...",
      "...o00oo00o...",
      "...oddo.ddo...",
      "..qqooooooqq..",
      ".qqqqqqqqqqqq.",
      "..qqqqqqqqqq..",
    ],
  },
  {
    key: "art-ready-1",
    width: 14,
    height: 18,
    rows: [
      "......gg......",
      ".....gggg.....",
      "....oooooo....",
      "...o**4455o...",
      "..o44555566o..",
      "..o51e22e16o..",
      "..o62233226o..",
      "...oooooooo...",
      ".o1o778888o1o.",
      "..oo88bb89oo..",
      "...o889999o...",
      "...o999999o...",
      "...o00oo00o...",
      "...o00oo00o...",
      "...oddo.ddo...",
      "..qqooooooqq..",
      ".qqqqqqqqqqqq.",
      "..qqqqqqqqqq..",
    ],
  },
];

const IDLE_FRAMES: readonly PixelBitmap[] = [
  {
    key: "art-idle-0",
    width: 14,
    height: 18,
    rows: [
      "..........pp..",
      "....oooooo.p..",
      "...o**4455o...",
      "..o44555566o..",
      "..o55122256o..",
      "..o51322316o..",
      "..o62233226o..",
      "...oooooooo...",
      "..oo778888oo..",
      "..o17888891o..",
      "..oo88bb89oo..",
      "...o889999o...",
      "...o00oo00o...",
      "...o00oo00o...",
      "...oddo.ddo...",
      "..qqooooooqq..",
      ".qqqqqqqqqqqq.",
      "..qqqqqqqqqq..",
    ],
  },
  {
    key: "art-idle-1",
    width: 14,
    height: 18,
    rows: [
      "...........p..",
      "..............",
      "....oooooo....",
      "...o**4455o...",
      "..o44555566o..",
      "..o55122256o..",
      "..o51322316o..",
      "..o62233226o..",
      "...oooooooo...",
      "..oo778888oo..",
      "..o17888891o..",
      "..oo88bb89oo..",
      "...o889999o...",
      "...o00oo00o...",
      "...oddo.ddo...",
      "..qqooooooqq..",
      ".qqqqqqqqqqqq.",
      "..qqqqqqqqqq..",
    ],
  },
];

export function artisanFrames(state: WorkshopState, walking = false): readonly PixelBitmap[] {
  if (walking) return WALK_FRAMES;
  switch (state) {
    case "working":
      return WORKING_FRAMES;
    case "needs-input":
      return NEEDS_INPUT_FRAMES;
    case "failed":
      return FAILED_FRAMES;
    case "ready":
      return READY_FRAMES;
    default:
      return IDLE_FRAMES;
  }
}

// 24x14 Cozy Wooden Workbench with glowing lantern, parchment blueprint, and ground shadow
export const WORKBENCH_SPRITE: PixelBitmap = {
  key: "workbench-v2",
  width: 24,
  height: 14,
  rows: [
    "..oaaao.................",
    ".oapppao..oppppppppppo..",
    ".oaAAAao..opccpppccppo..",
    ".ooooooo..opppppccpppo..",
    "oooooooooooooooooooooooo",
    "owwwwwwwwwwwwwwwwwwwwwwo",
    "oWWWWWWWWWWWWWWWWWWWWWWo",
    "oddddddddddddddddddddddo",
    ".oWdo..obbbbo......oWdo.",
    ".oWdo..oBBBBoo.....oWdo.",
    ".oWdo..ooooooo.....oWdo.",
    ".oWdo..............oWdo.",
    ".qoooq............qoooq.",
    ".qqqqqqqqqqqqqqqqqqqqqq.",
  ],
};

// 14x14 Spinning Brass/Emerald/Overheating/Runaway Mini-Machine contraptions (4 frames)
const MACHINE_CALM: readonly PixelBitmap[] = [
  {
    key: "mach-calm-0",
    width: 14,
    height: 14,
    rows: [
      "..............",
      ".....oooo.....",
      "....ommmmo....",
      "...omoggomo...",
      "..omoggggomo..",
      "..omogbbgomo..",
      "..omoggggomo..",
      "...omoggomo...",
      "....oMMMMo....",
      "...oWWWWWWo...",
      "...oWbggbWo...",
      "...oddddddo...",
      "..qqooooooqq..",
      "...qqqqqqqq...",
    ],
  },
  {
    key: "mach-calm-1",
    width: 14,
    height: 14,
    rows: [
      "..............",
      "....oo..oo....",
      "...ommmmmmo...",
      "...omggggmo...",
      "..omogbbgomo..",
      "..omogbbgomo..",
      "...omggggmo...",
      "...ommmmmmo...",
      "....oMMMMo....",
      "...oWWWWWWo...",
      "...oWbgGbWo...",
      "...oddddddo...",
      "..qqooooooqq..",
      "...qqqqqqqq...",
    ],
  },
];

const MACHINE_HOT: readonly PixelBitmap[] = [
  {
    key: "mach-hot-0",
    width: 14,
    height: 14,
    rows: [
      "...kk...pp....",
      "....kk..k.....",
      "....oaaaao....",
      "...omaoaamo...",
      "..omaabbaamo..",
      "..omaabbaamo..",
      "...omaoaamo...",
      "....oMMMMo....",
      "...oWWWWWWo...",
      "...oWaaaaWo...",
      "...oWAAAAWo...",
      "...oddddddo...",
      "..qqooooooqq..",
      "...qqqqqqqq...",
    ],
  },
  {
    key: "mach-hot-1",
    width: 14,
    height: 14,
    rows: [
      "..pp...kk.....",
      "...k...kk.....",
      "....oAAAao....",
      "...omaaoamo...",
      "..omabaaaamo..",
      "..omaaabbamo..",
      "...omaaoamo...",
      "....oMMMMo....",
      "...oWWWWWWo...",
      "...oWAAAAWo...",
      "...oWaaaaWo...",
      "...oddddddo...",
      "..qqooooooqq..",
      "...qqqqqqqq...",
    ],
  },
];

const MACHINE_RUNAWAY: readonly PixelBitmap[] = [
  {
    key: "mach-run-0",
    width: 14,
    height: 14,
    rows: [
      ".r...oooo...r.",
      "....orppao....",
      "....orrrro....",
      "...omrormmo...",
      "..omrrbrrrmo..",
      "..omrrbrrrmo..",
      "...omrormmo...",
      "....oRRRRo....",
      "...oWWWWWWo...",
      "...oWrrrrWo...",
      "...oWRRRRWo...",
      "...oddddddo...",
      "..rroooooorr..",
      "...rrrrrrrr...",
    ],
  },
  {
    key: "mach-run-1",
    width: 14,
    height: 14,
    rows: [
      "..a..rrrr..a..",
      "....oaaaao....",
      "....oRRRRo....",
      "...omRorRmo...",
      "..omRRbrRRmo..",
      "..omRRbrRRmo..",
      "...omRorRmo...",
      "....orrrro....",
      "...oWWWWWWo...",
      "...oWRRRRWo...",
      "...oWrrrrWo...",
      "...oddddddo...",
      "..aaooooooaa..",
      "...qqqqqqqq...",
    ],
  },
];

export function machineFrames(load: Exclude<MachineLoad, "none">): readonly PixelBitmap[] {
  switch (load) {
    case "runaway":
      return MACHINE_RUNAWAY;
    case "hot":
      return MACHINE_HOT;
    case "calm":
      return MACHINE_CALM;
  }
}

// 14x12 Hearth Flame animation (mounted inside the stone fireplace on the workshop top wall)
export const HEARTH_FIRE_FRAMES: readonly PixelBitmap[] = [
  {
    key: "hearth-0",
    width: 12,
    height: 10,
    rows: [
      ".....a......",
      "....aAa.....",
      "...aAApa....",
      "..rAAppaA...",
      "..rAppppA...",
      ".rrAppppAr..",
      ".rAAppppAr..",
      "..dWWWWWWd..",
      "..dddddddd..",
      "............",
    ],
  },
  {
    key: "hearth-1",
    width: 12,
    height: 10,
    rows: [
      "......a.....",
      ".....aAa....",
      "...aAapAa...",
      "..rAppppA...",
      "..rAppppAr..",
      ".rAAppppAr..",
      ".rrAppppAr..",
      "..dWWWWWWd..",
      "..dddddddd..",
      "............",
    ],
  },
];

// 16x13 Archive Treasure Chest
export const ARCHIVE_CHEST: PixelBitmap = {
  key: "archive-chest-v2",
  width: 16,
  height: 13,
  rows: [
    "..oooooooooooo..",
    ".obwwwwwwwwwwbo.",
    "obwWWWWWWWWWWwbo",
    "oooooooooooooooo",
    "obwWWWobboWWWwbo",
    "obwWWWoaaOWWWwbo".replace("O", "o"),
    "obwWWWobboWWWwbo",
    "obwWWWWWWWWWWwbo",
    "obddddddddddddbo",
    ".obbbbbbbbbbbbo.",
    "..oooooooooooo..",
    ".qqqqqqqqqqqqqq.",
    "..qqqqqqqqqqqq..",
  ],
};

// 12x9 Sealed Parchment Envelope for flying inter-agent messages
export const ENVELOPE_SPRITE: PixelBitmap = {
  key: "envelope-v2",
  width: 12,
  height: 9,
  rows: [
    "oooooooooooo",
    "oPppppppppPo",
    "opPppppppPpo",
    "oppPpxxpPppo",
    "opppPxxPpppo",
    "oppPppppPppo",
    "opPppppppPpo",
    "oPPPPPPPPPPo",
    "oooooooooooo",
  ],
};

// 10x10 Crisp pixel status icons for List view & Dock header
export const STATE_ICONS: Record<WorkshopState, PixelBitmap> = {
  "needs-input": {
    key: "icon-ask-2",
    width: 10,
    height: 10,
    rows: [
      "..oooooo..",
      ".oaaaaaao.",
      "oaaaooaaao",
      "oaaoaaoaao",
      "oaaaoaaaao",
      "oaaaoaaaao",
      "oaaaaaaaao",
      "oaaaoaaaao",
      ".oaaaaaao.",
      "..oooooo..",
    ],
  },
  failed: {
    key: "icon-fail-2",
    width: 10,
    height: 10,
    rows: [
      "..oooooo..",
      ".orrrrrro.",
      "orrprrprro",
      "orrrpprrro",
      "orrrpprrro",
      "orrprrprro",
      "orrrrrrrro",
      "orrrrrrrro",
      ".oRRRRRRo.",
      "..oooooo..",
    ],
  },
  runaway: {
    key: "icon-runaway-2",
    width: 10,
    height: 10,
    rows: [
      "...oooo...",
      "..orrrro..",
      ".orraarro.",
      "orrrpprrro",
      "orraaaarro",
      "orrrpprrro",
      ".orraarro.",
      "..orrrro..",
      "...oooo...",
      "..........",
    ],
  },
  working: {
    key: "icon-work-2",
    width: 10,
    height: 10,
    rows: [
      "...oooo...",
      "..occcco..",
      ".occpccco.",
      "occcppccco",
      "occppppcco",
      "occcppccco",
      ".occpccco.",
      "..occcco..",
      "...oooo...",
      "..........",
    ],
  },
  ready: {
    key: "icon-ready-2",
    width: 10,
    height: 10,
    rows: [
      "..oooooo..",
      ".oggggggo.",
      "oggggggpgo",
      "ogggggpggo",
      "ogpggpgggo",
      "oggppggggo",
      "ogggpggggo",
      ".oggggggo.",
      "..oooooo..",
      "..........",
    ],
  },
  idle: {
    key: "icon-idle-2",
    width: 10,
    height: 10,
    rows: [
      "..oooooo..",
      ".oMMMMMMo.",
      "oMMppppMMo",
      "oMMMMpMMMo",
      "oMMMpMMMMo",
      "oMMppppMMo",
      "oMMMMMMMMo",
      ".oMMMMMMo.",
      "..oooooo..",
      "..........",
    ],
  },
  closed: {
    key: "icon-closed-2",
    width: 10,
    height: 10,
    rows: [
      ".oooooooo.",
      "oWWWWWWWWo",
      "oWbbbbbbWo",
      "oWWWWWWWWo",
      "oWWobboWWo",
      "oWWoaaOWWo".replace("O", "o"),
      "oWWWWWWWWo",
      "oWWWWWWWWo",
      ".oooooooo.",
      "..........",
    ],
  },
};
