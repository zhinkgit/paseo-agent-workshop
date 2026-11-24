import type {
  PluginClientContext,
  PluginScreenProps,
  PluginWorkspacePanelProps,
} from "@getpaseo/plugin/client";
import { contributeHeaderButtons, WORKSHOP_PANEL_ID } from "./client/header-buttons";
import { WorkshopView } from "./client/workshop-view";

function WorkshopPanel({ theme, layout, workspaceId, navigation }: PluginWorkspacePanelProps) {
  return (
    <WorkshopView
      theme={theme}
      compact={layout.compact}
      initialWorkspaceId={workspaceId}
      openAgent={navigation ? (agentId) => navigation.openAgent({ agentId }) : undefined}
    />
  );
}

function WorkshopScreen({ theme, layout, navigation }: PluginScreenProps) {
  return (
    <WorkshopView
      theme={theme}
      compact={layout.compact}
      initialWorkspaceId={null}
      openAgent={navigation ? (agentId) => navigation.openAgent({ agentId }) : undefined}
    />
  );
}

export default function contribute(client: PluginClientContext) {
  const disposers = [
    client.addWorkspacePanel({
      id: WORKSHOP_PANEL_ID,
      title: "Workshop",
      icon: "Hammer",
      context: "workspace",
      locations: ["explorer", "workspace"],
      Component: WorkshopPanel,
    }),
    client.addScreen({
      id: WORKSHOP_PANEL_ID,
      title: "Agent Workshop",
      Component: WorkshopScreen,
    }),
    client.addCommandCenterItem({
      id: "open-workshop-workspace",
      title: "Open Agent Workshop",
      icon: "Hammer",
      keywords: ["workshop", "lobby", "processes", "agents", "cpu", "memory", "pixel"],
      context: "workspace",
      onSelect({ openPanel }) {
        openPanel(WORKSHOP_PANEL_ID, { location: "explorer" });
      },
    }),
    client.addCommandCenterItem({
      id: "open-workshop-all",
      title: "Open Agent Workshop (All Workspaces)",
      icon: "Hammer",
      keywords: ["workshop", "lobby", "processes", "agents", "orphan", "kill"],
      context: "global",
      onSelect({ openScreen }) {
        openScreen({ screenId: WORKSHOP_PANEL_ID });
      },
    }),
    contributeHeaderButtons(client),
  ];

  return () => {
    for (const dispose of disposers) dispose();
  };
}
