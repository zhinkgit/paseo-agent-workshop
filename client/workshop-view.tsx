// Clean, airy, Lobby-inspired header & layout on a pure white/host background.
import type { PluginTheme } from "@getpaseo/plugin";
import { usePaseo, useRpc } from "@getpaseo/plugin/client";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import {
  listProcesses,
  optimizeProcess,
  stopAgentProcesses,
  stopProcess,
  updateSettings,
  type ProcessRowView,
} from "../shared/contracts";
import { formatCpu, formatMemory } from "../shared/format";
import { useDirectory } from "./use-directory";
import { useWorkshopFeed } from "./use-feed";
import { type WorkshopState } from "./workshop-art";
import { WorkshopCanvas } from "./workshop-canvas";
import { WorkshopDock } from "./workshop-dock";
import { WorkshopList } from "./workshop-list";
import { buildWorkshopRooms, STATE_ORDER, type WorkshopRoom } from "./workshop-model";

export interface WorkshopViewProps {
  theme: PluginTheme;
  compact: boolean;
  initialWorkspaceId?: string | null;
  openAgent?: (agentId: string) => void;
}

const FILTER_LABEL: Record<WorkshopState, string> = {
  "needs-input": "Needs you",
  runaway: "Runaway",
  failed: "Failed",
  working: "Working",
  ready: "Ready",
  idle: "Idle",
  closed: "Closed",
};

export function WorkshopView({
  theme,
  compact,
  initialWorkspaceId = null,
  openAgent,
}: WorkshopViewProps) {
  const paseo = usePaseo();
  const queryClient = useQueryClient();

  const fetchProcesses = useRpc(listProcesses);
  const runStopProcess = useRpc(stopProcess);
  const runStopAgent = useRpc(stopAgentProcesses);
  const runOptimizeProcess = useRpc(optimizeProcess);
  const runUpdateSettings = useRpc(updateSettings);

  const [scopeAll, setScopeAll] = useState(initialWorkspaceId === null);
  const [viewMode, setViewMode] = useState<"workshop" | "list">("workshop");
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<WorkshopState | "all">("all");
  const [scale, setScale] = useState(compact ? 1.8 : 2.2);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [archiveRoomId, setArchiveRoomId] = useState<string | null>(null);

  const activeScopeId = scopeAll ? null : initialWorkspaceId;

  const directory = useDirectory(paseo);
  const feed = useWorkshopFeed(paseo, directory.agents);

  const procQuery = useQuery({
    queryKey: ["agent-workshop", "processes", activeScopeId ?? "all"],
    queryFn: () => fetchProcesses(activeScopeId ? { workspaceId: activeScopeId } : {}),
    refetchInterval: 3_000,
  });

  const toggleSweepMutation = useMutation({
    mutationFn: (enabled: boolean) => runUpdateSettings({ autoSweepEnabled: enabled }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["agent-workshop", "processes"] });
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

  // Count per state for the clean dot filter chips
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

  const handleStopProcess = async (row: ProcessRowView) => {
    await runStopProcess({ pid: row.pid, started: row.started });
    await procQuery.refetch();
  };

  const handleStopAll = async (agentId: string) => {
    await runStopAgent({ agentId });
    await procQuery.refetch();
  };

  const handleOptimize = async (row: ProcessRowView) => {
    const res = await runOptimizeProcess({ pid: row.pid, started: row.started });
    openAgent?.(res.agentId);
  };

  const summaryParts = [`${baseData.allItems.length} agents`];
  if (counts.runaway > 0) summaryParts.push(`${counts.runaway} runaway`);
  else if (counts["needs-input"] > 0) summaryParts.push(`${counts["needs-input"]} need you`);
  if (totalProcs > 0) summaryParts.push(`${totalProcs}p · ${formatCpu(totalCpu)} · ${formatMemory(totalRss)}`);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface0 }}>
      {/* Airy Lobby-style pure white/surface0 header */}
      <View
        style={{
          paddingHorizontal: compact ? 10 : 14,
          paddingTop: 10,
          paddingBottom: 8,
          gap: 8,
          backgroundColor: theme.colors.surface0,
        }}
      >
        {/* Row 1: Summary on left, Workshop/List segmented pills + Refresh on right */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
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
                paddingHorizontal: 10,
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
                Workshop
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setViewMode("list")}
              style={{
                paddingHorizontal: 10,
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
                List
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                directory.reload();
                void procQuery.refetch();
              }}
              accessibilityLabel="Refresh"
              style={{ padding: 5, marginLeft: 2 }}
            >
              <Icon name="RefreshCw" size={14} color={theme.colors.foregroundMuted} />
            </Pressable>
          </View>
        </View>

        {/* Row 2: Clean rounded search input + Zoom icons */}
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
              placeholder="Find an agent, PID, or command"
              placeholderTextColor={theme.colors.foregroundMuted}
              style={{
                flex: 1,
                paddingVertical: 5,
                color: theme.colors.foreground,
                fontSize: 12,
              }}
            />
            {query ? (
              <Pressable onPress={() => setQuery("")} accessibilityLabel="Clear search">
                <Icon name="X" size={13} color={theme.colors.foregroundMuted} />
              </Pressable>
            ) : null}
          </View>

          {viewMode === "workshop" ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
              <Pressable
                onPress={() => setScale((s) => Math.max(1.2, Number((s - 0.3).toFixed(1))))}
                accessibilityLabel="Zoom out"
                style={{ padding: 6 }}
              >
                <Icon name="ZoomOut" size={15} color={theme.colors.foregroundMuted} />
              </Pressable>
              <Pressable
                onPress={() => setScale((s) => Math.min(3.4, Number((s + 0.3).toFixed(1))))}
                accessibilityLabel="Zoom in"
                style={{ padding: 6 }}
              >
                <Icon name="ZoomIn" size={15} color={theme.colors.foregroundMuted} />
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* Row 3: Scope pills (if inside workspace panel) + clean dot filter chips + Auto-clean pill */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
          {initialWorkspaceId ? (
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
                  This workspace
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
                  All workspaces
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
              All
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
                  {FILTER_LABEL[s]} {counts[s]}
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

      {/* Main split body: Clean White Workshop Canvas / List + Dual-Tab Dock */}
      <View style={{ flex: 1, flexDirection: compact ? "column" : "row" }}>
        <View style={{ flex: 1 }}>
          {viewMode === "workshop" ? (
            <WorkshopCanvas
              theme={theme}
              rooms={rooms}
              selectedId={selectedId}
              onSelect={(id) => {
                setArchiveRoomId(null);
                setSelectedId((prev) => (prev === id ? null : id));
              }}
              onSelectArchive={(room) => {
                setSelectedId(null);
                setArchiveRoomId(room.workspaceId);
              }}
              toolByAgent={feed.toolByAgent}
              envelopes={feed.envelopes}
              compact={compact}
              scale={scale}
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
          paseo={paseo}
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
          onOpenAgent={openAgent}
          onStopProcess={handleStopProcess}
          onStopAllProcesses={handleStopAll}
          onOptimizeProcess={handleOptimize}
          compact={compact}
        />
      </View>
    </View>
  );
}
