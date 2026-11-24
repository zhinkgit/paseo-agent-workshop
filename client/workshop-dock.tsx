// Sleek Paseo-native dual-tab inspector dock with Lucide icons, permission controls,
// recent chat tail, and full process tree Stop / Optimize actions.
import type { PluginTheme } from "@getpaseo/plugin";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import type { ProcessRowView } from "../shared/contracts";
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
  onOpenAgent?: (agentId: string) => void;
  onStopProcess: (row: ProcessRowView) => Promise<void>;
  onStopAllProcesses: (agentId: string) => Promise<void>;
  onOptimizeProcess: (row: ProcessRowView) => Promise<void>;
  compact: boolean;
}

type DockTab = "activity" | "processes";

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
  const [draft, setDraft] = useState("");
  const [showComposer, setShowComposer] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [chatRefresh, setChatRefresh] = useState(0);

  const activeTab: DockTab =
    selected?.state === "runaway" && !selected.agent ? "processes" : tab;

  const { items: chatItems, loading: chatLoading } = useSelectedChat(
    paseo,
    selected?.agent ? selected.id : null,
    chatRefresh,
  );

  const runAction = async (key: string, okMsg: string, fn: () => Promise<void>) => {
    setBusyKey(key);
    setNotice(null);
    try {
      await fn();
      setNotice(okMsg);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyKey(null);
    }
  };

  if (!selected && archiveRoom) {
    return (
      <View
        style={{
          flex: compact ? 0.95 : undefined,
          width: compact ? undefined : 340,
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
              {archiveRoom.name} · 档案箱 ({archiveRoom.archived.length})
            </Text>
          </View>
          <Pressable onPress={onClose} accessibilityLabel="Close">
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
        width: compact ? undefined : 360,
        borderTopWidth: compact ? 1 : 0,
        borderLeftWidth: compact ? 0 : 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface0,
      }}
    >
      {/* Unified header */}
      <View
        style={{
          padding: 10,
          gap: 8,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
          backgroundColor: theme.colors.surface1,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
            <PixelSprite
              bitmap={STATE_ICONS[selected.state]}
              colors={palette.colors}
              paletteKey={palette.key}
              scale={2}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                numberOfLines={1}
                style={{ color: theme.colors.foreground, fontSize: 13, fontWeight: "700" }}
              >
                {selected.title}
              </Text>
              <Text numberOfLines={1} style={{ color: theme.colors.foregroundMuted, fontSize: 11 }}>
                {STATE_LABEL[selected.state]} · {selected.processCount}p · {formatCpu(selected.cpu)} ·{" "}
                {formatMemory(selected.rssKb)}
              </Text>
            </View>
          </View>
          <Pressable onPress={onClose} accessibilityLabel="Close dock" style={{ padding: 2 }}>
            <Icon name="X" size={15} color={theme.colors.foregroundMuted} />
          </Pressable>
        </View>

        {/* Sleek icon action bar */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {selected.agent && onOpenAgent ? (
            <Pressable
              onPress={() => onOpenAgent(selected.id)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 6,
                backgroundColor: theme.colors.accent,
              }}
            >
              <Icon name="ExternalLink" size={12} color={theme.colors.accentForeground} />
              <Text style={{ color: theme.colors.accentForeground, fontSize: 11, fontWeight: "600" }}>
                打开
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
              disabled={busyKey !== null}
              onPress={() =>
                void runAction("archive", "已归档", async () => {
                  await paseo.agents.ref(selected.id).archive();
                })
              }
              style={actionBtn}
            >
              <Icon name="Archive" size={12} color={theme.colors.foregroundMuted} />
              <Text style={{ color: theme.colors.foreground, fontSize: 11, fontWeight: "500" }}>
                归档
              </Text>
            </Pressable>
          ) : null}

          {selected.processCount > 0 ? (
            <Pressable
              disabled={busyKey !== null}
              onPress={() =>
                void runAction("stop-all", "已发送停止信号", () => onStopAllProcesses(selected.id))
              }
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
                全停 ({selected.processCount})
              </Text>
            </Pressable>
          ) : null}
        </View>

        {showComposer && selected.agent ? (
          <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="给该 Agent 发送消息…"
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
              disabled={!draft.trim() || busyKey !== null}
              onPress={() => {
                const msg = draft.trim();
                if (!msg) return;
                void runAction("send", "消息已发送", async () => {
                  await paseo.agents.ref(selected.id).send(msg);
                  setDraft("");
                  setShowComposer(false);
                  setChatRefresh((n) => n + 1);
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
                发送
              </Text>
            </Pressable>
          </View>
        ) : null}

        {notice ? (
          <Text style={{ color: theme.colors.accent, fontSize: 11 }}>{notice}</Text>
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
            动态{pendingPermissions.length > 0 ? ` (${pendingPermissions.length})` : ""}
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
            进程 ({selected.processCount})
          </Text>
        </Pressable>
      </View>

      {/* Tab Body */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 10, gap: 8 }}>
        {activeTab === "activity" ? (
          <>
            {pendingPermissions.map((perm) => (
              <View
                key={perm.id}
                style={{
                  padding: 9,
                  borderRadius: 7,
                  borderWidth: 1,
                  borderColor: theme.colors.statusWarning,
                  backgroundColor: theme.colors.surface1,
                  gap: 6,
                }}
              >
                <Text style={{ color: theme.colors.foreground, fontSize: 12, fontWeight: "700" }}>
                  待审批：{perm.name}
                </Text>
                {perm.title ? (
                  <Text style={{ color: theme.colors.foregroundMuted, fontSize: 11 }}>
                    {perm.title}
                  </Text>
                ) : null}
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <Pressable
                    disabled={busyKey !== null}
                    onPress={() =>
                      void runAction(`allow-${perm.id}`, "已允许", async () => {
                        await paseo.agents.ref(selected.id).respondToPermission({
                          requestId: perm.id,
                          response: { behavior: "allow" },
                        });
                      })
                    }
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 5,
                      backgroundColor: theme.colors.statusSuccess,
                    }}
                  >
                    <Text style={{ color: "#ffffff", fontSize: 11, fontWeight: "700" }}>Allow</Text>
                  </Pressable>
                  <Pressable
                    disabled={busyKey !== null}
                    onPress={() =>
                      void runAction(`deny-${perm.id}`, "已拒绝", async () => {
                        await paseo.agents.ref(selected.id).respondToPermission({
                          requestId: perm.id,
                          response: { behavior: "deny", message: "Denied from Agent Workshop" },
                        });
                      })
                    }
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 5,
                      backgroundColor: theme.colors.statusDanger,
                    }}
                  >
                    <Text style={{ color: "#ffffff", fontSize: 11, fontWeight: "700" }}>Deny</Text>
                  </Pressable>
                  {onOpenAgent ? (
                    <Pressable
                      onPress={() => onOpenAgent(selected.id)}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 5,
                        borderWidth: 1,
                        borderColor: theme.colors.border,
                      }}
                    >
                      <Text style={{ color: theme.colors.foreground, fontSize: 11 }}>Review</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ))}

            {!selected.agent ? (
              <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12 }}>
                该 Agent 已结束或已归档，请切换到「进程」查看并处理残留进程。
              </Text>
            ) : chatLoading && chatItems.length === 0 ? (
              <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12 }}>
                加载近期动态中…
              </Text>
            ) : chatItems.length === 0 ? (
              <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12 }}>
                暂无近期对话记录。
              </Text>
            ) : (
              chatItems.map((entry) => (
                <View
                  key={entry.id}
                  style={{
                    paddingHorizontal: 9,
                    paddingVertical: 6,
                    borderRadius: 6,
                    backgroundColor:
                      entry.role === "user" ? theme.colors.surface2 : theme.colors.surface1,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    gap: 2,
                  }}
                >
                  <Text
                    style={{
                      color: theme.colors.foregroundMuted,
                      fontSize: 10,
                      fontWeight: "700",
                    }}
                  >
                    {entry.role === "user"
                      ? "你"
                      : entry.role === "assistant"
                        ? "Agent"
                        : entry.role === "tool"
                          ? "工具"
                          : "系统"}
                  </Text>
                  <Text style={{ color: theme.colors.foreground, fontSize: 12 }}>{entry.text}</Text>
                </View>
              ))
            )}
          </>
        ) : (
          <>
            {selected.rows.length === 0 ? (
              <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12 }}>
                当前没有检测到归属该 Agent 的活跃操作系统进程。
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
                      padding: 8,
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
                            disabled={busyKey !== null}
                            onPress={() =>
                              void runAction(
                                `opt-${row.pid}`,
                                "已派发优化 Agent",
                                () => onOptimizeProcess(row),
                              )
                            }
                            style={actionBtn}
                          >
                            <Icon name="Sparkles" size={11} color={theme.colors.accent} />
                            <Text style={{ color: theme.colors.foreground, fontSize: 11 }}>
                              Optimize
                            </Text>
                          </Pressable>
                        ) : null}
                        <Pressable
                          disabled={busyKey !== null}
                          onPress={() =>
                            void runAction(
                              `stop-${row.pid}`,
                              `已停止 PID ${row.pid}`,
                              () => onStopProcess(row),
                            )
                          }
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
                            Stop
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
