// Pure core: cross-platform process attribution, tree construction, and orphan detection.
// Paseo sets PASEO_AGENT_ID on each provider process it launches and descendants inherit it.
// Attribution persists across reads via (pid, started) keys, ancestor lineage, and (on Unix) pgid.

export interface RawProcess {
  pid: number;
  ppid: number;
  /** On Unix this is the POSIX process group ID; on Windows it is 0. */
  pgid: number;
  /** Process start timestamp string; combined with pid to prevent PID reuse mismatches. */
  started: string;
  cpu: number;
  rssKb: number;
  elapsed: string;
  command: string;
  /** Direct PASEO_AGENT_ID tag if observed in the process environment. */
  taggedAgentId: string | null;
}

export interface ProcessRow {
  pid: number;
  ppid: number;
  pgid: number;
  started: string;
  cpu: number;
  rssKb: number;
  elapsed: string;
  command: string;
  agentId: string | null;
}

export type AgentState = "live" | "ended" | "unknown";

export interface TreeRow {
  pid: number;
  started: string;
  depth: number;
  command: string;
  cpu: number;
  rssKb: number;
  elapsed: string;
  /** Root whose parent is neither the daemon nor another process of the same agent. */
  detached: boolean;
}

export interface AgentTree {
  agentId: string;
  rows: TreeRow[];
  cpu: number;
  rssKb: number;
}

export interface Attribution {
  /** Known agent per `pid@started` key. */
  processes: ReadonlyMap<string, string>;
  /** Known agent per Unix process group ID (pgid > 0). */
  groups: ReadonlyMap<number, { agentId: string; leader: string }>;
}

export const NO_ATTRIBUTION: Attribution = { processes: new Map(), groups: new Map() };

const AGENT_ID = /\bPASEO_AGENT_ID=([0-9a-f-]{36})\b/i;
const STARTED = String.raw`(\w{3}\s+\w{3}\s+\d+\s+\d\d:\d\d:\d\d\s+\d{4})`;
const UNIX_ROW = new RegExp(
  String.raw`^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+([\d.]+)\s+(\d+)\s+(\S+)\s+${STARTED}\s+(.*)$`,
);
const UNIX_ENV_ROW = new RegExp(String.raw`^\s*(\d+)\s+${STARTED}\s`);

export function processKey(row: { pid: number; started: string }): string {
  return `${row.pid}@${row.started}`;
}

function oneSpaced(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function extractAgentId(text: string): string | null {
  return AGENT_ID.exec(text)?.[1]?.toLowerCase() ?? null;
}

/**
 * Parse Unix `ps -ww -A ...` and `ps eww -A ...` outputs into RawProcess records.
 */
export function parseUnixRawProcesses(stats: string, environments: string): RawProcess[] {
  const tagged = new Map<string, string>();
  for (const line of environments.split("\n")) {
    const fields = UNIX_ENV_ROW.exec(line);
    const agentId = extractAgentId(line);
    if (fields?.[1] && fields[2] && agentId) {
      tagged.set(processKey({ pid: Number(fields[1]), started: oneSpaced(fields[2]) }), agentId);
    }
  }
  const out: RawProcess[] = [];
  for (const line of stats.split("\n")) {
    const fields = UNIX_ROW.exec(line);
    if (!fields || fields[4]?.startsWith("Z")) continue;
    const pid = Number(fields[1]);
    const started = oneSpaced(fields[8] ?? "");
    out.push({
      pid,
      ppid: Number(fields[2]),
      pgid: Number(fields[3]),
      cpu: Number(fields[5]),
      rssKb: Number(fields[6]),
      elapsed: fields[7] ?? "",
      started,
      command: fields[9] ?? "",
      taggedAgentId: tagged.get(processKey({ pid, started })) ?? null,
    });
  }
  return out;
}

/**
 * Attribute raw processes to Paseo agents using direct env tags, prior read memory,
 * ancestor lineage, and (on Unix where pgid > 0) process group inheritance.
 */
export function attributeProcesses(
  raw: readonly RawProcess[],
  before: Attribution = NO_ATTRIBUTION,
): { rows: ProcessRow[]; attribution: Attribution } {
  const byPid = new Map(raw.map((row) => [row.pid, row]));
  const lineage = new Map<number, string | null>();

  const lineageOf = (start: number): string | null => {
    const path: number[] = [];
    let found: string | null = null;
    for (
      let row = byPid.get(start);
      row && !lineage.has(row.pid) && !path.includes(row.pid);
      row = byPid.get(row.ppid)
    ) {
      path.push(row.pid);
      const key = processKey(row);
      found = row.taggedAgentId ?? before.processes.get(key) ?? null;
      if (found) break;
    }
    const last = path.at(-1);
    if (!found && last !== undefined) {
      found = lineage.get(byPid.get(last)?.ppid ?? -1) ?? null;
    }
    for (const pid of path) lineage.set(pid, found);
    return lineage.get(start) ?? null;
  };

  const groups = new Map<number, { agentId: string; leader: string }>();
  for (const [pgid, group] of before.groups) {
    if (pgid <= 0) continue;
    const leader = byPid.get(pgid);
    if (!leader || processKey(leader) === group.leader) groups.set(pgid, group);
  }
  for (const row of raw) {
    if (row.pgid <= 0) continue;
    const agentId = row.pid === row.pgid ? lineageOf(row.pid) : null;
    if (agentId) groups.set(row.pgid, { agentId, leader: processKey(row) });
  }

  const rows: ProcessRow[] = raw.map((row) => ({
    pid: row.pid,
    ppid: row.ppid,
    pgid: row.pgid,
    started: row.started,
    cpu: row.cpu,
    rssKb: row.rssKb,
    elapsed: row.elapsed,
    command: row.command,
    agentId: lineageOf(row.pid) ?? (row.pgid > 0 ? groups.get(row.pgid)?.agentId ?? null : null),
  }));

  const liveGroups = new Set(rows.filter((row) => row.pgid > 0).map((row) => row.pgid));
  return {
    rows,
    attribution: {
      processes: new Map(
        rows.flatMap((row) => (row.agentId ? [[processKey(row), row.agentId] as const] : [])),
      ),
      groups: new Map([...groups].filter(([pgid]) => liveGroups.has(pgid))),
    },
  };
}

/** Convenience helper for Unix `ps` outputs. */
export function parseUnixProcesses(
  stats: string,
  environments: string,
  before: Attribution = NO_ATTRIBUTION,
): { rows: ProcessRow[]; attribution: Attribution } {
  return attributeProcesses(parseUnixRawProcesses(stats, environments), before);
}

/** Build one depth-first process tree per agent, provider process directly under daemon first. */
export function agentTrees(rows: readonly ProcessRow[], daemonPid: number): AgentTree[] {
  const byAgent = new Map<string, ProcessRow[]>();
  for (const row of rows) {
    if (!row.agentId) continue;
    const list = byAgent.get(row.agentId) ?? [];
    list.push(row);
    byAgent.set(row.agentId, list);
  }
  return [...byAgent].map(([agentId, own]) => {
    const pids = new Set(own.map((row) => row.pid));
    const roots = own
      .filter((row) => !pids.has(row.ppid))
      .sort((a, b) => Number(b.ppid === daemonPid) - Number(a.ppid === daemonPid) || a.pid - b.pid);
    const ordered: TreeRow[] = [];
    const visit = (row: ProcessRow, depth: number) => {
      ordered.push({
        pid: row.pid,
        started: row.started,
        depth,
        command: row.command,
        cpu: row.cpu,
        rssKb: row.rssKb,
        elapsed: row.elapsed,
        detached: depth === 0 && row.ppid !== daemonPid,
      });
      for (const child of own.filter((c) => c.ppid === row.pid).sort((a, b) => a.pid - b.pid)) {
        visit(child, depth + 1);
      }
    };
    for (const root of roots) visit(root, 0);
    return {
      agentId,
      rows: ordered,
      cpu: own.reduce((sum, row) => sum + row.cpu, 0),
      rssKb: own.reduce((sum, row) => sum + row.rssKb, 0),
    };
  });
}

/**
 * Detect orphaned provider processes whose owning agent has ended.
 * - On Unix (`daemonGroup > 0`): matches roots in the daemon's process group (leaving tool-call dev servers alone).
 * - On Windows (`daemonGroup === 0`): matches direct children of `daemonPid` whose owning agent has ended.
 */
export function orphanedProviders(
  rows: readonly ProcessRow[],
  daemonPid: number,
  daemonGroup: number,
  states: ReadonlyMap<string, AgentState>,
): ProcessRow[] {
  const agentOf = new Map(rows.map((row) => [row.pid, row.agentId]));
  return rows.filter((row) => {
    if (!row.agentId) return false;
    if (states.get(row.agentId) !== "ended") return false;
    if (agentOf.get(row.ppid) === row.agentId) return false;
    if (daemonGroup > 0) {
      return row.pgid === daemonGroup;
    }
    return row.ppid === daemonPid;
  });
}

/** The process and everything below it, parents before children. */
export function subtree(rows: readonly ProcessRow[], root: ProcessRow): ProcessRow[] {
  const found: ProcessRow[] = [root];
  const seen = new Set<number>([root.pid]);
  for (let i = 0; i < found.length; i++) {
    const current = found[i];
    if (!current) continue;
    for (const row of rows) {
      if (row.ppid === current.pid && !seen.has(row.pid)) {
        seen.add(row.pid);
        found.push(row);
      }
    }
  }
  return found;
}

/** A process and its descendants from a depth-first tree, re-rooted at depth 0. */
export function subtreeRows(rows: readonly TreeRow[], pid: number): TreeRow[] {
  const start = rows.findIndex((row) => row.pid === pid);
  const root = rows[start];
  if (!root) return [];
  const end = rows.findIndex((row, i) => i > start && row.depth <= root.depth);
  return rows
    .slice(start, end === -1 ? undefined : end)
    .map((row) => ({ ...row, depth: row.depth - root.depth }));
}
