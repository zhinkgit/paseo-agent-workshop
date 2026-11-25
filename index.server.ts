import type { PluginHandlerContext, PluginServerContext } from "@getpaseo/plugin/server";
import { optimizeBrief } from "./server/optimize";
import {
  agentTrees,
  attributeProcesses,
  NO_ATTRIBUTION,
  orphanedProviders,
  subtree,
  subtreeRows,
  type Attribution,
  type ProcessRow,
} from "./server/processes";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "./server/settings";
import {
  daemonPid,
  killSurvivors,
  platformKind,
  readAgents,
  readRawProcessTable,
  terminate,
} from "./server/system";
import {
  getSettings,
  listProcesses,
  optimizeProcess,
  stopAgentProcesses,
  stopProcess,
  updateSettings,
  type ProcessIdentity,
  type StopResult,
  type WorkshopSettings,
} from "./shared/contracts";
import { splitCommand } from "./shared/format";

const CLEANUP_GRACE_MS = 15_000;
const SWEEP_INTERVAL_MS = 60_000;
const WATCH_INTERVAL_MS = 2_000;

type Paseo = PluginHandlerContext["paseo"];

export default function contribute(server: PluginServerContext) {
  const lifetime = new AbortController();
  let settings: WorkshopSettings = { ...DEFAULT_SETTINGS };
  let settingsLoaded = false;

  const ensureSettings = async (): Promise<WorkshopSettings> => {
    if (!settingsLoaded) {
      settings = await loadSettings();
      settingsLoaded = true;
    }
    return settings;
  };
  void ensureSettings().catch((error) => {
    if (!lifetime.signal.aborted) console.error("failed to load workshop settings", error);
  });

  const report = (error: unknown) => {
    if (!lifetime.signal.aborted) console.error(error);
  };

  let attribution: Attribution = NO_ATTRIBUTION;
  let reading: Promise<ProcessRow[]> | undefined;
  const read = () => {
    reading ??= readRawProcessTable()
      .then((raw) => {
        const parsed = attributeProcesses(raw, attribution);
        attribution = parsed.attribution;
        return parsed.rows;
      })
      .finally(() => {
        reading = undefined;
      });
    return reading;
  };

  const stop = async (
    targets: readonly ProcessIdentity[],
    rescan?: () => Promise<ProcessIdentity[]>,
  ): Promise<StopResult> => {
    const outcome = await terminate(targets);
    if (outcome.stillRunning.length > 0) {
      killSurvivors(outcome.stillRunning, lifetime.signal, rescan).catch(report);
    }
    const firstErr = outcome.failed[0]?.error;
    return {
      signalled: outcome.signalled.length,
      stopped: outcome.stopped.length,
      stillRunning: outcome.stillRunning.length,
      failed: outcome.failed.length,
      ...(firstErr ? { error: firstErr } : {}),
    };
  };

  const agentProcess = (rows: readonly ProcessRow[], { pid, started }: ProcessIdentity) => {
    const target = rows.find((row) => row.pid === pid && row.started === started);
    if (!target) throw new Error(`process ${pid} has exited`);
    if (!target.agentId) throw new Error(`process ${pid} was not started by a Paseo agent`);
    return { ...target, agentId: target.agentId };
  };

  let client: Paseo | undefined;

  server.handle(listProcesses, async ({ workspaceId }, { paseo }) => {
    client = paseo;
    const [rows, currentSettings] = await Promise.all([read(), ensureSettings()]);
    const agents = await readAgents(paseo, rows);
    const views = agentTrees(rows, daemonPid).map((tree) => {
      const agent = agents.get(tree.agentId);
      return {
        ...tree,
        title: agent?.title ?? null,
        status: agent?.status ?? null,
        state: agent?.state ?? "unknown",
        workspaceId: agent?.workspaceId ?? null,
      };
    });
    return {
      platform: platformKind,
      autoSweepEnabled: currentSettings.autoSweepEnabled,
      agents: workspaceId ? views.filter((view) => view.workspaceId === workspaceId) : views,
    };
  });

  server.handle(stopProcess, async (identity) => {
    const rows = await read();
    const root = agentProcess(rows, identity);
    const targets = subtree(rows, root);
    console.log(`stopping process ${identity.pid} and ${targets.length - 1} descendants`);
    return stop(targets, async () => {
      const latest = await read();
      const sameRoot = latest.find((r) => r.pid === identity.pid && r.started === identity.started);
      return sameRoot ? subtree(latest, sameRoot) : [];
    });
  });

  server.handle(stopAgentProcesses, async ({ agentId }) => {
    const rows = await read();
    const own = rows.filter((row) => row.agentId === agentId);
    if (own.length === 0) {
      return { signalled: 0, stopped: 0, stillRunning: 0, failed: 0 };
    }
    console.log(`stopping all ${own.length} processes of agent ${agentId}`);
    return stop(own, async () => {
      const latest = await read();
      return latest.filter((row) => row.agentId === agentId);
    });
  });

  server.handle(optimizeProcess, async (identity, { paseo }) => {
    const { pid } = identity;
    const rows = await read();
    const target = agentProcess(rows, identity);
    const { agentId } = target;
    const tree = agentTrees(rows, daemonPid).find((candidate) => candidate.agentId === agentId);
    const owner = (await paseo.agents.ref(agentId).refresh())?.agent;
    if (!owner?.workspaceId) throw new Error(`Paseo no longer knows the workspace of agent ${agentId}`);
    const provider = owner.model ? `${owner.provider}/${owner.model}` : owner.provider;
    const optimizer = await paseo.workspaces.ref(owner.workspaceId).agents.create({
      config: { provider, thinkingOptionId: owner.thinkingOptionId ?? undefined },
      title: `Optimize ${splitCommand(target.command).name} (${pid})`,
      prompt: optimizeBrief({
        agent: { id: agentId, title: owner.title ?? null, cwd: owner.cwd },
        rows: subtreeRows(tree?.rows ?? [], pid),
      }),
    });
    console.log(`optimizing process ${pid} of agent ${agentId} with agent ${optimizer.id}`);
    return { agentId: optimizer.id };
  });

  server.handle(getSettings, async () => ensureSettings());

  server.handle(updateSettings, async ({ autoSweepEnabled }) => {
    settings = await saveSettings({ autoSweepEnabled });
    settingsLoaded = true;
    console.log(`autoSweepEnabled set to ${settings.autoSweepEnabled}`);
    return settings;
  });

  const sweep = async (paseo: Paseo) => {
    const current = await ensureSettings();
    if (!current.autoSweepEnabled) return;
    const rows = await read();
    const daemonGroup =
      process.platform === "win32" ? 0 : (rows.find((row) => row.pid === daemonPid)?.pgid ?? 0);
    if (process.platform !== "win32" && daemonGroup === 0) {
      throw new Error(`daemon ${daemonPid} is missing from the process table`);
    }
    const agents = await readAgents(paseo, rows);
    const states = new Map([...agents].map(([id, info]) => [id, info.state]));
    const orphans = orphanedProviders(rows, daemonPid, daemonGroup, states);
    for (const orphan of orphans) {
      console.log(`agent ${orphan.agentId} ended; stopping orphaned provider process ${orphan.pid}`);
    }
    if (orphans.length > 0) await stop(orphans);
  };

  let pending: ReturnType<typeof setTimeout> | undefined;
  const sweepAfterGrace = (_event: unknown, { paseo }: { paseo: Paseo }) => {
    client = paseo;
    clearTimeout(pending);
    pending = setTimeout(() => sweep(paseo).catch(report), CLEANUP_GRACE_MS);
    return Promise.resolve();
  };

  const removers = [
    server.addHook("agent.close.after", sweepAfterGrace),
    server.addHook("agent.archive.after", sweepAfterGrace),
    server.addHook("workspace.archive.after", sweepAfterGrace),
    server.addHook("agent.turn.after", sweepAfterGrace),
  ];
  const interval = setInterval(() => {
    if (client) sweep(client).catch(report);
  }, SWEEP_INTERVAL_MS);
  const watch = setInterval(() => read().catch(report), WATCH_INTERVAL_MS);
  console.log(`agent-workshop watching processes of daemon ${daemonPid} on ${platformKind}`);

  return () => {
    lifetime.abort();
    clearTimeout(pending);
    clearInterval(interval);
    clearInterval(watch);
    for (const remove of removers) remove();
  };
}
