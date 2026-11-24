// Crisp, airy studio-workshop pixel-art sprite catalog (inspired by Agent Lobby's clean aesthetic).
// Pure white/host canvas, light architectural walls & pastel floor zones so warm oak benches,
// colorful artisans, and semantic process gear pods pop cleanly.
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
  /** Flush with Paseo's own background (pure white in light mode, clean host surface in dark mode). */
  canvasBg: string;
  pillBg: string;
  pillBorder: string;
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
  { hi: "#423a4a", mid: "#2b2430", sh: "#1a151f" },
  { hi: "#8c5734", mid: "#633a20", sh: "#3d2211" },
  { hi: "#e6b450", mid: "#c48d2d", sh: "#8f6118" },
  { hi: "#c9533c", mid: "#9c3826", sh: "#692014" },
  { hi: "#6c7a8f", mid: "#4c5769", sh: "#2f3745" },
  { hi: "#3b5978", mid: "#253c54", sh: "#152536" },
] as const;

const TUNICS = [
  { hi: "#5b9be8", mid: "#3b79c9", sh: "#255391" },
  { hi: "#e88243", mid: "#c45f23", sh: "#8a3d12" },
  { hi: "#52b87e", mid: "#32915c", sh: "#1e613b" },
  { hi: "#a474d6", mid: "#7c4eb0", sh: "#512d7a" },
  { hi: "#e06782", mid: "#b8405c", sh: "#7d243a" },
  { hi: "#47b5b5", mid: "#2a8b8d", sh: "#195c5e" },
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
  if (clean.length < 6) return false;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b < 128;
}

export function workshopPalette(theme: PluginTheme): WorkshopPalette {
  const dark = isDarkHex(theme.colors.surface0);
  if (dark) {
    return {
      key: `studio-dark-${theme.colors.accent}`,
      isDark: true,
      canvasBg: theme.colors.surface0,
      pillBg: theme.colors.surface1,
      pillBorder: theme.colors.border,
      selectedRing: theme.colors.accent,
      colors: {
        o: "#14161a", // crisp pixel outline
        q: "#00000055", // soft ground shadow
        e: "#181a1f", // eyes
        // Clean architectural slate walls
        n: "#343942", // wall plaster light
        N: "#2a2f38", // wall plaster mid
        v: "#1e2229", // wall seam / frame
        h: "#4c5360", // outer wall highlight
        // Crisp studio floor zones (dark mode)
        f: "#232730", // walkway tile light
        F: "#1f232b", // walkway tile alt
        z: "#181b22", // tile grout / wall shadow
        // Work zone subtle blue-slate carpet
        k: "#232a36", // carpet base
        K: "#2a3342", // carpet dot
        // Lounge soft sage-teal rug
        u: "#233630", // rug light
        U: "#1c2c27", // rug stripe
        // Warm oak wood (benches, doorway, counter)
        w: "#c29263", // oak highlight
        W: "#9c6e44", // oak mid
        d: "#6b4728", // oak shadow
        // Sofa & fabric
        s: "#478a6a", // sage sofa light
        S: "#2e6149", // sage sofa shadow
        t: "#c98553", // coffee table warm
        T: "#945a31", // coffee table dark
        // Steel & brass
        m: "#c5cfd9", // steel highlight
        M: "#838e9c", // steel mid
        j: "#4d5663", // steel dark
        b: "#eab64d", // brass highlight
        B: "#b38122", // brass mid
        // Foliage
        l: "#5ec27a", // leaf light
        L: "#2f7a47", // leaf dark
        // Semantic indicators
        g: "#34d399", // emerald active/calm
        G: "#15803d", // emerald dark
        r: "#f87171", // ruby runaway/error
        R: "#b91c1c", // ruby dark
        a: "#fbbf24", // amber warn/hot
        A: "#b45309", // amber dark
        c: "#60a5fa", // screen/spark blue
        C: "#2563eb", // spark dark
        p: "#ffffff", // pure highlight / paper
        P: "#dfe4ec", // paper shadow
        x: "#f43f5e", // wax seal
      },
    };
  }

  // Light mode: crisp pure white canvas + clean gallery-grade architectural studio palette
  return {
    key: `studio-light-${theme.colors.accent}`,
    isDark: false,
    canvasBg: "#ffffff",
    pillBg: "#ffffff",
    pillBorder: "#e2e6ec",
    selectedRing: theme.colors.accent,
    colors: {
      o: "#1f242b", // crisp charcoal outline (never muddy brown)
      q: "#1f242b24", // delicate shadow
      e: "#1f242b", // eyes
      // Clean architectural plaster & slate frame walls
      n: "#e9ecf0", // light plaster wall
      N: "#dce1e7", // plaster shadow / trim
      v: "#4d5561", // crisp slate wall border
      h: "#747e8c", // slate wall highlight
      // Airy crisp white/off-white studio tile walkway
      f: "#ffffff", // pure white floor tile
      F: "#f5f7fa", // subtle alternating tile
      z: "#e6eaf0", // delicate tile grout
      // Work zone soft airy pastel-blue dotted carpet
      k: "#eff4fb", // soft sky carpet
      K: "#e1eaf7", // subtle micro-dot
      // Lounge soft mint-sage diagonal rug
      u: "#e6f2ec", // mint rug light
      U: "#d7eae0", // mint rug stripe
      // Warm Scandinavian light-oak furniture
      w: "#d9b082", // oak highlight
      W: "#b88958", // oak mid
      d: "#875e37", // oak shadow
      // Cozy sage sofa & warm terracotta table
      s: "#5fa37e", // sage sofa light
      S: "#3c7557", // sage sofa shadow
      t: "#d48d5d", // warm wood table
      T: "#a36339", // table shadow
      // Steel & brass
      m: "#dce3eb", // brushed steel
      M: "#96a2b0", // steel mid
      j: "#596370", // steel dark
      b: "#f0be52", // brass gold
      B: "#bd8924", // brass shadow
      // Foliage
      l: "#4db86b", // lush leaf light
      L: "#2b7a43", // lush leaf dark
      // Semantic indicators
      g: "#22c55e", // emerald ok/calm
      G: "#15803d", // emerald dark
      r: "#ef4444", // crimson alert/runaway
      R: "#991b1b", // crimson dark
      a: "#f59e0b", // amber attention/hot
      A: "#b45309", // amber dark
      c: "#3b82f6", // active blue
      C: "#1d4ed8", // active dark
      p: "#ffffff", // pure white paper/highlight
      P: "#e4e8ef", // paper shadow
      x: "#e11d48", // wax seal
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
      ? "#f59e0b"
      : r === "nexus"
        ? "#3b82f6"
        : r === "meow"
          ? "#ec4899"
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

// 14x18 Crisp studio-RPG artisan sprites (4-frame smooth loops)
const WORKING_FRAMES: readonly PixelBitmap[] = [
  {
    key: "st-work-0",
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
    key: "st-work-1",
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
    key: "st-work-2",
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
    key: "st-work-3",
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
    key: "st-walk-0",
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
    key: "st-walk-1",
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
    key: "st-walk-2",
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
    key: "st-walk-3",
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
    key: "st-ask-0",
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
    key: "st-ask-1",
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
    key: "st-fail-0",
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
    key: "st-fail-1",
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
    key: "st-ready-0",
    width: 14,
    height: 18,
    rows: [
      "....oggggo....",
      "...oggppggo...",
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
    key: "st-ready-1",
    width: 14,
    height: 18,
    rows: [
      ".....oggo.....",
      "....oggggo....",
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
    key: "st-idle-0",
    width: 14,
    height: 18,
    rows: [
      "..........oo..",
      "....ooooooMo..",
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
    key: "st-idle-1",
    width: 14,
    height: 18,
    rows: [
      "...........o..",
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

// 28x16 Clean Oak Studio Workbench with glowing emerald/off/error monitor & blueprint pad
const BENCH_LIT: readonly PixelBitmap[] = [
  {
    key: "bench-lit-0",
    width: 28,
    height: 16,
    rows: [
      "........oooooooooooo........",
      "........oGGGGGGGGGGoo.......",
      "........oGggppggggGoo.......",
      "........oGggggpppGGoo.......",
      "........oGggpggggGGoo.......",
      "........oGGGGGGGGGGoo.......",
      "........oooooooooooo........",
      "...........oMMMMo...........",
      "oooooooooooooooooooooooooooo",
      "owwwwwwwwwwwwwwwwwwwwwwwwwwo",
      "owwobboowwommmmmmoowoppppooo",
      "oWWoBBoWWWojjjjjjWWWoPppPWWo",
      "oWWWWWWWWWWWWWWWWWWWWWWWWWWo",
      "oddddddddddddddddddddddddddo",
      ".oWdo..................oWdo.",
      ".qooqqqqqqqqqqqqqqqqqqqqooqq",
    ].map((r) => r.slice(0, 28)),
  },
  {
    key: "bench-lit-1",
    width: 28,
    height: 16,
    rows: [
      "........oooooooooooo........",
      "........oGGGGGGGGGGoo.......",
      "........oGggggpppGGoo.......",
      "........oGggpggggGGoo.......",
      "........oGgggpppGGGoo.......",
      "........oGGGGGGGGGGoo.......",
      "........oooooooooooo........",
      "...........oMMMMo...........",
      "oooooooooooooooooooooooooooo",
      "owwwwwwwwwwwwwwwwwwwwwwwwwwo",
      "owwobboowwommmmmmoowoppppooo",
      "oWWoBBoWWWojjjjjjWWWoPppPWWo",
      "oWWWWWWWWWWWWWWWWWWWWWWWWWWo",
      "oddddddddddddddddddddddddddo",
      ".oWdo..................oWdo.",
      ".qooqqqqqqqqqqqqqqqqqqqqooqq",
    ].map((r) => r.slice(0, 28)),
  },
];

const BENCH_OFF: PixelBitmap = {
  key: "bench-off",
  width: 28,
  height: 16,
  rows: [
    "........oooooooooooo........",
    "........ojjjjjjjjjjoo.......",
    "........ojjMMMMjjjjoo.......",
    "........ojjjjjjjjjjoo.......",
    "........ojjjjjjjjjjoo.......",
    "........ojjjjjjjjjjoo.......",
    "........oooooooooooo........",
    "...........oMMMMo...........",
    "oooooooooooooooooooooooooooo",
    "owwwwwwwwwwwwwwwwwwwwwwwwwwo",
    "owwoMMoowwommmmmmoowoppppooo",
    "oWWojjoWWWojjjjjjWWWoPppPWWo",
    "oWWWWWWWWWWWWWWWWWWWWWWWWWWo",
    "oddddddddddddddddddddddddddo",
    ".oWdo..................oWdo.",
    ".qooqqqqqqqqqqqqqqqqqqqqooqq",
  ].map((r) => r.slice(0, 28)),
};

const BENCH_ERR: PixelBitmap = {
  key: "bench-err",
  width: 28,
  height: 16,
  rows: [
    "........oooooooooooo........",
    "........oRRRRRRRRRRoo.......",
    "........oRRpRRRRpRRoo.......",
    "........oRRRpRRpRRRoo.......",
    "........oRRpRRRRpRRoo.......",
    "........oRRRRRRRRRRoo.......",
    "........oooooooooooo........",
    "...........oMMMMo...........",
    "oooooooooooooooooooooooooooo",
    "owwwwwwwwwwwwwwwwwwwwwwwwwwo",
    "owworroowwommmmmmoowoppppooo",
    "oWWoRRoWWWojjjjjjWWWoPppPWWo",
    "oWWWWWWWWWWWWWWWWWWWWWWWWWWo",
    "oddddddddddddddddddddddddddo",
    ".oWdo..................oWdo.",
    ".qooqqqqqqqqqqqqqqqqqqqqooqq",
  ].map((r) => r.slice(0, 28)),
};

export function benchSprite(state: WorkshopState, frame: number): PixelBitmap {
  if (state === "failed" || state === "runaway") return BENCH_ERR;
  if (state === "working" || state === "needs-input") return BENCH_LIT[frame % 2]!;
  return BENCH_OFF;
}

// Keep exported constant for unit tests & empty-state illustration
export const WORKBENCH_SPRITE: PixelBitmap = BENCH_LIT[0]!;

// 12x12 Sleek Process Gear / Gauge Pods mounted cleanly beside each bench
const MACHINE_CALM: readonly PixelBitmap[] = [
  {
    key: "pod-calm-0",
    width: 12,
    height: 12,
    rows: [
      "............",
      "....oooo....",
      "...ommmmo...",
      "..omoggomo..",
      "..omogbomo..",
      "..omoggomo..",
      "...oMMMMo...",
      "..oMMMMMMo..",
      "..oMjggjMo..",
      "..oooooooo..",
      "..qqqqqqqq..",
      "............",
    ],
  },
  {
    key: "pod-calm-1",
    width: 12,
    height: 12,
    rows: [
      "............",
      "...oo..oo...",
      "..ommmmmmo..",
      "..omgggmmo..",
      "..omobgomo..",
      "..omgggmmo..",
      "...oMMMMo...",
      "..oMMMMMMo..",
      "..oMjGgjMo..",
      "..oooooooo..",
      "..qqqqqqqq..",
      "............",
    ],
  },
];

const MACHINE_HOT: readonly PixelBitmap[] = [
  {
    key: "pod-hot-0",
    width: 12,
    height: 12,
    rows: [
      "...MM..pp...",
      "....MM..M...",
      "...oaaaao...",
      "..omaoaamo..",
      "..omaabamo..",
      "..omaoaamo..",
      "...oMMMMo...",
      "..oMMMMMMo..",
      "..oMjaajMo..",
      "..oooooooo..",
      "..qqqqqqqq..",
      "............",
    ],
  },
  {
    key: "pod-hot-1",
    width: 12,
    height: 12,
    rows: [
      "..pp..MM....",
      "...M..MM....",
      "...oAAAao...",
      "..omaaoamo..",
      "..omabaamo..",
      "..omaaoamo..",
      "...oMMMMo...",
      "..oMMMMMMo..",
      "..oMjAAjMo..",
      "..oooooooo..",
      "..qqqqqqqq..",
      "............",
    ],
  },
];

const MACHINE_RUNAWAY: readonly PixelBitmap[] = [
  {
    key: "pod-run-0",
    width: 12,
    height: 12,
    rows: [
      ".r..oooo..r.",
      "...orppao...",
      "...orrrro...",
      "..omrormmo..",
      "..omrbbrmo..",
      "..omrormmo..",
      "...oRRRRo...",
      "..oMMMMMMo..",
      "..oMjrrjMo..",
      "..oooooooo..",
      "..rrrrrrrr..",
      "............",
    ],
  },
  {
    key: "pod-run-1",
    width: 12,
    height: 12,
    rows: [
      "..a.rrrr.a..",
      "...oaaaao...",
      "...oRRRRo...",
      "..omRorRmo..",
      "..omRbbRmo..",
      "..omRorRmo..",
      "...orrrro...",
      "..oMMMMMMo..",
      "..oMjRRjMo..",
      "..oooooooo..",
      "..aaaaaaaa..",
      "............",
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

// 14x14 Clean Filing / Archive Cabinet
export const ARCHIVE_CHEST: PixelBitmap = {
  key: "archive-cab-v3",
  width: 14,
  height: 14,
  rows: [
    ".oooooooooooo.",
    "ommmmmmmmmmmmo",
    "omPPPPPPPPPPmo",
    "omPPojjjjoPPmo",
    "omPPPPPPPPPPmo",
    "oooooooooooooo",
    "omPPPPPPPPPPmo",
    "omPPojjjjoPPmo",
    "omPPPPPPPPPPmo",
    "oooooooooooooo",
    "omPPPPPPPPPPmo",
    "omPPojjjjoPPmo",
    "oooooooooooooo",
    ".qqqqqqqqqqqq.",
  ],
};

// 12x9 Sealed Parchment Envelope for flying inter-agent messages
export const ENVELOPE_SPRITE: PixelBitmap = {
  key: "envelope-v3",
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
    key: "icon-ask-3",
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
    key: "icon-fail-3",
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
    key: "icon-runaway-3",
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
    key: "icon-work-3",
    width: 10,
    height: 10,
    rows: [
      "...oooo...",
      "..oggggo..",
      ".oggpgggo.",
      "ogggppgggo",
      "oggppppggo",
      "ogggppgggo",
      ".oggpgggo.",
      "..oggggo..",
      "...oooo...",
      "..........",
    ],
  },
  ready: {
    key: "icon-ready-3",
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
    key: "icon-idle-3",
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
    key: "icon-closed-3",
    width: 10,
    height: 10,
    rows: [
      ".oooooooo.",
      "ommmmmmmmo",
      "omPPjjPPmo",
      "oooooooooo",
      "omPPPPPPmo",
      "omPPjjPPmo",
      "oooooooooo",
      "omPPPPPPmo",
      "omPPjjPPmo",
      ".oooooooo.",
    ],
  },
};
