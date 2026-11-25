import type {
  PluginClientContext,
  PluginScreenProps,
  PluginWorkspacePanelProps,
} from "@getpaseo/plugin/client";
import { contributeHeaderButtons, WORKSHOP_PANEL_ID } from "./client/header-buttons";
import { WorkshopView } from "./client/workshop-view";

export default function contribute(client: PluginClientContext) {
  function WorkshopPanel({ theme, layout, workspaceId, host, navigation }: PluginWorkspacePanelProps) {
    return (
      <WorkshopView
        theme={theme}
        compact={layout.compact}
        hostId={host.id}
        hostLabel={host.label}
        initialWorkspaceId={workspaceId}
        onOpenFullScreen={() => client.openScreen({ screenId: WORKSHOP_PANEL_ID })}
        openAgent={
          navigation
            ? (agentId, serverId) =>
                navigation.openAgent({
                  agentId,
                  serverId: serverId ?? host.id,
                  focusHost: Boolean(serverId && serverId !== host.id),
                })
            : undefined
        }
      />
    );
  }

  function WorkshopScreen({ theme, layout, host, navigation }: PluginScreenProps) {
    return (
      <WorkshopView
        theme={theme}
        compact={layout.compact}
        hostId={host.id}
        hostLabel={host.label}
        initialWorkspaceId={null}
        openAgent={
          navigation
            ? (agentId, serverId) =>
                navigation.openAgent({
                  agentId,
                  serverId: serverId ?? host.id,
                  focusHost: Boolean(serverId && serverId !== host.id),
                })
            : undefined
        }
      />
    );
  }

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
      title: "Open Agent Workshop (Full Screen)",
      icon: "Hammer",
      keywords: ["workshop", "lobby", "processes", "agents", "orphan", "kill", "fullscreen"],
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
