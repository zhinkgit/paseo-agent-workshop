import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const processRowSchema = z.object({
  pid: z.number(),
  started: z.string(),
  depth: z.number(),
  command: z.string(),
  cpu: z.number(),
  rssKb: z.number(),
  elapsed: z.string(),
  detached: z.boolean(),
});

export const processIdentitySchema = z.object({
  pid: z.number().int().positive(),
  started: z.string(),
});

export const agentTreeSchema = z.object({
  agentId: z.string(),
  title: z.string().nullable(),
  state: z.enum(["live", "ended", "unknown"]),
  status: z.string().nullable(),
  workspaceId: z.string().nullable(),
  cpu: z.number(),
  rssKb: z.number(),
  rows: z.array(processRowSchema),
});

export const workshopSettingsSchema = z.object({
  autoSweepEnabled: z.boolean(),
});

export type ProcessRowView = z.infer<typeof processRowSchema>;
export type ProcessIdentity = z.infer<typeof processIdentitySchema>;
export type AgentTreeView = z.infer<typeof agentTreeSchema>;
export type WorkshopSettings = z.infer<typeof workshopSettingsSchema>;

export const listProcesses = defineRpc({
  name: "processes.list",
  input: z.object({ workspaceId: z.string().optional() }),
  output: z.object({
    platform: z.enum(["linux", "darwin", "win32", "other"]),
    autoSweepEnabled: z.boolean(),
    agents: z.array(agentTreeSchema),
  }),
});

export const stopProcess = defineRpc({
  name: "processes.stop",
  input: processIdentitySchema,
  output: z.object({ signalled: z.number() }),
});

export const stopAgentProcesses = defineRpc({
  name: "processes.stop_agent",
  input: z.object({ agentId: z.string().min(1) }),
  output: z.object({ signalled: z.number() }),
});

export const optimizeProcess = defineRpc({
  name: "processes.optimize",
  input: processIdentitySchema,
  output: z.object({ agentId: z.string() }),
});

export const getSettings = defineRpc({
  name: "settings.get",
  input: z.object({}),
  output: workshopSettingsSchema,
});

export const updateSettings = defineRpc({
  name: "settings.set",
  input: z.object({ autoSweepEnabled: z.boolean() }),
  output: workshopSettingsSchema,
});
