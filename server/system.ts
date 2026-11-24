// Platform-adaptive process table reader and signal/termination driver (Linux, macOS, Windows).
import { execFile } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import type { PluginHandlerContext } from "@getpaseo/plugin/server";
import type { ProcessIdentity } from "../shared/contracts";
import { parseUnixRawProcesses, type AgentState, type ProcessRow, type RawProcess } from "./processes";
import {
  buildWindowsSnapshotScript,
  buildWindowsStartedAtScript,
  EMPTY_CPU_SAMPLE,
  parseWindowsSnapshot,
  type CpuSampleState,
} from "./windows-ps";

type Paseo = PluginHandlerContext["paseo"];

const TERM_GRACE_MS = 10_000;
const run = promisify(execFile);
const PS_OPTIONS = { maxBuffer: 64 * 1024 * 1024, env: { ...process.env, LC_ALL: "C" } };
const WINDOWS_SCRIPT = buildWindowsSnapshotScript();

/** The plugin subprocess is a child of the Paseo daemon, which also parents provider processes. */
export const daemonPid = process.ppid;

export const platformKind: "linux" | "darwin" | "win32" | "other" =
  process.platform === "linux" || process.platform === "darwin" || process.platform === "win32"
    ? process.platform
    : "other";

let windowsCpuState: CpuSampleState = EMPTY_CPU_SAMPLE;

export async function readRawProcessTable(): Promise<RawProcess[]> {
  if (process.platform === "win32") {
    const encoded = Buffer.from(WINDOWS_SCRIPT, "utf16le").toString("base64");
    const { stdout } = await run(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded],
      { maxBuffer: 64 * 1024 * 1024, windowsHide: true },
    );
    const parsed = parseWindowsSnapshot(stdout, Date.now(), windowsCpuState);
    windowsCpuState = parsed.nextCpu;
    return parsed.raw;
  }

  const [stats, environments] = await Promise.all([
    run("ps", ["-ww", "-A", "-o", "pid=,ppid=,pgid=,stat=,pcpu=,rss=,etime=,lstart=,command="], PS_OPTIONS),
    run("ps", ["eww", "-A", "-o", "pid=,lstart=,command="], PS_OPTIONS),
  ]);
  return parseUnixRawProcesses(stats.stdout, environments.stdout);
}

export interface AgentInfo {
  state: AgentState;
  status: string | null;
  title: string | null;
  workspaceId: string | null;
}

export async function readAgents(paseo: Paseo, rows: readonly ProcessRow[]): Promise<Map<string, AgentInfo>> {
  const ids = new Set(rows.flatMap((row) => (row.agentId ? [row.agentId] : [])));
  const entries = await Promise.all(
    [...ids].map(async (agentId): Promise<[string, AgentInfo]> => {
      try {
        const result = await paseo.agents.ref(agentId).refresh();
        if (!result) return [agentId, { state: "ended", status: null, title: null, workspaceId: null }];
        const { status, archivedAt, title, workspaceId } = result.agent;
        const ended = status === "closed" || Boolean(archivedAt);
        return [
          agentId,
          { state: ended ? "ended" : "live", status, title: title ?? null, workspaceId: workspaceId ?? null },
        ];
      } catch (error) {
        console.error(`agent ${agentId}: state unknown`, error);
        return [agentId, { state: "unknown", status: null, title: null, workspaceId: null }];
      }
    }),
  );
  return new Map(entries);
}

/** Sends a graceful termination request and returns the targets that were still alive. */
export async function terminate(targets: readonly ProcessIdentity[]): Promise<ProcessIdentity[]> {
  if (process.platform === "win32") {
    const signalled: ProcessIdentity[] = [];
    for (const target of targets) {
      try {
        await run("taskkill", ["/PID", String(target.pid), "/T"], { windowsHide: true });
        signalled.push(target);
      } catch {
        // Already exited or refused graceful close; still check in killSurvivors if alive.
        const currentStart = await startedAt(target.pid);
        if (currentStart && currentStart === target.started) {
          signalled.push(target);
        }
      }
    }
    return signalled;
  }
  return targets.filter((target) => sendUnix(target.pid, "SIGTERM"));
}

/** Force-kills whatever still runs (with the exact same start timestamp) after the grace period. */
export async function killSurvivors(signalled: readonly ProcessIdentity[], signal: AbortSignal): Promise<void> {
  if (signalled.length === 0) return;
  await delay(TERM_GRACE_MS, undefined, { signal });
  for (const target of signalled) {
    if ((await startedAt(target.pid)) !== target.started) continue;
    console.log(`process ${target.pid} ignored graceful stop; force killing`);
    if (process.platform === "win32") {
      try {
        await run("taskkill", ["/PID", String(target.pid), "/T", "/F"], { windowsHide: true });
      } catch {
        // Exited right before force kill.
      }
    } else {
      sendUnix(target.pid, "SIGKILL");
    }
  }
}

async function startedAt(pid: number): Promise<string | null> {
  if (process.platform === "win32") {
    try {
      const encoded = Buffer.from(buildWindowsStartedAtScript(pid), "utf16le").toString("base64");
      const { stdout } = await run(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded],
        { windowsHide: true },
      );
      return stdout.trim() || null;
    } catch {
      return null;
    }
  }
  try {
    const { stdout } = await run("ps", ["-o", "lstart=", "-p", String(pid)], PS_OPTIONS);
    return stdout.trim().replace(/\s+/g, " ") || null;
  } catch (error) {
    if ((error as { code?: unknown }).code === 1) return null;
    throw error;
  }
}

function sendUnix(pid: number, signal: NodeJS.Signals | 0): boolean {
  try {
    process.kill(pid, signal);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
    throw error;
  }
}
