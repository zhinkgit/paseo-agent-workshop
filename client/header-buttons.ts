// Registers a per-workspace header button to open Agent Workshop in Explorer.
import type { PluginButtonRegistration, PluginClientContext } from "@getpaseo/plugin/client";
import { fetchAllWorkspaces } from "./use-directory";

export const WORKSHOP_PANEL_ID = "workshop";

export function contributeHeaderButtons(client: PluginClientContext): () => void {
  const buttons = new Map<string, Pick<PluginButtonRegistration, "remove">>();
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  async function sync() {
    const workspaces = await fetchAllWorkspaces(client.paseo);
    if (disposed) return;
    for (const [workspaceId, btn] of buttons) {
      if (workspaces.has(workspaceId)) continue;
      btn.remove();
      buttons.delete(workspaceId);
    }
    for (const workspaceId of workspaces.keys()) {
      if (buttons.has(workspaceId)) continue;
      buttons.set(
        workspaceId,
        client.addHeaderButton({
          id: WORKSHOP_PANEL_ID,
          workspaceId,
          button: {
            title: "在侧边栏打开智能体工坊",
            icon: "Hammer",
            behavior: {
              kind: "action",
              onPress() {
                client.openPanel(WORKSHOP_PANEL_ID, { workspaceId, location: "explorer" });
              },
            },
          },
        }),
      );
    }
  }

  const resync = () => void sync().catch(() => {});
  const resyncSoon = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      resync();
    }, 400);
  };

  resync();
  const stopWorkspaces = client.paseo.workspaces.subscribe(resyncSoon);

  return () => {
    disposed = true;
    if (timer) clearTimeout(timer);
    stopWorkspaces();
    for (const btn of buttons.values()) btn.remove();
    buttons.clear();
  };
}
