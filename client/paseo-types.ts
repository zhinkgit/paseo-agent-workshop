import type { PluginClientContext } from "@getpaseo/plugin/client";

export type PaseoApi = PluginClientContext["paseo"];
export type PaseoAgent = Awaited<ReturnType<PaseoApi["agents"]["list"]>>["entries"][number]["agent"];
export type PaseoWorkspace = Awaited<ReturnType<PaseoApi["workspaces"]["list"]>>["entries"][number];

type Timeline = ReturnType<PaseoApi["agents"]["ref"]>["timeline"];
export type PaseoAgentTimelineEvent = Parameters<Parameters<Timeline["subscribe"]>[0]>[0];
