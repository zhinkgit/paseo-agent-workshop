// Live subscription to Paseo agents and workspaces for the current host.
import { useCallback, useEffect, useRef, useState } from "react";
import type { PaseoAgent, PaseoApi, PaseoWorkspace } from "./paseo-types";

const PAGE_LIMIT = 200;
const MAX_PAGES = 10;
const BACKSTOP_MS = 5 * 60_000;

export interface DirectoryState {
  agents: ReadonlyMap<string, PaseoAgent>;
  workspaces: ReadonlyMap<string, PaseoWorkspace>;
  phase: "loading" | "ready" | "error";
  error: string | null;
  reload: () => void;
}

export async function fetchAllAgents(paseo: PaseoApi): Promise<Map<string, PaseoAgent>> {
  const agents = new Map<string, PaseoAgent>();
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await paseo.agents.list({
      filter: { includeArchived: false },
      sort: [{ key: "updated_at", direction: "desc" }],
      page: { limit: PAGE_LIMIT, ...(cursor ? { cursor } : {}) },
    });
    for (const entry of res.entries) agents.set(entry.agent.id, entry.agent);
    if (!res.pageInfo.hasMore || !res.pageInfo.nextCursor) break;
    cursor = res.pageInfo.nextCursor;
  }
  return agents;
}

export async function fetchAllWorkspaces(paseo: PaseoApi): Promise<Map<string, PaseoWorkspace>> {
  const workspaces = new Map<string, PaseoWorkspace>();
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await paseo.workspaces.list({
      page: { limit: PAGE_LIMIT, ...(cursor ? { cursor } : {}) },
    });
    for (const ws of res.entries) workspaces.set(ws.id, ws);
    if (!res.pageInfo.hasMore || !res.pageInfo.nextCursor) break;
    cursor = res.pageInfo.nextCursor;
  }
  return workspaces;
}

export function useDirectory(paseo: PaseoApi): DirectoryState {
  const [agents, setAgents] = useState<ReadonlyMap<string, PaseoAgent>>(() => new Map());
  const [workspaces, setWorkspaces] = useState<ReadonlyMap<string, PaseoWorkspace>>(() => new Map());
  const [phase, setPhase] = useState<DirectoryState["phase"]>("loading");
  const [error, setError] = useState<string | null>(null);
  const reloadRef = useRef<() => void>(() => {});

  useEffect(() => {
    let alive = true;
    let generation = 0;
    let wsTimer: ReturnType<typeof setTimeout> | null = null;
    let agentFeedSub: { release(): Promise<void> } | null = null;

    const load = () => {
      const run = ++generation;
      void Promise.all([fetchAllAgents(paseo), fetchAllWorkspaces(paseo)])
        .then(([nextAgents, nextWorkspaces]) => {
          if (!alive || run !== generation) return;
          setAgents(nextAgents);
          setWorkspaces(nextWorkspaces);
          setError(null);
          setPhase("ready");
        })
        .catch((cause) => {
          if (!alive || run !== generation) return;
          setError(cause instanceof Error ? cause.message : String(cause));
          setPhase((prev) => (prev === "ready" ? "ready" : "error"));
        });
    };

    reloadRef.current = load;
    load();

    const refreshWorkspaces = () => {
      if (wsTimer) clearTimeout(wsTimer);
      wsTimer = setTimeout(() => {
        wsTimer = null;
        void fetchAllWorkspaces(paseo)
          .then((next) => {
            if (alive) setWorkspaces(next);
          })
          .catch(() => {});
      }, 400);
    };

    const stopAgentEvents = paseo.agents.subscribe((update) => {
      if (!alive) return;
      setAgents((prev) => {
        const next = new Map(prev);
        if (update.kind === "remove") {
          return next.delete(update.agentId) ? next : prev;
        }
        if (update.agent.archivedAt) {
          return next.delete(update.agent.id) ? next : prev;
        }
        next.set(update.agent.id, update.agent);
        return next;
      });
    });

    const stopWorkspaceEvents = paseo.workspaces.subscribe(refreshWorkspaces);

    // Open one subscribing list feed so `agents.subscribe` receives live deltas.
    void paseo.agents
      .list({ filter: { includeArchived: false }, page: { limit: 1 }, subscribe: {} })
      .then((res) => {
        const sub = res.subscription;
        if (!sub) return;
        if (!alive) {
          void sub.release().catch(() => {});
          return;
        }
        agentFeedSub = sub;
        const firstId = res.subscriptionId;
        sub.subscribe({
          snapshot(snap) {
            if (snap.subscriptionId !== firstId) load();
          },
          update() {},
          error() {},
        });
      })
      .catch(() => {});

    const backstop = setInterval(load, BACKSTOP_MS);

    return () => {
      alive = false;
      generation++;
      if (wsTimer) clearTimeout(wsTimer);
      clearInterval(backstop);
      stopAgentEvents();
      stopWorkspaceEvents();
      void agentFeedSub?.release().catch(() => {});
    };
  }, [paseo]);

  const reload = useCallback(() => reloadRef.current(), []);
  return { agents, workspaces, phase, error, reload };
}
