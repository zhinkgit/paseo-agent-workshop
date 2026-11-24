// Persists workshop daemon settings (autoSweepEnabled) in Paseo's plugin-data directory.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { WorkshopSettings } from "../shared/contracts";

export const DEFAULT_SETTINGS: WorkshopSettings = {
  autoSweepEnabled: true,
};

function settingsPath(): string {
  const base = process.env.PASEO_HOME?.trim() || join(homedir(), ".paseo");
  return join(base, "plugin-data", "agent-workshop", "settings.json");
}

export async function loadSettings(file = settingsPath()): Promise<WorkshopSettings> {
  try {
    const raw = await readFile(file, "utf8");
    const parsed = JSON.parse(raw) as Partial<WorkshopSettings>;
    return {
      autoSweepEnabled: typeof parsed.autoSweepEnabled === "boolean" ? parsed.autoSweepEnabled : true,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(next: WorkshopSettings, file = settingsPath()): Promise<WorkshopSettings> {
  const clean: WorkshopSettings = { autoSweepEnabled: Boolean(next.autoSweepEnabled) };
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(clean, null, 2)}\n`, "utf8");
  return clean;
}
