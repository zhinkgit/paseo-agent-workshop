// Pure data model fusing Paseo agents, workspaces, live process trees, and agent-to-agent calls.
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
  "needs-input": "待审批",
  runaway: "失控残留",
  failed: "异常",
  working: "运行中",
  ready: "已完成",
  idle: "空闲",
  closed: "已关闭",
};

export const HOT_CPU_PCT = 40;
export const HOT_RSS_KB = 512 * 1024; // 512 MB

export interface DelegationLink {
  fromId: string;
  toId: string;
  fromTitle: string;
  toTitle: string;
  sameRoom: boolean;
}

export interface WorkshopAgent {
  id: string;
  agent: PaseoAgent | null;
  processTree: AgentTreeView | null;
  state: WorkshopState;
  machineLoad: MachineLoad;
  title: string;
  modelLabel: string;
  role: string | null;
  parentAgentId: string | null;
  /** Titles of child agents spawned/called by this agent. */
  callingTargets: Array<{ id: string; title: string; state: WorkshopState }>;
  workspaceId: string;
  projectName: string;
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
  /** Short project name (displayed cleanly on top wall plaque). */
  projectName: string;
  /** Workspace / branch title (displayed separately so nothing truncates awkwardly). */
  workspaceTitle: string;
  /** Combined fallback name for search/list. */
  name: string;
  benches: WorkshopAgent[];
  runaways: WorkshopAgent[];
  archived: WorkshopAgent[];
  /** Parent -> Child agent calls involving agents in this room. */
  delegations: DelegationLink[];
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

export function workspaceParts(
  workspaceId: string,
  workspaces: ReadonlyMap<string, PaseoWorkspace>,
): { projectName: string; workspaceTitle: string; fullName: string } {
  const ws = workspaces.get(workspaceId);
  if (ws) {
    const projectName = ws.projectDisplayName?.trim() || "工作区";
    const workspaceTitle = ws.name?.trim() || "";
    const fullName =
      workspaceTitle && workspaceTitle !== projectName
        ? `${projectName} · ${workspaceTitle}`
        : projectName;
    return { projectName, workspaceTitle: workspaceTitle || projectName, fullName };
  }
  if (workspaceId) {
    const short = workspaceId.slice(0, 8);
    return { projectName: short, workspaceTitle: short, fullName: short };
  }
  return { projectName: "未分配", workspaceTitle: "未分配工作区", fullName: "未分配" };
}

export function displayAgentTitle(agent: PaseoAgent | null, tree: AgentTreeView | null): string {
  const title = agent?.title?.trim() || tree?.title?.trim();
  if (title) return title;
  if (agent) return `${agent.provider} · ${agent.id.slice(0, 7)}`;
  if (tree) return `已结束 · ${tree.agentId.slice(0, 7)}`;
  return "智能体";
}

export function matchesQuery(item: WorkshopAgent, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const hay = [
    item.title,
    item.id,
    item.modelLabel,
    item.projectName,
    item.workspaceName,
    item.role ?? "",
    item.agent?.cwd ?? "",
    ...item.rows.map((r) => `${r.pid} ${r.command}`),
  ]
    .join("\n")
    .toLowerCase();
  return hay.includes(needle);
}

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
  const rawItems: WorkshopAgent[] = [];

  for (const id of allIds) {
    const agent = input.agents.get(id) ?? null;
    const tree = treeById.get(id) ?? null;
    if (agent?.archivedAt && (!tree || tree.rows.length === 0)) continue;

    const workspaceId = agent?.workspaceId ?? tree?.workspaceId ?? "";
    const state = classifyAgentState(agent, tree);
    const machineLoad = classifyMachineLoad(state, tree);
    const parts = workspaceParts(workspaceId, input.workspaces);

    rawItems.push({
      id,
      agent,
      processTree: tree,
      state,
      machineLoad,
      title: displayAgentTitle(agent, tree),
      modelLabel: agent ? (agent.model ? `${agent.provider}/${agent.model}` : agent.provider) : "已结束",
      role: agent?.labels[ROLE_LABEL] ?? null,
      parentAgentId: agent?.labels[PARENT_LABEL] || null,
      callingTargets: [],
      workspaceId,
      projectName: parts.projectName,
      workspaceName: parts.fullName,
      createdAt: agent?.createdAt ?? "",
      updatedAt: agent?.attentionTimestamp ?? agent?.updatedAt ?? "",
      processCount: tree?.rows.length ?? 0,
      cpu: tree?.cpu ?? 0,
      rssKb: tree?.rssKb ?? 0,
      rows: tree?.rows ?? [],
      hasLingeringProcesses: state === "runaway",
    });
  }

  // Wire parent -> child delegation links across all known agents before filtering by workspace.
  const byId = new Map(rawItems.map((item) => [item.id, item]));
  for (const child of rawItems) {
    if (!child.parentAgentId) continue;
    const parent = byId.get(child.parentAgentId);
    if (!parent) continue;
    if (child.state === "closed") continue;
    parent.callingTargets.push({ id: child.id, title: child.title, state: child.state });
  }

  const allItems = rawItems.filter((item) => {
    if (input.scopeWorkspaceId !== null && item.workspaceId !== input.scopeWorkspaceId) return false;
    return matchesQuery(item, input.query);
  });

  const byWorkspace = new Map<string, WorkshopAgent[]>();
  for (const item of allItems) {
    const bucket = byWorkspace.get(item.workspaceId) ?? [];
    bucket.push(item);
    byWorkspace.set(item.workspaceId, bucket);
  }

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

    if (
      input.scopeWorkspaceId === null &&
      benches.length === 0 &&
      runaways.length === 0 &&
      !input.showClosed &&
      !hasQuery
    ) {
      continue;
    }

    const roomIds = new Set([...benches, ...runaways].map((i) => i.id));
    const delegations: DelegationLink[] = [];
    for (const item of [...benches, ...runaways]) {
      for (const target of item.callingTargets) {
        delegations.push({
          fromId: item.id,
          toId: target.id,
          fromTitle: item.title,
          toTitle: target.title,
          sameRoom: roomIds.has(target.id),
        });
      }
    }

    const parts = workspaceParts(workspaceId, input.workspaces);
    const totalCpu = items.reduce((sum, i) => sum + i.cpu, 0);
    const totalRssKb = items.reduce((sum, i) => sum + i.rssKb, 0);
    const totalProcesses = items.reduce((sum, i) => sum + i.processCount, 0);
    const needsAttention =
      runaways.length > 0 ||
      benches.some((i) => i.state === "needs-input" || i.state === "failed");

    rooms.push({
      workspaceId,
      projectName: parts.projectName,
      workspaceTitle: parts.workspaceTitle,
      name: parts.fullName,
      benches,
      runaways,
      archived,
      delegations,
      totalCpu,
      totalRssKb,
      totalProcesses,
      needsAttention,
    });
  }

  rooms.sort((a, b) => {
    const aRun = a.runaways.length > 0 ? 0 : a.needsAttention ? 1 : 2;
    const bRun = b.runaways.length > 0 ? 0 : b.needsAttention ? 1 : 2;
    if (aRun !== bRun) return aRun - bRun;
    return b.benches.length - a.benches.length || a.name.localeCompare(b.name);
  });

  allItems.sort((a, b) => {
    const rank = STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state);
    if (rank !== 0) return rank;
    return b.rssKb - a.rssKb || a.id.localeCompare(b.id);
  });

  return { rooms, allItems };
}
