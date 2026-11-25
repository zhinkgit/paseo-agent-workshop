// Platform-adaptive process table reader and reliable termination driver (Linux, macOS, Windows).
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

const CONFIRM_WAIT_MS = 350;
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

export interface TerminateOutcome {
  signalled: ProcessIdentity[];
  stopped: ProcessIdentity[];
  stillRunning: ProcessIdentity[];
  failed: Array<{ target: ProcessIdentity; error: string }>;
}

function errorText(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { stderr?: string; stdout?: string; message?: string; code?: string | number };
    const detail = (e.stderr || e.stdout || e.message || "").trim();
    if (detail) return detail.split(/\r?\n/)[0] ?? detail;
    if (e.code !== undefined) return `exit ${e.code}`;
  }
  return String(err);
}

/**
 * Stops target processes reliably across Unix and Windows:
 * - Verifies `startedAt(pid) === target.started` before signalling to prevent PID reuse.
 * - On Windows, attempts `taskkill /PID <pid> /T` and immediately falls back to `/F` when a
 *   headless/CLI process refuses graceful WM_CLOSE (which is standard for Node/CLI children).
 * - On Unix, sends `SIGTERM` per target without letting one `EPERM` abort the rest.
 * - Waits briefly (`CONFIRM_WAIT_MS`) to report accurately which targets already exited vs still run.
 */
export async function terminate(targets: readonly ProcessIdentity[]): Promise<TerminateOutcome> {
  const signalled: ProcessIdentity[] = [];
  const failed: Array<{ target: ProcessIdentity; error: string }> = [];

  for (const target of targets) {
    const currentStart = await startedAt(target.pid);
    if (!currentStart || currentStart !== target.started) continue;

    if (process.platform === "win32") {
      try {
        await run("taskkill", ["/PID", String(target.pid), "/T"], { windowsHide: true });
        signalled.push(target);
      } catch {
        // Console / Node / headless processes on Windows reject graceful taskkill without /F.
        const stillSame = (await startedAt(target.pid)) === target.started;
        if (!stillSame) {
          signalled.push(target);
          continue;
        }
        try {
          await run("taskkill", ["/PID", String(target.pid), "/T", "/F"], { windowsHide: true });
          signalled.push(target);
        } catch (forceErr) {
          const aliveAfterForce = (await startedAt(target.pid)) === target.started;
          if (!aliveAfterForce) {
            signalled.push(target);
          } else {
            failed.push({ target, error: errorText(forceErr) });
          }
        }
      }
    } else {
      const sent = sendUnix(target.pid, "SIGTERM");
      if (sent.ok) {
        if (sent.existed) signalled.push(target);
      } else {
        failed.push({ target, error: sent.error });
      }
    }
  }

  if (signalled.length === 0) {
    return { signalled, stopped: [], stillRunning: [], failed };
  }

  // Short confirmation window so fast-exiting processes immediately report as stopped.
  await delay(CONFIRM_WAIT_MS);
  const stopped: ProcessIdentity[] = [];
  const stillRunning: ProcessIdentity[] = [];
  for (const target of signalled) {
    const currentStart = await startedAt(target.pid);
    if (!currentStart || currentStart !== target.started) {
      stopped.push(target);
    } else {
      stillRunning.push(target);
    }
  }

  return { signalled, stopped, stillRunning, failed };
}

/**
 * After the grace period, force-kills any surviving targets AND any newly spawned descendants
 * discovered by the optional `rescan` callback.
 */
export async function killSurvivors(
  initialSurvivors: readonly ProcessIdentity[],
  signal: AbortSignal,
  rescan?: () => Promise<ProcessIdentity[]>,
): Promise<void> {
  if (initialSurvivors.length === 0) return;
  await delay(TERM_GRACE_MS, undefined, { signal });

  const merged = new Map<string, ProcessIdentity>();
  for (const t of initialSurvivors) merged.set(`${t.pid}@${t.started}`, t);
  if (rescan) {
    try {
      for (const extra of await rescan()) {
        merged.set(`${extra.pid}@${extra.started}`, extra);
      }
    } catch (err) {
      console.error("rescan before force-kill failed:", err);
    }
  }

  for (const target of merged.values()) {
    if ((await startedAt(target.pid)) !== target.started) continue;
    console.log(`process ${target.pid} still running after grace period; force killing`);
    if (process.platform === "win32") {
      try {
        await run("taskkill", ["/PID", String(target.pid), "/T", "/F"], { windowsHide: true });
      } catch (err) {
        console.error(`force taskkill failed for pid ${target.pid}: ${errorText(err)}`);
      }
    } else {
      const res = sendUnix(target.pid, "SIGKILL");
      if (!res.ok) console.error(`SIGKILL failed for pid ${target.pid}: ${res.error}`);
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

function sendUnix(
  pid: number,
  signal: NodeJS.Signals | 0,
): { ok: true; existed: boolean } | { ok: false; error: string } {
  try {
    process.kill(pid, signal);
    return { ok: true, existed: true };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ESRCH") return { ok: true, existed: false };
    return { ok: false, error: code ? `${code}: ${errorText(error)}` : errorText(error) };
  }
}
