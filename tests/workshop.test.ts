import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { encodePixelPng } from "../client/pixel-png.ts";
import { WORKBENCH_SPRITE } from "../client/workshop-art.ts";
import { buildWorkshopBackdrop, computeRoomGeometry } from "../client/workshop-backdrop.ts";
import { buildWorkshopRooms } from "../client/workshop-model.ts";
import { optimizeBrief } from "../server/optimize.ts";
import {
  agentTrees,
  attributeProcesses,
  NO_ATTRIBUTION,
  orphanedProviders,
  parseUnixProcesses,
  subtree,
} from "../server/processes.ts";
import {
  buildWindowsSnapshotScript,
  EMPTY_CPU_SAMPLE,
  parseWindowsSnapshot,
} from "../server/windows-ps.ts";
import { formatCpu, formatElapsed, formatMemory, splitCommand } from "../shared/format.ts";

const AGENT_A = "11111111-1111-1111-1111-111111111111";
const AGENT_B = "22222222-2222-2222-2222-222222222222";

describe("shared formatters", () => {
  it("formats cpu, memory, elapsed, and Windows/Unix commands", () => {
    assert.equal(formatCpu(0), "0%");
    assert.equal(formatCpu(3.45), "3.5%");
    assert.equal(formatCpu(42.7), "43%");
    assert.equal(formatMemory(512), "512 KB");
    assert.equal(formatMemory(20480), "20.0 MB");
    assert.equal(formatMemory(1536 * 1024), "1.5 GB");
    assert.equal(formatElapsed("02:15"), "2m 15s");
    assert.equal(formatElapsed("1-03:04:05"), "1d 3h");
    assert.deepEqual(splitCommand('"C:\\Program Files\\nodejs\\node.exe" server.js'), {
      name: "node.exe",
      rest: "server.js",
    });
    assert.deepEqual(splitCommand("/usr/bin/python3 -m http.server"), {
      name: "python3",
      rest: "-m http.server",
    });
  });
});

describe("unix process parsing & attribution", () => {
  it("groups processes by PASEO_AGENT_ID and detects orphaned Unix providers", () => {
    const stats = [
      "  100     1   100 S     0.1   1000 01:00 Mon Nov 24 10:00:00 2026 paseo-daemon",
      "  200   100   100 S     5.2  50000 00:30 Mon Nov 24 10:01:00 2026 claude --print",
      "  201   200   201 S    12.0  80000 00:20 Mon Nov 24 10:02:00 2026 node dev-server.js",
      "  300   100   100 S     1.0  20000 00:10 Mon Nov 24 10:03:00 2026 codex --run",
    ].join("\n");
    const envs = [
      `  200 Mon Nov 24 10:01:00 2026 claude PASEO_AGENT_ID=${AGENT_A}`,
      `  300 Mon Nov 24 10:03:00 2026 codex PASEO_AGENT_ID=${AGENT_B}`,
    ].join("\n");

    const { rows } = parseUnixProcesses(stats, envs, NO_ATTRIBUTION);
    const trees = agentTrees(rows, 100);
    assert.equal(trees.length, 2);

    const treeA = trees.find((t) => t.agentId === AGENT_A)!;
    assert.equal(treeA.rows.length, 2);
    assert.equal(treeA.rows[0]?.pid, 200);
    assert.equal(treeA.rows[1]?.pid, 201);
    assert.equal(treeA.rows[1]?.depth, 1);

    // Agent A ended: provider 200 (in daemon pgid 100) is orphaned, dev server 201 (pgid 201) is NOT.
    const states = new Map([
      [AGENT_A, "ended" as const],
      [AGENT_B, "live" as const],
    ]);
    const orphans = orphanedProviders(rows, 100, 100, states);
    assert.deepEqual(
      orphans.map((o) => o.pid),
      [200],
    );

    // Subtree of 200 includes both 200 and 201
    const sub = subtree(rows, rows.find((r) => r.pid === 200)!);
    assert.deepEqual(
      sub.map((r) => r.pid),
      [200, 201],
    );
  });
});

describe("windows process parsing & orphan detection", () => {
  it("parses Windows JSON snapshots, computes CPU% delta, and detects Windows orphans", () => {
    const script = buildWindowsSnapshotScript();
    assert.ok(script.includes("PASEO_AGENT_ID="));
    assert.ok(script.includes("NtQueryInformationProcess"));

    const t1Json = JSON.stringify([
      {
        pid: 1000,
        ppid: 1,
        started: "2026-11-24T02:00:00.000Z",
        rssKb: 10240,
        cpuMs: 500,
        elapsedSec: 600,
        command: "paseo-daemon.exe",
        agentId: null,
      },
      {
        pid: 2000,
        ppid: 1000,
        started: "2026-11-24T02:05:00.000Z",
        rssKb: 102400,
        cpuMs: 1000,
        elapsedSec: 300,
        command: "claude.exe",
        agentId: AGENT_A,
      },
      {
        pid: 2001,
        ppid: 2000,
        started: "2026-11-24T02:06:00.000Z",
        rssKb: 61440,
        cpuMs: 200,
        elapsedSec: 240,
        command: "node.exe vite",
        agentId: null,
      },
    ]);

    const s1 = parseWindowsSnapshot(t1Json, 10_000, EMPTY_CPU_SAMPLE);
    assert.equal(s1.raw.length, 3);
    assert.equal(s1.raw[1]?.cpu, 0); // First sample has no prior delta.

    // 2 seconds later: pid 2000 used 500ms of CPU (25%), pid 2001 used 1000ms (50%).
    const t2Json = JSON.stringify([
      {
        pid: 1000,
        ppid: 1,
        started: "2026-11-24T02:00:00.000Z",
        rssKb: 10240,
        cpuMs: 510,
        elapsedSec: 602,
        command: "paseo-daemon.exe",
        agentId: null,
      },
      {
        pid: 2000,
        ppid: 1000,
        started: "2026-11-24T02:05:00.000Z",
        rssKb: 102400,
        cpuMs: 1500,
        elapsedSec: 302,
        command: "claude.exe",
        agentId: AGENT_A,
      },
      {
        pid: 2001,
        ppid: 2000,
        started: "2026-11-24T02:06:00.000Z",
        rssKb: 61440,
        cpuMs: 1200,
        elapsedSec: 242,
        command: "node.exe vite",
        agentId: null,
      },
    ]);

    const s2 = parseWindowsSnapshot(t2Json, 12_000, s1.nextCpu);
    const { rows } = attributeProcesses(s2.raw, NO_ATTRIBUTION);
    const p2000 = rows.find((r) => r.pid === 2000)!;
    const p2001 = rows.find((r) => r.pid === 2001)!;
    assert.equal(p2000.cpu, 25);
    assert.equal(p2001.cpu, 50);
    assert.equal(p2001.agentId, AGENT_A); // Inherited via parent lineage!

    const states = new Map([[AGENT_A, "ended" as const]]);
    const orphans = orphanedProviders(rows, 1000, 0, states);
    assert.deepEqual(
      orphans.map((o) => o.pid),
      [2000],
    );
  });
});

describe("optimizeBrief & workshop model & pixel PNG", () => {
  it("adapts optimizeBrief measurement tool for Windows vs Unix", () => {
    const winBrief = optimizeBrief({
      agent: { id: AGENT_A, title: "Builder", cwd: "C:\\repo" },
      rows: [
        {
          pid: 2000,
          started: "2026-11-24T02:05:00.000Z",
          depth: 0,
          command: "node.exe build.js",
          cpu: 55,
          rssKb: 256 * 1024,
          elapsed: "05:00",
          detached: false,
        },
      ],
      platform: "win32",
    });
    assert.ok(winBrief.includes("Get-Process / Get-CimInstance"));
  });

  it("keeps rooms unfolded when closed agents still hold runaway processes", () => {
    const { rooms } = buildWorkshopRooms({
      agents: new Map(),
      workspaces: new Map(),
      processTrees: [
        {
          agentId: AGENT_A,
          title: "Ghost Worker",
          state: "ended",
          status: "closed",
          workspaceId: "ws-1",
          cpu: 48,
          rssKb: 600 * 1024,
          rows: [
            {
              pid: 999,
              started: "now",
              depth: 0,
              command: "node leaky.js",
              cpu: 48,
              rssKb: 600 * 1024,
              elapsed: "10:00",
              detached: true,
            },
          ],
        },
      ],
      scopeWorkspaceId: null,
      query: "",
      showClosed: false,
    });
    assert.equal(rooms.length, 1);
    assert.equal(rooms[0]?.runaways.length, 1);
    assert.equal(rooms[0]?.runaways[0]?.machineLoad, "runaway");
  });

  it("encodes valid PNG data URI for pixel sprites and room backdrop", () => {
    const uri = encodePixelPng(WORKBENCH_SPRITE, { o: "#000000", w: "#8c5a32" }, 2, "test");
    assert.ok(uri.startsWith("data:image/png;base64,iVBORw0KGgo"));
    const geom = computeRoomGeometry(3, 3);
    const bg = buildWorkshopBackdrop(geom);
    assert.equal(bg.width, geom.width);
    assert.equal(bg.height, geom.height);
    const bgUri = encodePixelPng(bg, { o: "#17110e", f: "#382b22", F: "#2e231b" }, 1, "room");
    assert.ok(bgUri.startsWith("data:image/png;base64,iVBORw0KGgo"));
  });
});
