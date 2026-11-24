// Pure data model fusing Paseo agents, workspaces, live process trees, and inter-agent messages.
import type { AgentTreeView, ProcessRowView } from "../shared/contracts.ts";
import type { PaseoAgent, PaseoWorkspace } from "./paseo-types.ts";
import type { MachineLoad, WorkshopState } from "./workshop-art.ts";

export const PARENT_LABEL = "paseo.parent-agent-id";
export const ROLE_LABEL = "ghostline/role";

export const STATE_ORDER: readonly WorkshopState[] = [
  "needs-input",
  "runaway",
  "failed",
  "working",
  "ready",
  "idle",
  "closed",
];

export const STATE_LABEL: Record<WorkshopState, string> = {
  "needs-input": "Needs you",
  runaway: "Runaway",
  failed: "Failed",
  working: "Working",
  ready: "Ready",
  idle: "Idle",
  closed: "Closed",
};

/** High load threshold for overheating mini-machine animation in the workshop. */
export const HOT_CPU_PCT = 40;
export const HOT_RSS_KB = 512 * 1024; // 512 MB

export interface WorkshopAgent {
  id: string;
  agent: PaseoAgent | null;
  processTree: AgentTreeView | null;
  state: WorkshopState;
  machineLoad: MachineLoad;
  title: string;
  modelLabel: string;
  role: string | null;
  workspaceId: string;
  workspaceName: string;
  createdAt: string;
  updatedAt: string;
  processCount: number;
  cpu: number;
  rssKb: number;
  rows: readonly ProcessRowView[];
  hasLingeringProcesses: boolean;
}

export interface WorkshopRoom {
  workspaceId: string;
  name: string;
  /** Active agents seated at benches (excludes closed without processes). */
  benches: WorkshopAgent[];
  /** Closed/archived/unknown agents that STILL hold live OS processes (runaway machines!). */
  runaways: WorkshopAgent[];
  /** Closed agents without live processes (stored in the archive chest). */
  archived: WorkshopAgent[];
  totalCpu: number;
  totalRssKb: number;
  totalProcesses: number;
  needsAttention: boolean;
}

export function classifyAgentState(
  agent: PaseoAgent | null,
  tree: AgentTreeView | null,
): WorkshopState {
  const hasProcs = Boolean(tree && tree.rows.length > 0);
  if (!agent) {
    return hasProcs ? "runaway" : "closed";
  }
  if (agent.archivedAt || agent.status === "closed") {
    return hasProcs ? "runaway" : "closed";
  }
  if (agent.pendingPermissions.length > 0 || agent.attentionReason === "permission") {
    return "needs-input";
  }
  if (agent.status === "error" || agent.attentionReason === "error") {
    return "failed";
  }
  if (agent.status === "running" || agent.status === "initializing") {
    return "working";
  }
  if (agent.requiresAttention && agent.attentionReason === "finished") {
    return "ready";
  }
  return "idle";
}

export function classifyMachineLoad(state: WorkshopState, tree: AgentTreeView | null): MachineLoad {
  if (!tree || tree.rows.length === 0) return "none";
  if (state === "runaway") return "runaway";
  if (tree.cpu >= HOT_CPU_PCT || tree.rssKb >= HOT_RSS_KB) return "hot";
  return "calm";
}

export function workspaceDisplayName(
  workspaceId: string,
  workspaces: ReadonlyMap<string, PaseoWorkspace>,
): string {
  const ws = workspaces.get(workspaceId);
  if (ws) return `${ws.projectDisplayName} · ${ws.name}`;
  return workspaceId ? workspaceId.slice(0, 8) : "Unassigned";
}

export function displayAgentTitle(agent: PaseoAgent | null, tree: AgentTreeView | null): string {
  const title = agent?.title?.trim() || tree?.title?.trim();
  if (title) return title;
  if (agent) return `${agent.provider} · ${agent.id.slice(0, 7)}`;
  if (tree) return `Ended · ${tree.agentId.slice(0, 7)}`;
  return "Agent";
}

export function matchesQuery(item: WorkshopAgent, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const hay = [
    item.title,
    item.id,
    item.modelLabel,
    item.workspaceName,
    item.role ?? "",
    item.agent?.cwd ?? "",
    ...item.rows.map((r) => `${r.pid} ${r.command}`),
  ]
    .join("\n")
    .toLowerCase();
  return hay.includes(needle);
}

/**
 * Merge Paseo's live agent directory with daemon process trees into per-workspace workshop rooms.
 * - Closed/archived agents that STILL hold processes become `runaways` and force their room open.
 * - Workspaces whose agents are ALL closed with zero processes stay folded unless `showClosed` or `query` is active.
 */
export function buildWorkshopRooms(input: {
  agents: ReadonlyMap<string, PaseoAgent>;
  workspaces: ReadonlyMap<string, PaseoWorkspace>;
  processTrees: readonly AgentTreeView[];
  scopeWorkspaceId: string | null;
  query: string;
  showClosed: boolean;
}): { rooms: WorkshopRoom[]; allItems: WorkshopAgent[] } {
  const treeById = new Map<string, AgentTreeView>(
    input.processTrees.map((tree) => [tree.agentId, tree]),
  );
  const allIds = new Set<string>([...input.agents.keys(), ...treeById.keys()]);
  const allItems: WorkshopAgent[] = [];

  for (const id of allIds) {
    const agent = input.agents.get(id) ?? null;
    const tree = treeById.get(id) ?? null;
    // Skip archived agents that have zero running processes.
    if (agent?.archivedAt && (!tree || tree.rows.length === 0)) continue;

    const workspaceId = agent?.workspaceId ?? tree?.workspaceId ?? "";
    if (input.scopeWorkspaceId !== null && workspaceId !== input.scopeWorkspaceId) continue;

    const state = classifyAgentState(agent, tree);
    const machineLoad = classifyMachineLoad(state, tree);
    const wsName = workspaceDisplayName(workspaceId, input.workspaces);

    const item: WorkshopAgent = {
      id,
      agent,
      processTree: tree,
      state,
      machineLoad,
      title: displayAgentTitle(agent, tree),
      modelLabel: agent ? (agent.model ? `${agent.provider}/${agent.model}` : agent.provider) : "ended",
      role: agent?.labels[ROLE_LABEL] ?? null,
      workspaceId,
      workspaceName: wsName,
      createdAt: agent?.createdAt ?? "",
      updatedAt: agent?.attentionTimestamp ?? agent?.updatedAt ?? "",
      processCount: tree?.rows.length ?? 0,
      cpu: tree?.cpu ?? 0,
      rssKb: tree?.rssKb ?? 0,
      rows: tree?.rows ?? [],
      hasLingeringProcesses: state === "runaway",
    };

    if (!matchesQuery(item, input.query)) continue;
    allItems.push(item);
  }

  const byWorkspace = new Map<string, WorkshopAgent[]>();
  for (const item of allItems) {
    const bucket = byWorkspace.get(item.workspaceId) ?? [];
    bucket.push(item);
    byWorkspace.set(item.workspaceId, bucket);
  }

  // Always include the scoped workspace even if empty so the panel shows a cozy empty room.
  if (input.scopeWorkspaceId !== null && !byWorkspace.has(input.scopeWorkspaceId)) {
    byWorkspace.set(input.scopeWorkspaceId, []);
  }

  const hasQuery = input.query.trim().length > 0;
  const rooms: WorkshopRoom[] = [];

  for (const [workspaceId, items] of byWorkspace) {
    const benches = items
      .filter((i) => i.state !== "closed" && i.state !== "runaway")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    const runaways = items
      .filter((i) => i.state === "runaway")
      .sort((a, b) => b.rssKb - a.rssKb || a.id.localeCompare(b.id));
    const archived = items
      .filter((i) => i.state === "closed")
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));

    // Fold workspaces that only contain closed agents with no processes, unless scoped/filtered.
    if (
      input.scopeWorkspaceId === null &&
      benches.length === 0 &&
      runaways.length === 0 &&
      !input.showClosed &&
      !hasQuery
    ) {
      continue;
    }

    const totalCpu = items.reduce((sum, i) => sum + i.cpu, 0);
    const totalRssKb = items.reduce((sum, i) => sum + i.rssKb, 0);
    const totalProcesses = items.reduce((sum, i) => sum + i.processCount, 0);
    const needsAttention =
      runaways.length > 0 ||
      benches.some((i) => i.state === "needs-input" || i.state === "failed");

    rooms.push({
      workspaceId,
      name: workspaceDisplayName(workspaceId, input.workspaces),
      benches,
      runaways,
      archived,
      totalCpu,
      totalRssKb,
      totalProcesses,
      needsAttention,
    });
  }

  // Rooms needing attention or with runaway processes float to the top.
  rooms.sort((a, b) => {
    const aRun = a.runaways.length > 0 ? 0 : a.needsAttention ? 1 : 2;
    const bRun = b.runaways.length > 0 ? 0 : b.needsAttention ? 1 : 2;
    if (aRun !== bRun) return aRun - bRun;
    return b.benches.length - a.benches.length || a.name.localeCompare(b.name);
  });

  // Sort flat list by urgency (needs-input -> runaway -> failed -> working -> ready -> idle -> closed).
  allItems.sort((a, b) => {
    const rank = STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state);
    if (rank !== 0) return rank;
    return b.rssKb - a.rssKb || a.id.localeCompare(b.id);
  });

  return { rooms, allItems };
}
