// Sleek Paseo-native Agent Workshop surface: compact Lucide icon toolbar
// + 2.5D Retro RPG Workshop Canvas / Unified List + Dual-Tab Inspector Dock.
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
import { WorkshopCanvas } from "./workshop-canvas";
import { WorkshopDock } from "./workshop-dock";
import { WorkshopList } from "./workshop-list";
import { buildWorkshopRooms, type WorkshopRoom } from "./workshop-model";

export interface WorkshopViewProps {
  theme: PluginTheme;
  compact: boolean;
  initialWorkspaceId?: string | null;
  openAgent?: (agentId: string) => void;
}

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
  const [showClosed, setShowClosed] = useState(false);
  const [scale, setScale] = useState(compact ? 2 : 2.5);
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

  const { rooms, allItems } = useMemo(
    () =>
      buildWorkshopRooms({
        agents: directory.agents,
        workspaces: directory.workspaces,
        processTrees: procQuery.data?.agents ?? [],
        scopeWorkspaceId: activeScopeId,
        query,
        showClosed,
      }),
    [directory.agents, directory.workspaces, procQuery.data?.agents, activeScopeId, query, showClosed],
  );

  const selected = useMemo(
    () => (selectedId ? allItems.find((i) => i.id === selectedId) ?? null : null),
    [allItems, selectedId],
  );

  const archiveRoom: WorkshopRoom | null = useMemo(
    () => (archiveRoomId !== null ? rooms.find((r) => r.workspaceId === archiveRoomId) ?? null : null),
    [rooms, archiveRoomId],
  );

  const totalCpu = rooms.reduce((sum, r) => sum + r.totalCpu, 0);
  const totalRss = rooms.reduce((sum, r) => sum + r.totalRssKb, 0);
  const totalProcs = rooms.reduce((sum, r) => sum + r.totalProcesses, 0);
  const autoSweepEnabled = procQuery.data?.autoSweepEnabled ?? true;

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

  const iconBtnStyle = (active = false) => ({
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: active ? theme.colors.accent : theme.colors.border,
    backgroundColor: active ? theme.colors.surface2 : theme.colors.surface0,
  });

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface0 }}>
      {/* Sleek Paseo-native toolbar */}
      <View
        style={{
          paddingHorizontal: compact ? 8 : 12,
          paddingVertical: 7,
          gap: 6,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
          backgroundColor: theme.colors.surface1,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 6,
          }}
        >
          {/* Left segmented controls */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 5 }}>
            <Pressable
              onPress={() => setViewMode((m) => (m === "workshop" ? "list" : "workshop"))}
              accessibilityRole="button"
              accessibilityLabel="Toggle Workshop or List view"
              style={iconBtnStyle(true)}
            >
              <Icon
                name={viewMode === "workshop" ? "Hammer" : "List"}
                size={13}
                color={theme.colors.accent}
              />
              <Text style={{ color: theme.colors.foreground, fontSize: 11, fontWeight: "600" }}>
                {viewMode === "workshop" ? "工坊" : "列表"}
              </Text>
            </Pressable>

            {initialWorkspaceId ? (
              <Pressable
                onPress={() => setScopeAll((v) => !v)}
                accessibilityRole="button"
                style={iconBtnStyle(scopeAll)}
              >
                <Icon
                  name={scopeAll ? "Globe" : "Folder"}
                  size={13}
                  color={scopeAll ? theme.colors.accent : theme.colors.foregroundMuted}
                />
                <Text style={{ color: theme.colors.foreground, fontSize: 11 }}>
                  {scopeAll ? "全部" : "当前"}
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              disabled={toggleSweepMutation.isPending}
              onPress={() => toggleSweepMutation.mutate(!autoSweepEnabled)}
              accessibilityRole="button"
              accessibilityLabel="Toggle automatic orphan cleanup"
              style={iconBtnStyle(autoSweepEnabled)}
            >
              <Icon
                name={autoSweepEnabled ? "ShieldCheck" : "ShieldOff"}
                size={13}
                color={autoSweepEnabled ? theme.colors.statusSuccess : theme.colors.foregroundMuted}
              />
              <Text
                style={{
                  color: autoSweepEnabled ? theme.colors.foreground : theme.colors.foregroundMuted,
                  fontSize: 11,
                }}
              >
                自动清理
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setShowClosed((v) => !v)}
              accessibilityRole="button"
              style={iconBtnStyle(showClosed)}
            >
              <Icon
                name="Archive"
                size={13}
                color={showClosed ? theme.colors.accent : theme.colors.foregroundMuted}
              />
              {!compact ? (
                <Text style={{ color: theme.colors.foreground, fontSize: 11 }}>已关闭</Text>
              ) : null}
            </Pressable>

            {viewMode === "workshop" ? (
              <View style={{ flexDirection: "row", gap: 3 }}>
                <Pressable
                  onPress={() => setScale((s) => Math.max(1.5, s - 0.5))}
                  accessibilityLabel="Zoom out"
                  style={iconBtnStyle(false)}
                >
                  <Icon name="ZoomOut" size={13} color={theme.colors.foregroundMuted} />
                </Pressable>
                <Pressable
                  onPress={() => setScale((s) => Math.min(3.5, s + 0.5))}
                  accessibilityLabel="Zoom in"
                  style={iconBtnStyle(false)}
                >
                  <Icon name="ZoomIn" size={13} color={theme.colors.foregroundMuted} />
                </Pressable>
              </View>
            ) : null}
          </View>

          {/* Right live resource summary */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Icon name="Cpu" size={12} color={theme.colors.foregroundMuted} />
            <Text style={{ color: theme.colors.foregroundMuted, fontSize: 11 }}>
              {totalProcs}p · {formatCpu(totalCpu)} · {formatMemory(totalRss)}
            </Text>
          </View>
        </View>

        {/* Compact search & refresh row */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 8,
              borderRadius: 6,
              borderWidth: 1,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface0,
            }}
          >
            <Icon name="Search" size={13} color={theme.colors.foregroundMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="搜索 Agent、Workspace、PID 或命令…"
              placeholderTextColor={theme.colors.foregroundMuted}
              style={{
                flex: 1,
                paddingVertical: 4,
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

          <Pressable
            onPress={() => {
              directory.reload();
              void procQuery.refetch();
            }}
            accessibilityLabel="Refresh"
            style={iconBtnStyle(false)}
          >
            <Icon name="RefreshCw" size={13} color={theme.colors.foregroundMuted} />
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

      {/* Main split body: 2.5D Workshop Canvas / List + Dual-Tab Dock */}
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
