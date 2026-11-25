// Refined Chinese Detail Dock: clean conversation-only Activity stream (tool spam hidden by default
// with optional toggle), Agent-to-Agent delegation badges, and full Process tree Stop / AI Optimize controls.
import type { PluginTheme } from "@getpaseo/plugin";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import type { ProcessRowView, StopResult } from "../shared/contracts";
import { formatCpu, formatElapsed, formatMemory, shortenMiddle, splitCommand } from "../shared/format";
import type { PaseoApi } from "./paseo-types";
import { PixelSprite } from "./pixel-sprite";
import { useSelectedChat } from "./use-feed";
import { STATE_ICONS, workshopPalette } from "./workshop-art";
import { STATE_LABEL, type WorkshopAgent, type WorkshopRoom } from "./workshop-model";

export interface WorkshopDockProps {
  theme: PluginTheme;
  paseo: PaseoApi;
  selected: WorkshopAgent | null;
  archiveRoom: WorkshopRoom | null;
  onSelectAgent: (agentId: string) => void;
  onClose: () => void;
  onOpenAgent?: (agentId: string, workspaceId?: string) => void;
  onStopProcess: (row: ProcessRowView) => Promise<StopResult>;
  onStopAllProcesses: (agentId: string) => Promise<StopResult>;
  onOptimizeProcess: (row: ProcessRowView) => Promise<void>;
  compact: boolean;
}

type DockTab = "activity" | "processes";

function formatStopMessage(res: StopResult, label: string): string {
  if (res.failed > 0) {
    return `${label}失败：${res.error ?? "权限不足或进程拒绝终止"}`;
  }
  if (res.signalled === 0 && res.stopped === 0) {
    return `${label}：进程已退出或未找到目标`;
  }
  if (res.stillRunning > 0) {
    return `已向 ${label} 发送停止信号（${res.stillRunning} 个仍在退出，超时后强制终止）`;
  }
  return `已停止 ${res.stopped} 个进程`;
}

export function WorkshopDock({
  theme,
  paseo,
  selected,
  archiveRoom,
  onSelectAgent,
  onClose,
  onOpenAgent,
  onStopProcess,
  onStopAllProcesses,
  onOptimizeProcess,
  compact,
}: WorkshopDockProps) {
  const palette = useMemo(() => workshopPalette(theme), [theme]);
  const [tab, setTab] = useState<DockTab>("activity");
  const [showTools, setShowTools] = useState(false);
  const [draft, setDraft] = useState("");
  const [showComposer, setShowComposer] = useState(false);
  const [busyKeys, setBusyKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [notice, setNotice] = useState<{ text: string; isError?: boolean } | null>(null);
  const [chatRefresh, setChatRefresh] = useState(0);

  const selectedIdRef = useRef<string | null>(selected?.id ?? null);
  selectedIdRef.current = selected?.id ?? null;

  useEffect(() => {
    setDraft("");
    setShowComposer(false);
    setNotice(null);
    setShowTools(false);
  }, [selected?.id]);

  const activeTab: DockTab =
    selected?.state === "runaway" && !selected.agent ? "processes" : tab;

  const { conversation, tools, loading: chatLoading } = useSelectedChat(
    paseo,
    selected?.agent ? selected.id : null,
    chatRefresh,
  );

  const isBusy = (key: string) => busyKeys.has(key);

  const runAction = async (
    key: string,
    originAgentId: string,
    fn: () => Promise<{ text: string; isError?: boolean }>,
  ) => {
    setBusyKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    if (selectedIdRef.current === originAgentId) setNotice(null);
    try {
      const result = await fn();
      if (selectedIdRef.current === originAgentId) setNotice(result);
    } catch (err) {
      if (selectedIdRef.current === originAgentId) {
        setNotice({ text: err instanceof Error ? err.message : String(err), isError: true });
      }
    } finally {
      setBusyKeys((prev) => {
        if (!prev.has(key)) return prev;
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  if (!selected && archiveRoom) {
    return (
      <View
        style={{
          flex: compact ? 0.95 : undefined,
          width: compact ? undefined : 350,
          borderTopWidth: compact ? 1 : 0,
          borderLeftWidth: compact ? 0 : 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface0,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
            backgroundColor: theme.colors.surface1,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Icon name="Archive" size={14} color={theme.colors.foregroundMuted} />
            <Text style={{ color: theme.colors.foreground, fontSize: 12, fontWeight: "700" }}>
              {archiveRoom.projectName} · 档案箱（{archiveRoom.archived.length}）
            </Text>
          </View>
          <Pressable onPress={onClose} accessibilityLabel="关闭档案箱">
            <Icon name="X" size={15} color={theme.colors.foregroundMuted} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 10, gap: 6 }}>
          {archiveRoom.archived.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => onSelectAgent(item.id)}
              style={{
                padding: 8,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface1,
                gap: 2,
              }}
            >
              <Text numberOfLines={1} style={{ color: theme.colors.foreground, fontSize: 12, fontWeight: "600" }}>
                {item.title}
              </Text>
              <Text style={{ color: theme.colors.foregroundMuted, fontSize: 11 }}>
                {item.modelLabel} · 已关闭
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    );
  }

  if (!selected) return null;

  const pendingPermissions = selected.agent?.pendingPermissions ?? [];

  const actionBtn = {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface0,
  };

  return (
    <View
      style={{
        flex: compact ? 1.05 : undefined,
        width: compact ? undefined : 380,
        borderTopWidth: compact ? 1 : 0,
        borderLeftWidth: compact ? 0 : 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface0,
      }}
    >
      {/* Unified header */}
      <View
        style={{
          padding: 12,
          gap: 8,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
          backgroundColor: theme.colors.surface1,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, flex: 1, minWidth: 0 }}>
            <View style={{ marginTop: 2 }}>
              <PixelSprite
                bitmap={STATE_ICONS[selected.state]}
                colors={palette.colors}
                paletteKey={palette.key}
                scale={2}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text
                numberOfLines={2}
                style={{ color: theme.colors.foreground, fontSize: 13, fontWeight: "700", lineHeight: 18 }}
              >
                {selected.title}
              </Text>
              <Text numberOfLines={1} style={{ color: theme.colors.foregroundMuted, fontSize: 11 }}>
                {selected.projectName} · {STATE_LABEL[selected.state]} · {selected.processCount} 进程 ·{" "}
                {formatCpu(selected.cpu)} · {formatMemory(selected.rssKb)}
              </Text>
            </View>
          </View>
          <Pressable onPress={onClose} accessibilityLabel="关闭详情栏" style={{ padding: 2 }}>
            <Icon name="X" size={15} color={theme.colors.foregroundMuted} />
          </Pressable>
        </View>

        {/* Action bar */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {selected.agent && onOpenAgent ? (
            <Pressable
              onPress={() => onOpenAgent(selected.id, selected.workspaceId)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                paddingHorizontal: 9,
                paddingVertical: 4,
                borderRadius: 6,
                backgroundColor: theme.colors.accent,
              }}
            >
              <Icon name="ExternalLink" size={12} color={theme.colors.accentForeground} />
              <Text style={{ color: theme.colors.accentForeground, fontSize: 11, fontWeight: "600" }}>
                打开会话
              </Text>
            </Pressable>
          ) : null}

          {selected.agent && selected.state !== "closed" && selected.state !== "runaway" ? (
            <Pressable onPress={() => setShowComposer((v) => !v)} style={actionBtn}>
              <Icon name="Send" size={12} color={theme.colors.foregroundMuted} />
              <Text style={{ color: theme.colors.foreground, fontSize: 11, fontWeight: "500" }}>
                发消息
              </Text>
            </Pressable>
          ) : null}

          {selected.agent && !selected.agent.archivedAt ? (
            <Pressable
              disabled={isBusy(`archive-${selected.id}`)}
              onPress={() => {
                const targetId = selected.id;
                void runAction(`archive-${targetId}`, targetId, async () => {
                  await paseo.agents.ref(targetId).archive();
                  return { text: "已归档" };
                });
              }}
              style={actionBtn}
            >
              <Icon name="Archive" size={12} color={theme.colors.foregroundMuted} />
              <Text style={{ color: theme.colors.foreground, fontSize: 11, fontWeight: "500" }}>
                {isBusy(`archive-${selected.id}`) ? "归档中…" : "归档"}
              </Text>
            </Pressable>
          ) : null}

          {selected.processCount > 0 ? (
            <Pressable
              disabled={isBusy(`stop-all-${selected.id}`)}
              onPress={() => {
                const targetId = selected.id;
                void runAction(`stop-all-${targetId}`, targetId, async () => {
                  const res = await onStopAllProcesses(targetId);
                  return {
                    text: formatStopMessage(res, "全部进程"),
                    isError: res.failed > 0,
                  };
                });
              }}
              style={
                selected.state === "runaway"
                  ? {
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 6,
                      backgroundColor: theme.colors.statusDanger,
                    }
                  : actionBtn
              }
            >
              <Icon
                name="Square"
                size={11}
                color={selected.state === "runaway" ? "#ffffff" : theme.colors.statusDanger}
              />
              <Text
                style={{
                  color: selected.state === "runaway" ? "#ffffff" : theme.colors.foreground,
                  fontSize: 11,
                  fontWeight: "600",
                }}
              >
                {isBusy(`stop-all-${selected.id}`) ? "停止中…" : `停止全部 (${selected.processCount})`}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {showComposer && selected.agent ? (
          <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="给该智能体发送消息…"
              placeholderTextColor={theme.colors.foregroundMuted}
              style={{
                flex: 1,
                paddingHorizontal: 8,
                paddingVertical: 5,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: theme.colors.border,
                color: theme.colors.foreground,
                backgroundColor: theme.colors.surface0,
                fontSize: 12,
              }}
            />
            <Pressable
              disabled={!draft.trim() || isBusy(`send-${selected.id}`)}
              onPress={() => {
                const targetId = selected.id;
                const msg = draft.trim();
                if (!msg) return;
                void runAction(`send-${targetId}`, targetId, async () => {
                  await paseo.agents.ref(targetId).send(msg);
                  if (selectedIdRef.current === targetId) {
                    setDraft("");
                    setShowComposer(false);
                    setChatRefresh((n) => n + 1);
                  }
                  return { text: "消息已发送" };
                });
              }}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 6,
                backgroundColor: theme.colors.accent,
              }}
            >
              <Text style={{ color: theme.colors.accentForeground, fontSize: 11, fontWeight: "600" }}>
                {isBusy(`send-${selected.id}`) ? "发送中…" : "发送"}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {notice ? (
          <Text
            style={{
              color: notice.isError ? theme.colors.statusDanger : theme.colors.accent,
              fontSize: 11,
            }}
          >
            {notice.text}
          </Text>
        ) : null}
      </View>

      {/* Dual Tab bar */}
      <View
        style={{
          flexDirection: "row",
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
          backgroundColor: theme.colors.surface1,
        }}
      >
        <Pressable
          onPress={() => setTab("activity")}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
            paddingVertical: 8,
            borderBottomWidth: 2,
            borderBottomColor: activeTab === "activity" ? theme.colors.accent : "transparent",
          }}
        >
          <Icon
            name="MessageSquare"
            size={12}
            color={activeTab === "activity" ? theme.colors.accent : theme.colors.foregroundMuted}
          />
          <Text
            style={{
              color:
                activeTab === "activity" ? theme.colors.foreground : theme.colors.foregroundMuted,
              fontSize: 12,
              fontWeight: activeTab === "activity" ? "700" : "500",
            }}
          >
            对话动态{pendingPermissions.length > 0 ? ` (${pendingPermissions.length})` : ""}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab("processes")}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
            paddingVertical: 8,
            borderBottomWidth: 2,
            borderBottomColor: activeTab === "processes" ? theme.colors.accent : "transparent",
          }}
        >
          <Icon
            name="Cpu"
            size={12}
            color={activeTab === "processes" ? theme.colors.accent : theme.colors.foregroundMuted}
          />
          <Text
            style={{
              color:
                activeTab === "processes" ? theme.colors.foreground : theme.colors.foregroundMuted,
              fontSize: 12,
              fontWeight: activeTab === "processes" ? "700" : "500",
            }}
          >
            进程资源 ({selected.processCount})
          </Text>
        </Pressable>
      </View>

      {/* Tab Body */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, gap: 10 }}>
        {activeTab === "activity" ? (
          <>
            {/* Delegation links (if this agent called other agents) */}
            {selected.callingTargets.length > 0 ? (
              <View
                style={{
                  padding: 9,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.surface1,
                  gap: 5,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Icon name="GitBranch" size={12} color={theme.colors.accent} />
                  <Text style={{ color: theme.colors.foreground, fontSize: 11, fontWeight: "700" }}>
                    已调用其他智能体（{selected.callingTargets.length}）
                  </Text>
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {selected.callingTargets.map((child) => (
                    <Pressable
                      key={child.id}
                      onPress={() => onSelectAgent(child.id)}
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: theme.colors.border,
                        backgroundColor: theme.colors.surface0,
                      }}
                    >
                      <Text style={{ color: theme.colors.foreground, fontSize: 11 }}>
                        ⟶ {child.title}（{STATE_LABEL[child.state]}）
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Pending permissions */}
            {pendingPermissions.map((perm) => (
              <View
                key={perm.id}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: theme.colors.statusWarning,
                  backgroundColor: theme.colors.surface1,
                  gap: 6,
                }}
              >
                <Text style={{ color: theme.colors.foreground, fontSize: 12, fontWeight: "700" }}>
                  待审批权限：{perm.name}
                </Text>
                {perm.title ? (
                  <Text style={{ color: theme.colors.foregroundMuted, fontSize: 11 }}>
                    {perm.title}
                  </Text>
                ) : null}
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <Pressable
                    disabled={isBusy(`perm-${perm.id}`)}
                    onPress={() => {
                      const targetId = selected.id;
                      void runAction(`perm-${perm.id}`, targetId, async () => {
                        await paseo.agents.ref(targetId).respondToPermission({
                          requestId: perm.id,
                          response: { behavior: "allow" },
                        });
                        return { text: "已允许" };
                      });
                    }}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 5,
                      backgroundColor: theme.colors.statusSuccess,
                    }}
                  >
                    <Text style={{ color: "#ffffff", fontSize: 11, fontWeight: "700" }}>允许</Text>
                  </Pressable>
                  <Pressable
                    disabled={isBusy(`perm-${perm.id}`)}
                    onPress={() => {
                      const targetId = selected.id;
                      void runAction(`perm-${perm.id}`, targetId, async () => {
                        await paseo.agents.ref(targetId).respondToPermission({
                          requestId: perm.id,
                          response: { behavior: "deny", message: "已在智能体工坊中拒绝" },
                        });
                        return { text: "已拒绝" };
                      });
                    }}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 5,
                      backgroundColor: theme.colors.statusDanger,
                    }}
                  >
                    <Text style={{ color: "#ffffff", fontSize: 11, fontWeight: "700" }}>拒绝</Text>
                  </Pressable>
                  {onOpenAgent ? (
                    <Pressable
                      onPress={() => onOpenAgent(selected.id, selected.workspaceId)}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 5,
                        borderWidth: 1,
                        borderColor: theme.colors.border,
                      }}
                    >
                      <Text style={{ color: theme.colors.foreground, fontSize: 11 }}>查看详情</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ))}

            {/* Clean Chat Bubbles (User & Assistant only by default; tool calls hidden) */}
            {!selected.agent ? (
              <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12 }}>
                该智能体已结束或已归档，请切换到「进程资源」处理残留进程。
              </Text>
            ) : chatLoading && conversation.length === 0 ? (
              <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12 }}>
                加载近期对话中…
              </Text>
            ) : conversation.length === 0 ? (
              <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12 }}>
                暂无近期对话消息。
              </Text>
            ) : (
              conversation.map((entry) => {
                const isUser = entry.role === "user";
                const isErr = entry.role === "system";
                const isDel = entry.role === "delegation";
                return (
                  <View
                    key={entry.id}
                    style={{
                      alignSelf: isUser ? "flex-end" : "stretch",
                      maxWidth: isUser ? "88%" : "100%",
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                      borderRadius: 9,
                      backgroundColor: isUser
                        ? theme.colors.accent
                        : isErr
                          ? theme.colors.surface1
                          : theme.colors.surface1,
                      borderWidth: isUser ? 0 : 1,
                      borderColor: isErr
                        ? theme.colors.statusDanger
                        : isDel
                          ? theme.colors.accent
                          : theme.colors.border,
                      gap: 3,
                    }}
                  >
                    <Text
                      style={{
                        color: isUser
                          ? theme.colors.accentForeground
                          : isErr
                            ? theme.colors.statusDanger
                            : theme.colors.foregroundMuted,
                        fontSize: 10,
                        fontWeight: "700",
                        opacity: isUser ? 0.85 : 1,
                      }}
                    >
                      {isUser ? "我" : isDel ? "智能体协作" : isErr ? "系统异常" : "智能体"}
                    </Text>
                    <Text
                      style={{
                        color: isUser ? theme.colors.accentForeground : theme.colors.foreground,
                        fontSize: 12,
                        lineHeight: 18,
                      }}
                    >
                      {entry.text}
                    </Text>
                  </View>
                );
              })
            )}

            {/* Quiet opt-in toggle for tool call history (OFF by default) */}
            {tools.length > 0 ? (
              <View style={{ marginTop: 4, gap: 6 }}>
                <Pressable
                  onPress={() => setShowTools((v) => !v)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" }}
                >
                  <Icon
                    name={showTools ? "ChevronDown" : "ChevronRight"}
                    size={12}
                    color={theme.colors.foregroundMuted}
                  />
                  <Text style={{ color: theme.colors.foregroundMuted, fontSize: 11 }}>
                    {showTools ? "隐藏工具调用记录" : `查看近期工具调用（${tools.length} 条）`}
                  </Text>
                </Pressable>
                {showTools ? (
                  <View style={{ gap: 4 }}>
                    {tools.map((t) => (
                      <Text
                        key={t.id}
                        style={{ color: theme.colors.foregroundMuted, fontSize: 11, paddingLeft: 12 }}
                      >
                        • {t.text}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}
          </>
        ) : (
          <>
            {selected.rows.length === 0 ? (
              <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12 }}>
                当前没有检测到归属该智能体的活跃操作系统进程。
              </Text>
            ) : (
              selected.rows.map((row) => {
                const { name, rest } = splitCommand(row.command);
                const indent = Math.min(row.depth, 5) * 12;
                return (
                  <View
                    key={`${row.pid}@${row.started}`}
                    style={{
                      marginLeft: indent,
                      padding: 9,
                      borderRadius: 7,
                      borderWidth: 1,
                      borderColor: row.detached ? theme.colors.statusWarning : theme.colors.border,
                      backgroundColor: theme.colors.surface1,
                      gap: 5,
                    }}
                  >
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
                          color: theme.colors.foreground,
                          fontSize: 12,
                          fontWeight: "700",
                          flex: 1,
                        }}
                      >
                        {name}
                      </Text>
                      <Text style={{ color: theme.colors.foregroundMuted, fontSize: 10 }}>
                        PID {row.pid} · {formatCpu(row.cpu)} · {formatMemory(row.rssKb)} ·{" "}
                        {formatElapsed(row.elapsed)}
                      </Text>
                    </View>

                    {rest ? (
                      <Text
                        numberOfLines={2}
                        style={{ color: theme.colors.foregroundMuted, fontSize: 11 }}
                      >
                        {shortenMiddle(rest, 92)}
                      </Text>
                    ) : null}

                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 6,
                      }}
                    >
                      <Text style={{ color: theme.colors.statusWarning, fontSize: 10 }}>
                        {row.detached ? "父进程已退出（脱离孤儿）" : ""}
                      </Text>
                      <View style={{ flexDirection: "row", gap: 6 }}>
                        {selected.agent ? (
                          <Pressable
                            disabled={isBusy(`opt-${row.pid}@${row.started}`)}
                            onPress={() => {
                              const targetId = selected.id;
                              void runAction(`opt-${row.pid}@${row.started}`, targetId, async () => {
                                await onOptimizeProcess(row);
                                return { text: "已派发优化智能体" };
                              });
                            }}
                            style={actionBtn}
                          >
                            <Icon name="Sparkles" size={11} color={theme.colors.accent} />
                            <Text style={{ color: theme.colors.foreground, fontSize: 11 }}>
                              {isBusy(`opt-${row.pid}@${row.started}`) ? "派发中…" : "AI 优化"}
                            </Text>
                          </Pressable>
                        ) : null}
                        <Pressable
                          disabled={isBusy(`stop-${row.pid}@${row.started}`)}
                          onPress={() => {
                            const targetId = selected.id;
                            void runAction(`stop-${row.pid}@${row.started}`, targetId, async () => {
                              const res = await onStopProcess(row);
                              return {
                                text: formatStopMessage(res, `PID ${row.pid}`),
                                isError: res.failed > 0,
                              };
                            });
                          }}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 6,
                            backgroundColor: theme.colors.statusDanger,
                          }}
                        >
                          <Icon name="Square" size={10} color="#ffffff" />
                          <Text style={{ color: "#ffffff", fontSize: 11, fontWeight: "600" }}>
                            {isBusy(`stop-${row.pid}@${row.started}`) ? "停止中…" : "停止"}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
