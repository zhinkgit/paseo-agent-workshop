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
            ? (agentId, serverId, targetWorkspaceId) => {
                const isRemote = Boolean(serverId && serverId !== host.id);
                navigation.openAgent({
                  agentId,
                  serverId: serverId ?? host.id,
                  ...(isRemote ? { focusHost: true } : {}),
                });
                // Keep the Workshop Explorer panel open when switching to an agent tab on this host.
                if (!isRemote) {
                  setTimeout(() => {
                    client.openPanel(WORKSHOP_PANEL_ID, {
                      workspaceId: targetWorkspaceId || workspaceId,
                      location: "explorer",
                    });
                  }, 120);
                }
              }
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
            ? (agentId, serverId) => {
                const isRemote = Boolean(serverId && serverId !== host.id);
                navigation.openAgent({
                  agentId,
                  serverId: serverId ?? host.id,
                  ...(isRemote ? { focusHost: true } : {}),
                });
              }
            : undefined
        }
      />
    );
  }

  const disposers = [
    client.addWorkspacePanel({
      id: WORKSHOP_PANEL_ID,
      title: "智能体工坊",
      icon: "Hammer",
      context: "workspace",
      locations: ["explorer", "workspace"],
      Component: WorkshopPanel,
    }),
    client.addScreen({
      id: WORKSHOP_PANEL_ID,
      title: "智能体工坊",
      Component: WorkshopScreen,
    }),
    client.addCommandCenterItem({
      id: "open-workshop-workspace",
      title: "打开智能体工坊",
      icon: "Hammer",
      keywords: ["工坊", "智能体", "进程", "workshop", "lobby", "processes", "agents"],
      context: "workspace",
      onSelect({ openPanel }) {
        openPanel(WORKSHOP_PANEL_ID, { location: "explorer" });
      },
    }),
    client.addCommandCenterItem({
      id: "open-workshop-all",
      title: "打开智能体工坊（全图模式）",
      icon: "Hammer",
      keywords: ["工坊", "全图", "智能体", "进程", "workshop", "fullscreen"],
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
