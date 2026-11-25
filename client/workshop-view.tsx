// All-Chinese sleek Agent Workshop surface with multi-host switcher, 1-click Full-Screen,
// integrated Big Screen rooms, and refined conversation-first Detail Dock.
import type { PluginTheme } from "@getpaseo/plugin";
import { getPaseoClient, useHosts, usePaseo, useRpc } from "@getpaseo/plugin/client";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import {
  listProcesses,
  optimizeProcess,
  stopAgentProcesses,
  stopProcess,
  updateSettings,
  type ProcessRowView,
  type StopResult,
} from "../shared/contracts";
import { formatCpu, formatMemory } from "../shared/format";
import type { PaseoApi } from "./paseo-types";
import { useDirectory } from "./use-directory";
import { useWorkshopFeed } from "./use-feed";
import { type WorkshopState } from "./workshop-art";
import { WorkshopCanvas } from "./workshop-canvas";
import { WorkshopDock } from "./workshop-dock";
import { WorkshopList } from "./workshop-list";
import { buildWorkshopRooms, STATE_LABEL, STATE_ORDER, type WorkshopRoom } from "./workshop-model";

export interface WorkshopViewProps {
  theme: PluginTheme;
  compact: boolean;
  hostId: string;
  hostLabel: string;
  initialWorkspaceId?: string | null;
  onOpenFullScreen?: () => void;
  openAgent?: (agentId: string, serverId?: string, workspaceId?: string) => void;
}

type RemoteRpcCapable = {
  invokePluginRpc?: (pluginId: string, method: string, input: unknown) => Promise<unknown>;
};

export function WorkshopView({
  theme,
  compact,
  hostId,
  hostLabel,
  initialWorkspaceId = null,
  onOpenFullScreen,
  openAgent,
}: WorkshopViewProps) {
  const localPaseo = usePaseo();
  const configuredHosts = useHosts();
  const queryClient = useQueryClient();

  const localFetchProcesses = useRpc(listProcesses);
  const localStopProcess = useRpc(stopProcess);
  const localStopAgent = useRpc(stopAgentProcesses);
  const localOptimizeProcess = useRpc(optimizeProcess);
  const localUpdateSettings = useRpc(updateSettings);

  const [activeHostId, setActiveHostId] = useState(hostId);
  const [scopeAll, setScopeAll] = useState(initialWorkspaceId === null);
  const [viewMode, setViewMode] = useState<"workshop" | "list">("workshop");
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<WorkshopState | "all">("all");
  const [zoom, setZoom] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [archiveRoomId, setArchiveRoomId] = useState<string | null>(null);

  useEffect(() => {
    setActiveHostId(hostId);
  }, [hostId]);

  useEffect(() => {
    setSelectedId(null);
    setArchiveRoomId(null);
  }, [activeHostId]);

  const isLocalHost = activeHostId === hostId;

  const activePaseo: PaseoApi = useMemo(() => {
    if (isLocalHost) return localPaseo;
    try {
      return getPaseoClient(activeHostId) as unknown as PaseoApi;
    } catch {
      return localPaseo;
    }
  }, [isLocalHost, activeHostId, localPaseo]);

  const callHostRpc = async <TOut,>(
    method: string,
    input: unknown,
    localFallback: () => Promise<TOut>,
  ): Promise<TOut> => {
    if (isLocalHost) return localFallback();
    const remote = activePaseo as unknown as RemoteRpcCapable;
    if (typeof remote.invokePluginRpc === "function") {
      return (await remote.invokePluginRpc("agent-workshop", method, input)) as TOut;
    }
    throw new Error("当前客户端暂不支持在侧栏直连远程主机进程接口，请点击右上角「全图」后切换主机。");
  };

  const activeScopeId = !isLocalHost || scopeAll ? null : initialWorkspaceId;

  const directory = useDirectory(activePaseo);
  const feed = useWorkshopFeed(activePaseo, directory.agents);

  const procQuery = useQuery({
    queryKey: ["agent-workshop", "processes", activeHostId, activeScopeId ?? "all"],
    queryFn: () => {
      const payload = activeScopeId ? { workspaceId: activeScopeId } : {};
      return callHostRpc("processes.list", payload, () => localFetchProcesses(payload));
    },
    refetchInterval: 3_000,
    retry: false,
  });

  const toggleSweepMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      callHostRpc("settings.set", { autoSweepEnabled: enabled }, () =>
        localUpdateSettings({ autoSweepEnabled: enabled }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["agent-workshop", "processes", activeHostId] });
    },
  });

  const baseData = useMemo(
    () =>
      buildWorkshopRooms({
        agents: directory.agents,
        workspaces: directory.workspaces,
        processTrees: procQuery.data?.agents ?? [],
        scopeWorkspaceId: activeScopeId,
        query,
        showClosed: stateFilter === "closed",
      }),
    [directory.agents, directory.workspaces, procQuery.data?.agents, activeScopeId, query, stateFilter],
  );

  const counts = useMemo(() => {
    const map: Record<WorkshopState, number> = {
      "needs-input": 0,
      runaway: 0,
      failed: 0,
      working: 0,
      ready: 0,
      idle: 0,
      closed: 0,
    };
    for (const item of baseData.allItems) map[item.state] += 1;
    return map;
  }, [baseData.allItems]);

  const { rooms, allItems } = useMemo(() => {
    if (stateFilter === "all") return baseData;
    const filteredItems = baseData.allItems.filter((i) => i.state === stateFilter);
    const allowed = new Set(filteredItems.map((i) => i.id));
    const filteredRooms = baseData.rooms
      .map((r) => ({
        ...r,
        benches: r.benches.filter((b) => allowed.has(b.id)),
        runaways: r.runaways.filter((b) => allowed.has(b.id)),
        archived: r.archived.filter((b) => allowed.has(b.id)),
      }))
      .filter((r) => r.benches.length > 0 || r.runaways.length > 0 || r.archived.length > 0);
    return { rooms: filteredRooms, allItems: filteredItems };
  }, [baseData, stateFilter]);

  const selected = useMemo(
    () => (selectedId ? baseData.allItems.find((i) => i.id === selectedId) ?? null : null),
    [baseData.allItems, selectedId],
  );

  const archiveRoom: WorkshopRoom | null = useMemo(
    () => (archiveRoomId !== null ? baseData.rooms.find((r) => r.workspaceId === archiveRoomId) ?? null : null),
    [baseData.rooms, archiveRoomId],
  );

  const totalCpu = baseData.rooms.reduce((sum, r) => sum + r.totalCpu, 0);
  const totalRss = baseData.rooms.reduce((sum, r) => sum + r.totalRssKb, 0);
  const totalProcs = baseData.rooms.reduce((sum, r) => sum + r.totalProcesses, 0);
  const autoSweepEnabled = procQuery.data?.autoSweepEnabled ?? true;

  const dotColorFor = (s: WorkshopState) => {
    switch (s) {
      case "needs-input":
        return theme.colors.statusWarning;
      case "runaway":
      case "failed":
        return theme.colors.statusDanger;
      case "working":
      case "ready":
        return theme.colors.statusSuccess;
      default:
        return theme.colors.foregroundMuted;
    }
  };

  const scheduleFollowupRefetch = (stillRunning: number) => {
    if (stillRunning <= 0) return;
    for (const ms of [1_500, 4_000, 11_000]) {
      setTimeout(() => {
        void procQuery.refetch();
      }, ms);
    }
  };

  const handleStopProcess = async (row: ProcessRowView): Promise<StopResult> => {
    const payload = { pid: row.pid, started: row.started };
    const res = await callHostRpc("processes.stop", payload, () => localStopProcess(payload));
    await procQuery.refetch();
    scheduleFollowupRefetch(res.stillRunning);
    return res;
  };

  const handleStopAll = async (agentId: string): Promise<StopResult> => {
    const payload = { agentId };
    const res = await callHostRpc("processes.stop_agent", payload, () => localStopAgent(payload));
    await procQuery.refetch();
    scheduleFollowupRefetch(res.stillRunning);
    return res;
  };

  const handleOptimize = async (row: ProcessRowView) => {
    const payload = { pid: row.pid, started: row.started };
    const res = await callHostRpc<{ agentId: string }>("processes.optimize", payload, () =>
      localOptimizeProcess(payload),
    );
    openAgent?.(res.agentId, activeHostId);
  };

  const handleSendMessage = async (agentId: string, text: string) => {
    await activePaseo.agents.ref(agentId).send(text);
  };

  const handleArchiveAgent = async (agentId: string) => {
    await activePaseo.agents.ref(agentId).archive();
  };

  const hostOptions = useMemo(() => {
    if (configuredHosts.length > 0) return configuredHosts;
    return [{ serverId: hostId, label: hostLabel, status: "online" as const }];
  }, [configuredHosts, hostId, hostLabel]);

  const summaryParts = [`${baseData.allItems.length} 个智能体`];
  if (counts.runaway > 0) summaryParts.push(`${counts.runaway} 失控`);
  else if (counts["needs-input"] > 0) summaryParts.push(`${counts["needs-input"]} 待审批`);
  if (totalProcs > 0) summaryParts.push(`${totalProcs} 进程 · ${formatCpu(totalCpu)} · ${formatMemory(totalRss)}`);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface0 }}>
      {/* Clean All-Chinese Header */}
      <View
        style={{
          paddingHorizontal: compact ? 10 : 14,
          paddingTop: 10,
          paddingBottom: 8,
          gap: 7,
          backgroundColor: theme.colors.surface0,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        }}
      >
        {/* Row 1: Summary + 工坊/列表 + 全图 + 刷新 */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 6,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              color: theme.colors.foregroundMuted,
              fontSize: 12,
              flex: 1,
            }}
          >
            {summaryParts.join(" · ")}
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Pressable
              onPress={() => setViewMode("workshop")}
              style={{
                paddingHorizontal: 9,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: viewMode === "workshop" ? theme.colors.surface2 : "transparent",
              }}
            >
              <Text
                style={{
                  color:
                    viewMode === "workshop" ? theme.colors.foreground : theme.colors.foregroundMuted,
                  fontSize: 12,
                  fontWeight: viewMode === "workshop" ? "600" : "400",
                }}
              >
                工坊
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setViewMode("list")}
              style={{
                paddingHorizontal: 9,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: viewMode === "list" ? theme.colors.surface2 : "transparent",
              }}
            >
              <Text
                style={{
                  color: viewMode === "list" ? theme.colors.foreground : theme.colors.foregroundMuted,
                  fontSize: 12,
                  fontWeight: viewMode === "list" ? "600" : "400",
                }}
              >
                列表
              </Text>
            </Pressable>

            {onOpenFullScreen ? (
              <Pressable
                onPress={onOpenFullScreen}
                accessibilityRole="button"
                accessibilityLabel="打开全图模式"
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 3,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  marginLeft: 2,
                }}
              >
                <Icon name="Maximize2" size={12} color={theme.colors.foreground} />
                <Text style={{ color: theme.colors.foreground, fontSize: 11, fontWeight: "600" }}>
                  全图
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => {
                directory.reload();
                void procQuery.refetch();
              }}
              accessibilityLabel="刷新"
              style={{ padding: 5 }}
            >
              <Icon name="RefreshCw" size={14} color={theme.colors.foregroundMuted} />
            </Pressable>
          </View>
        </View>

        {/* Multi-host switcher bar */}
        {hostOptions.length > 1 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 5 }}>
            <Icon name="Server" size={12} color={theme.colors.foregroundMuted} />
            {hostOptions.map((h) => {
              const active = h.serverId === activeHostId;
              const online = h.status === "online";
              return (
                <Pressable
                  key={h.serverId}
                  disabled={!online}
                  onPress={() => setActiveHostId(h.serverId)}
                  accessibilityRole="button"
                  accessibilityLabel={`切换主机至 ${h.label}`}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 5,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: active ? theme.colors.accent : theme.colors.border,
                    backgroundColor: active ? theme.colors.surface2 : "transparent",
                    opacity: online ? 1 : 0.45,
                  }}
                >
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 999,
                      backgroundColor: online
                        ? theme.colors.statusSuccess
                        : theme.colors.foregroundMuted,
                    }}
                  />
                  <Text
                    style={{
                      color: active ? theme.colors.foreground : theme.colors.foregroundMuted,
                      fontSize: 11,
                      fontWeight: active ? "600" : "400",
                    }}
                  >
                    {h.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {/* Row 2: Search + Zoom */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 10,
              paddingVertical: 2,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface0,
            }}
          >
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="搜索智能体、工作区、PID 或命令…"
              placeholderTextColor={theme.colors.foregroundMuted}
              style={{
                flex: 1,
                paddingVertical: 5,
                color: theme.colors.foreground,
                fontSize: 12,
              }}
            />
            {query ? (
              <Pressable onPress={() => setQuery("")} accessibilityLabel="清空搜索">
                <Icon name="X" size={13} color={theme.colors.foregroundMuted} />
              </Pressable>
            ) : null}
          </View>

          {viewMode === "workshop" ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
              <Pressable
                onPress={() => setZoom((z) => Math.max(0.7, Number((z - 0.15).toFixed(2))))}
                accessibilityLabel="缩小画面"
                style={{ padding: 6 }}
              >
                <Icon name="ZoomOut" size={15} color={theme.colors.foregroundMuted} />
              </Pressable>
              <Pressable
                onPress={() => setZoom((z) => Math.min(1.8, Number((z + 0.15).toFixed(2))))}
                accessibilityLabel="放大画面"
                style={{ padding: 6 }}
              >
                <Icon name="ZoomIn" size={15} color={theme.colors.foregroundMuted} />
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* Row 3: Scope + State Filters + Auto-clean */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
          {initialWorkspaceId && isLocalHost ? (
            <>
              <Pressable
                onPress={() => setScopeAll(false)}
                style={{
                  paddingHorizontal: 9,
                  paddingVertical: 3.5,
                  borderRadius: 999,
                  backgroundColor: !scopeAll ? theme.colors.surface2 : "transparent",
                }}
              >
                <Text
                  style={{
                    color: !scopeAll ? theme.colors.foreground : theme.colors.foregroundMuted,
                    fontSize: 11,
                    fontWeight: !scopeAll ? "600" : "400",
                  }}
                >
                  当前工作区
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setScopeAll(true)}
                style={{
                  paddingHorizontal: 9,
                  paddingVertical: 3.5,
                  borderRadius: 999,
                  backgroundColor: scopeAll ? theme.colors.surface2 : "transparent",
                }}
              >
                <Text
                  style={{
                    color: scopeAll ? theme.colors.foreground : theme.colors.foregroundMuted,
                    fontSize: 11,
                    fontWeight: scopeAll ? "600" : "400",
                  }}
                >
                  全部工作区
                </Text>
              </Pressable>
            </>
          ) : null}

          <Pressable
            onPress={() => setStateFilter("all")}
            style={{
              paddingHorizontal: 9,
              paddingVertical: 3.5,
              borderRadius: 999,
              backgroundColor: stateFilter === "all" ? theme.colors.surface2 : "transparent",
            }}
          >
            <Text
              style={{
                color: stateFilter === "all" ? theme.colors.foreground : theme.colors.foregroundMuted,
                fontSize: 11,
                fontWeight: stateFilter === "all" ? "600" : "400",
              }}
            >
              全部
            </Text>
          </Pressable>

          {STATE_ORDER.filter((s) => counts[s] > 0 || stateFilter === s).map((s) => {
            const active = stateFilter === s;
            return (
              <Pressable
                key={s}
                onPress={() => setStateFilter((prev) => (prev === s ? "all" : s))}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  paddingHorizontal: 8,
                  paddingVertical: 3.5,
                  borderRadius: 999,
                  backgroundColor: active ? theme.colors.surface2 : "transparent",
                }}
              >
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    backgroundColor: dotColorFor(s),
                  }}
                />
                <Text
                  style={{
                    color: active ? theme.colors.foreground : theme.colors.foregroundMuted,
                    fontSize: 11,
                    fontWeight: active ? "600" : "400",
                  }}
                >
                  {STATE_LABEL[s]} {counts[s]}
                </Text>
              </Pressable>
            );
          })}

          <Pressable
            disabled={toggleSweepMutation.isPending}
            onPress={() => toggleSweepMutation.mutate(!autoSweepEnabled)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingHorizontal: 8,
              paddingVertical: 3.5,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: theme.colors.border,
              marginLeft: "auto",
            }}
          >
            <Icon
              name={autoSweepEnabled ? "ShieldCheck" : "ShieldOff"}
              size={11}
              color={autoSweepEnabled ? theme.colors.statusSuccess : theme.colors.foregroundMuted}
            />
            <Text style={{ color: theme.colors.foregroundMuted, fontSize: 11 }}>
              自动清理{autoSweepEnabled ? "" : "已关"}
            </Text>
          </Pressable>
        </View>

        {directory.error || procQuery.error ? (
          <Text style={{ color: theme.colors.statusDanger, fontSize: 11 }}>
            {directory.error ??
              (procQuery.error instanceof Error
                ? procQuery.error.message
                : String(procQuery.error))}
          </Text>
        ) : null}
      </View>

      {/* Main split body */}
      <View style={{ flex: 1, flexDirection: compact ? "column" : "row" }}>
        <View style={{ flex: 1 }}>
          {viewMode === "workshop" ? (
            <WorkshopCanvas
              theme={theme}
              rooms={rooms}
              selectedId={selectedId}
              onOpenDetail={(id) => {
                setArchiveRoomId(null);
                setSelectedId((prev) => (prev === id ? null : id));
              }}
              onSelectArchive={(room) => {
                setSelectedId(null);
                setArchiveRoomId(room.workspaceId);
              }}
              onOpenAgent={
                openAgent
                  ? (agentId, wsId) => openAgent(agentId, activeHostId, wsId)
                  : undefined
              }
              onSendMessage={handleSendMessage}
              onArchiveAgent={handleArchiveAgent}
              onStopAllProcesses={handleStopAll}
              toolByAgent={feed.toolByAgent}
              latestByAgent={feed.latestByAgent}
              envelopes={feed.envelopes}
              compact={compact}
              zoom={zoom}
            />
          ) : (
            <WorkshopList
              theme={theme}
              items={allItems}
              selectedId={selectedId}
              onSelect={(id) => {
                setArchiveRoomId(null);
                setSelectedId((prev) => (prev === id ? null : id));
              }}
              compact={compact}
            />
          )}
        </View>

        <WorkshopDock
          theme={theme}
          paseo={activePaseo}
          selected={selected}
          archiveRoom={archiveRoom}
          onSelectAgent={(id) => {
            setArchiveRoomId(null);
            setSelectedId(id);
          }}
          onClose={() => {
            setSelectedId(null);
            setArchiveRoomId(null);
          }}
          onOpenAgent={
            openAgent ? (agentId, wsId) => openAgent(agentId, activeHostId, wsId) : undefined
          }
          onStopProcess={handleStopProcess}
          onStopAllProcesses={handleStopAll}
          onOptimizeProcess={handleOptimize}
          compact={compact}
        />
      </View>
    </View>
  );
}
