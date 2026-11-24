// Pure core: builds the prompt brief for the "Optimize with an agent" workflow.
import { formatCpu, formatElapsed, formatMemory } from "../shared/format.ts";
import type { TreeRow } from "./processes.ts";

export interface OptimizeSubject {
  agent: { id: string; title: string | null; cwd: string };
  rows: readonly TreeRow[];
  platform?: NodeJS.Platform;
}

export function optimizeBrief({ agent, rows, platform = process.platform }: OptimizeSubject): string {
  const kb = rows.reduce((sum, row) => sum + row.rssKb, 0);
  const cpu = rows.reduce((sum, row) => sum + row.cpu, 0);
  const owner = agent.title ? `"${agent.title}" (agent ${agent.id})` : `agent ${agent.id}`;
  const count = rows.length === 1 ? "1 process" : `${rows.length} processes`;
  const lines = rows.map((row) => {
    const figures = `pid ${row.pid}, ${formatCpu(row.cpu)} CPU, ${formatMemory(row.rssKb)}, running ${formatElapsed(row.elapsed)}`;
    const outlived = row.detached ? ", parent exited" : "";
    return `${"  ".repeat(row.depth)}${figures}${outlived}: ${row.command}`;
  });
  const measureTool = platform === "win32" ? "Get-Process / Get-CimInstance" : "ps";
  return [
    `Optimize these processes. ${owner} in ${agent.cwd} started them, and right now they use ${formatMemory(kb)} of memory and ${formatCpu(cpu)} CPU in ${count}:`,
    "",
    ...lines,
    "",
    "Find out what each process is for and why it uses what it uses: a language server, a test run, a dev server, a watcher, an MCP server, a build. Then make the work cheaper without losing any of it. Fix the cause where there is one (a setting, a leak in the code, a watcher or server nobody stops, duplicate copies of the same server) rather than killing the symptom.",
    "",
    `Measure before and after with ${measureTool} and report both. The agent that owns these processes may still be working: before you stop one of its processes or change a setting outside this workspace, ask me and say what it costs.`,
  ].join("\n");
}
