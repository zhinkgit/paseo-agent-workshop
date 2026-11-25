// Studio-Workshop pixel canvas with integrated per-room Big Screen, separated workspace/title display,
// in-scene console controls (Open / Message / Archive / Stop), and Agent-to-Agent delegation visualization.
import type { PluginTheme } from "@getpaseo/plugin";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
} from "react-native";
import type { StopResult } from "../shared/contracts";
import { formatCpu, formatMemory } from "../shared/format";
import { PixelSprite } from "./pixel-sprite";
import type { ActiveEnvelope, LatestMessagePreview } from "./use-feed";
import {
  ARCHIVE_CHEST,
  artisanColors,
  artisanFrames,
  benchSprite,
  ENVELOPE_SPRITE,
  machineFrames,
  WORKBENCH_SPRITE,
  workshopPalette,
  type WorkshopPalette,
} from "./workshop-art";
import { buildWorkshopBackdrop, computeRoomGeometry, type RoomGeometry } from "./workshop-backdrop";
import { STATE_LABEL, type WorkshopAgent, type WorkshopRoom } from "./workshop-model";

export interface WorkshopCanvasProps {
  theme: PluginTheme;
  rooms: readonly WorkshopRoom[];
  /** Currently opened agent in the Detail Dock (null if dock is closed). */
  selectedId: string | null;
  /** Opens/toggles the Detail Dock for this agent (triggered by clicking the room's Big Screen). */
  onOpenDetail: (agentId: string) => void;
  onSelectArchive: (room: WorkshopRoom) => void;
  onOpenAgent?: (agentId: string, workspaceId?: string) => void;
  onSendMessage: (agentId: string, text: string) => Promise<void>;
  onArchiveAgent: (agentId: string) => Promise<void>;
  onStopAllProcesses: (agentId: string) => Promise<StopResult>;
  toolByAgent: ReadonlyMap<string, string>;
  latestByAgent: ReadonlyMap<string, LatestMessagePreview>;
  envelopes: readonly ActiveEnvelope[];
  compact: boolean;
  zoom: number;
}

const WalkingArtisan = memo(function WalkingArtisan({
  item,
  palette,
  targetX,
  targetY,
  scale,
  frame,
  focused,
  bubbleText,
  bubbleTone,
  onPress,
}: {
  item: WorkshopAgent;
  palette: WorkshopPalette;
  targetX: number;
  targetY: number;
  scale: number;
  frame: number;
  focused: boolean;
  bubbleText: string | null;
  bubbleTone: "tool" | "warn" | "danger";
  onPress: () => void;
}) {
  const pos = useRef(new Animated.ValueXY({ x: targetX, y: targetY })).current;
  const lastTarget = useRef({ x: targetX, y: targetY });
  const [walking, setWalking] = useState(false);

  useEffect(() => {
    const dx = targetX - lastTarget.current.x;
    const dy = targetY - lastTarget.current.y;
    const dist = Math.hypot(dx, dy);
    lastTarget.current = { x: targetX, y: targetY };

    if (dist < 2) {
      pos.setValue({ x: targetX, y: targetY });
      setWalking(false);
      return;
    }

    setWalking(true);
    const duration = Math.min(1300, Math.max(360, Math.round(dist * 7)));
    const anim = Animated.timing(pos, {
      toValue: { x: targetX, y: targetY },
      duration,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: false,
    });
    anim.start(({ finished }) => {
      if (finished) setWalking(false);
    });
    return () => anim.stop();
  }, [targetX, targetY, pos]);

  const charPalette = useMemo(
    () => artisanColors(palette, item.id, item.role),
    [palette, item.id, item.role],
  );
  const frames = artisanFrames(item.state, walking);
  const sprite = frames[frame % frames.length]!;
  const w = sprite.width * scale;
  const h = sprite.height * scale;

  const bubbleBg =
    bubbleTone === "danger"
      ? "#b91c1c"
      : bubbleTone === "warn"
        ? "#92400e"
        : "#272c33";

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        zIndex: Math.round(targetY) + (focused ? 600 : 120),
        transform: [{ translateX: pos.x }, { translateY: pos.y }],
      }}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`在大屏上聚焦 ${item.title}，当前状态 ${STATE_LABEL[item.state]}`}
        style={{ alignItems: "center" }}
      >
        {bubbleText ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              bottom: h + 2,
              alignItems: "center",
              zIndex: 999,
            }}
          >
            <View
              style={{
                paddingHorizontal: 5,
                paddingVertical: 1.5,
                borderRadius: 2,
                borderWidth: 1,
                borderColor: "#14161a",
                backgroundColor: bubbleBg,
                maxWidth: Math.max(76, w * 2.6),
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  color: "#ffffff",
                  fontSize: 9,
                  fontWeight: "700",
                }}
              >
                {bubbleText}
              </Text>
            </View>
            <View
              style={{
                width: 4,
                height: 3,
                backgroundColor: bubbleBg,
                borderLeftWidth: 1,
                borderRightWidth: 1,
                borderBottomWidth: 1,
                borderColor: "#14161a",
                marginTop: -1,
              }}
            />
          </View>
        ) : null}

        {focused ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              bottom: -2,
              width: w + 8,
              height: Math.max(8, scale * 3.5),
              borderRadius: 999,
              borderWidth: 2,
              borderColor: palette.selectedRing,
              backgroundColor: "rgba(59, 130, 246, 0.16)",
            }}
          />
        ) : null}

        <PixelSprite
          bitmap={sprite}
          colors={charPalette.colors}
          paletteKey={charPalette.key}
          scale={scale}
        />
      </Pressable>
    </Animated.View>
  );
});

const FlyingEnvelope = memo(function FlyingEnvelope({
  from,
  to,
  palette,
  scale,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  palette: WorkshopPalette;
  scale: number;
}) {
  const pos = useRef(new Animated.ValueXY({ x: from.x, y: from.y })).current;

  useEffect(() => {
    pos.setValue({ x: from.x, y: from.y });
    const anim = Animated.timing(pos, {
      toValue: { x: to.x, y: to.y },
      duration: 1800,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [from.x, from.y, to.x, to.y, pos]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        zIndex: 2000,
        transform: [{ translateX: pos.x }, { translateY: pos.y }],
      }}
    >
      <PixelSprite
        bitmap={ENVELOPE_SPRITE}
        colors={palette.colors}
        paletteKey={palette.key}
        scale={Math.max(1.5, scale * 0.85)}
      />
    </Animated.View>
  );
});

/** Draws a dashed connector line between a calling parent agent and its child agent in the same room. */
const DelegationConnector = memo(function DelegationConnector({
  from,
  to,
  color,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  color: string;
}) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length < 8) return null;
  const angle = Math.atan2(dy, dx);
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: midX - length / 2,
        top: midY - 1,
        width: length,
        height: 2,
        borderTopWidth: 2,
        borderStyle: "dashed",
        borderColor: color,
        opacity: 0.85,
        zIndex: 80,
        transform: [{ rotate: `${angle}rad` }],
      }}
    />
  );
});

const WorkshopRoomView = memo(function WorkshopRoomView({
  room,
  theme,
  palette,
  scale,
  frame,
  maxCols,
  availableW,
  selectedId,
  toolByAgent,
  latestByAgent,
  envelopes,
  onOpenDetail,
  onSelectArchive,
  onOpenAgent,
  onSendMessage,
  onArchiveAgent,
  onStopAllProcesses,
}: {
  room: WorkshopRoom;
  theme: PluginTheme;
  palette: WorkshopPalette;
  scale: number;
  frame: number;
  maxCols: number;
  availableW: number;
  selectedId: string | null;
  toolByAgent: ReadonlyMap<string, string>;
  latestByAgent: ReadonlyMap<string, LatestMessagePreview>;
  envelopes: readonly ActiveEnvelope[];
  onOpenDetail: (id: string) => void;
  onSelectArchive: (room: WorkshopRoom) => void;
  onOpenAgent?: (agentId: string, workspaceId?: string) => void;
  onSendMessage: (agentId: string, text: string) => Promise<void>;
  onArchiveAgent: (agentId: string) => Promise<void>;
  onStopAllProcesses: (agentId: string) => Promise<StopResult>;
}) {
  const stations = useMemo(() => [...room.runaways, ...room.benches], [room.runaways, room.benches]);
  const geom: RoomGeometry = useMemo(
    () => computeRoomGeometry(stations.length, maxCols),
    [stations.length, maxCols],
  );
  const backdrop = useMemo(() => buildWorkshopBackdrop(geom), [geom]);

  // Local room focus: which agent is currently displayed on this room's Big Screen.
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [inlineBusy, setInlineBusy] = useState<string | null>(null);
  const [inlineNotice, setInlineNotice] = useState<string | null>(null);

  const activeAgent: WorkshopAgent | null = useMemo(() => {
    if (focusedId) {
      const found = stations.find((s) => s.id === focusedId);
      if (found) return found;
    }
    if (selectedId) {
      const found = stations.find((s) => s.id === selectedId);
      if (found) return found;
    }
    return stations[0] ?? null;
  }, [focusedId, selectedId, stations]);

  // Reset inline composer when switching the focused agent on the Big Screen.
  useEffect(() => {
    setComposerOpen(false);
    setDraft("");
    setInlineNotice(null);
  }, [activeAgent?.id]);

  const coordsByAgent = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    let loungeIdx = 0;
    stations.forEach((item, idx) => {
      const origin = geom.stationOrigin(idx);
      const isResting = item.state === "idle" || item.state === "ready";
      if (isResting && loungeIdx < geom.loungeCapacity) {
        const spot = geom.loungeSpot(loungeIdx++);
        map.set(item.id, { x: spot.x * scale, y: spot.y * scale });
      } else {
        map.set(item.id, { x: (origin.x + 7) * scale, y: (origin.y + 11) * scale });
      }
    });
    return map;
  }, [stations, geom, scale]);

  const roomEnvelopes = envelopes.filter(
    (e) => coordsByAgent.has(e.fromId) && coordsByAgent.has(e.toId),
  );

  const roomPxW = geom.width * scale;
  const roomPxH = geom.height * scale;
  const cardWidth = Math.max(roomPxW, Math.min(availableW, Math.max(roomPxW, 300)));

  const dotColor =
    room.runaways.length > 0
      ? theme.colors.statusDanger
      : room.benches.some((b) => b.state === "needs-input")
        ? theme.colors.statusWarning
        : room.benches.some((b) => b.state === "working")
          ? theme.colors.statusSuccess
          : theme.colors.foregroundMuted;

  const preview = activeAgent ? latestByAgent.get(activeAgent.id) : undefined;
  const isDetailOpenForFocused = Boolean(activeAgent && selectedId === activeAgent.id);

  const runInline = async (key: string, fn: () => Promise<string>) => {
    setInlineBusy(key);
    setInlineNotice(null);
    try {
      const msg = await fn();
      setInlineNotice(msg);
    } catch (err) {
      setInlineNotice(err instanceof Error ? err.message : String(err));
    } finally {
      setInlineBusy(null);
    }
  };

  const consoleBtn = {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface0,
  };

  return (
    <View
      style={{
        width: cardWidth,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: room.runaways.length > 0 ? theme.colors.statusDanger : palette.pillBorder,
        backgroundColor: theme.colors.surface0,
        overflow: "hidden",
      }}
    >
      {/* Separated Room Header: Left = Project/Workspace Name (full, unclipped), Right = Resource Gauge */}
      <View
        style={{
          paddingHorizontal: 10,
          paddingVertical: 7,
          backgroundColor: theme.colors.surface1,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
          gap: 3,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                backgroundColor: dotColor,
              }}
            />
            <Text
              numberOfLines={1}
              style={{
                color: theme.colors.foreground,
                fontSize: 12,
                fontWeight: "700",
                flexShrink: 1,
              }}
            >
              {room.projectName}
            </Text>
          </View>
          <Text style={{ color: theme.colors.foregroundMuted, fontSize: 11 }}>
            {room.totalProcesses > 0
              ? `${room.totalProcesses} 进程 · ${formatCpu(room.totalCpu)} · ${formatMemory(room.totalRssKb)}`
              : `${stations.length} 个智能体`}
          </Text>
        </View>

        {/* Secondary line: Workspace branch/name shown cleanly in its own dedicated slot */}
        {room.workspaceTitle && room.workspaceTitle !== room.projectName ? (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
            <Text
              numberOfLines={1}
              style={{ color: theme.colors.foregroundMuted, fontSize: 11, flex: 1 }}
            >
              工作区：{room.workspaceTitle}
            </Text>
            {room.runaways.length > 0 ? (
              <Text style={{ color: theme.colors.statusDanger, fontSize: 10, fontWeight: "700" }}>
                {room.runaways.length} 个失控残留
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* Pixel Studio Room Scene */}
      <ScrollView
        horizontal={roomPxW > cardWidth}
        showsHorizontalScrollIndicator={roomPxW > cardWidth}
        contentContainerStyle={{ alignItems: "center", justifyContent: "center", minWidth: cardWidth }}
        style={{ backgroundColor: palette.canvasBg }}
      >
        <View style={{ width: roomPxW, height: roomPxH, position: "relative" }}>
          <PixelSprite
            bitmap={backdrop}
            colors={palette.colors}
            paletteKey={palette.key}
            scale={scale}
            style={{ position: "absolute", left: 0, top: 0 }}
          />

          {/* Dashed Delegation Lines between Caller -> Callee agents in the same room */}
          {room.delegations
            .filter((d) => d.sameRoom)
            .map((d) => {
              const from = coordsByAgent.get(d.fromId);
              const to = coordsByAgent.get(d.toId);
              if (!from || !to) return null;
              return (
                <DelegationConnector
                  key={`${d.fromId}->${d.toId}`}
                  from={{ x: from.x + 7 * scale, y: from.y + 9 * scale }}
                  to={{ x: to.x + 7 * scale, y: to.y + 9 * scale }}
                  color={theme.colors.accent}
                />
              );
            })}

          {stations.map((item, idx) => {
            const origin = geom.stationOrigin(idx);
            const benchLeft = origin.x * scale;
            const benchTop = origin.y * scale;
            const podLeft = (origin.x + 28) * scale;
            const podTop = (origin.y + 4) * scale;
            const isRunaway = item.state === "runaway";
            const isFocused = activeAgent?.id === item.id;
            const machineSprite =
              item.machineLoad !== "none" ? machineFrames(item.machineLoad)[frame % 2]! : null;
            const charTarget = coordsByAgent.get(item.id) ?? {
              x: (origin.x + 7) * scale,
              y: (origin.y + 11) * scale,
            };

            const toolWord = toolByAgent.get(item.id);
            const bubbleText = isRunaway
              ? `失控 ${item.processCount}p`
              : item.state === "needs-input"
                ? "待审批"
                : item.state === "failed"
                  ? "异常"
                  : item.callingTargets.length > 0
                    ? `调用→${item.callingTargets[0]!.title.slice(0, 6)}`
                    : toolWord
                      ? toolWord
                      : item.machineLoad === "hot"
                        ? `${formatCpu(item.cpu)}`
                        : null;
            const bubbleTone: "tool" | "warn" | "danger" =
              isRunaway || item.state === "failed"
                ? "danger"
                : item.state === "needs-input" || item.machineLoad === "hot"
                  ? "warn"
                  : "tool";

            return (
              <View key={item.id} style={{ position: "absolute", left: 0, top: 0 }}>
                {/* Clicking bench focuses this agent on the room's Big Screen */}
                <Pressable
                  onPress={() => setFocusedId(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`聚焦 ${item.title} 工作台`}
                  style={{
                    position: "absolute",
                    left: benchLeft,
                    top: benchTop,
                    zIndex: Math.round(benchTop) + 20,
                  }}
                >
                  <PixelSprite
                    bitmap={benchSprite(item.state, frame)}
                    colors={palette.colors}
                    paletteKey={palette.key}
                    scale={scale}
                  />
                </Pressable>

                {machineSprite ? (
                  <Pressable
                    onPress={() => setFocusedId(item.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`聚焦 ${item.title} 进程机械`}
                    style={{
                      position: "absolute",
                      left: podLeft,
                      top: podTop,
                      zIndex: Math.round(podTop) + 25,
                      alignItems: "center",
                    }}
                  >
                    {isRunaway && bubbleText ? (
                      <View
                        pointerEvents="none"
                        style={{
                          position: "absolute",
                          bottom: machineSprite.height * scale + 2,
                          paddingHorizontal: 5,
                          paddingVertical: 1,
                          borderRadius: 2,
                          borderWidth: 1,
                          borderColor: "#14161a",
                          backgroundColor: "#b91c1c",
                          zIndex: 999,
                        }}
                      >
                        <Text style={{ color: "#ffffff", fontSize: 9, fontWeight: "700" }}>
                          {bubbleText}
                        </Text>
                      </View>
                    ) : null}

                    {isFocused && isRunaway ? (
                      <View
                        pointerEvents="none"
                        style={{
                          position: "absolute",
                          bottom: -1,
                          width: machineSprite.width * scale + 6,
                          height: Math.max(7, scale * 3),
                          borderRadius: 999,
                          borderWidth: 2,
                          borderColor: theme.colors.statusDanger,
                          backgroundColor: "rgba(239, 68, 68, 0.2)",
                        }}
                      />
                    ) : null}

                    <PixelSprite
                      bitmap={machineSprite}
                      colors={palette.colors}
                      paletteKey={palette.key}
                      scale={scale}
                    />
                  </Pressable>
                ) : null}

                {/* Clicking character focuses it on the room's Big Screen (does NOT pop detail) */}
                {!isRunaway ? (
                  <WalkingArtisan
                    item={item}
                    palette={palette}
                    targetX={charTarget.x}
                    targetY={charTarget.y}
                    scale={scale}
                    frame={frame}
                    focused={isFocused}
                    bubbleText={bubbleText}
                    bubbleTone={bubbleTone}
                    onPress={() => setFocusedId(item.id)}
                  />
                ) : null}
              </View>
            );
          })}

          {/* Corner Archive Cabinet */}
          {room.archived.length > 0 ? (
            <Pressable
              onPress={() => onSelectArchive(room)}
              accessibilityRole="button"
              accessibilityLabel={`打开档案柜（${room.archived.length} 个已关闭智能体）`}
              style={{
                position: "absolute",
                left: geom.chestPos.x * scale,
                top: geom.chestPos.y * scale,
                zIndex: 400,
                alignItems: "center",
              }}
            >
              <View
                pointerEvents="none"
                style={{
                  paddingHorizontal: 4,
                  paddingVertical: 0.5,
                  borderRadius: 2,
                  borderWidth: 1,
                  borderColor: "#1f242b",
                  backgroundColor: palette.pillBg,
                  marginBottom: 1,
                }}
              >
                <Text style={{ color: theme.colors.foreground, fontSize: 8, fontWeight: "700" }}>
                  {room.archived.length}
                </Text>
              </View>
              <PixelSprite
                bitmap={ARCHIVE_CHEST}
                colors={palette.colors}
                paletteKey={palette.key}
                scale={scale}
              />
            </Pressable>
          ) : null}

          {roomEnvelopes.map((env) => {
            const from = coordsByAgent.get(env.fromId)!;
            const to = coordsByAgent.get(env.toId)!;
            return <FlyingEnvelope key={env.id} from={from} to={to} palette={palette} scale={scale} />;
          })}
        </View>
      </ScrollView>

      {/* Integrated Workshop Big Screen + Diegetic Console Controls */}
      {activeAgent ? (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
            backgroundColor: theme.colors.surface1,
            padding: 8,
            gap: 7,
          }}
        >
          {/* Multi-agent quick switcher tabs inside the room when > 1 agent */}
          {stations.length > 1 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
              {stations.map((s) => {
                const isCur = s.id === activeAgent.id;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => setFocusedId(s.id)}
                    style={{
                      paddingHorizontal: 7,
                      paddingVertical: 2,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: isCur ? theme.colors.accent : theme.colors.border,
                      backgroundColor: isCur ? theme.colors.surface2 : theme.colors.surface0,
                      maxWidth: 130,
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        color: isCur ? theme.colors.foreground : theme.colors.foregroundMuted,
                        fontSize: 10,
                        fontWeight: isCur ? "700" : "400",
                      }}
                    >
                      {s.title}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {/* Clickable Big Screen Monitor: displays active agent's full title, latest message & delegations.
              Clicking this Big Screen opens/toggles the Detail Dock! */}
          <Pressable
            onPress={() => onOpenDetail(activeAgent.id)}
            accessibilityRole="button"
            accessibilityLabel={`点击大屏查看 ${activeAgent.title} 详细信息`}
            style={{
              padding: 9,
              borderRadius: 7,
              borderWidth: isDetailOpenForFocused ? 2 : 1,
              borderColor: isDetailOpenForFocused ? theme.colors.accent : "#334155",
              backgroundColor: palette.isDark ? "#0f172a" : "#1e293b",
              gap: 5,
            }}
          >
            {/* Big Screen Top Bar: Full Agent Title + Status + Detail Hint */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flex: 1, minWidth: 0 }}>
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    backgroundColor:
                      activeAgent.state === "runaway" || activeAgent.state === "failed"
                        ? "#f87171"
                        : activeAgent.state === "needs-input"
                          ? "#fbbf24"
                          : activeAgent.state === "working"
                            ? "#4ade80"
                            : "#94a3b8",
                  }}
                />
                <Text
                  numberOfLines={1}
                  style={{ color: "#f8fafc", fontSize: 11, fontWeight: "700", flex: 1 }}
                >
                  {activeAgent.title}
                </Text>
              </View>
              <Text style={{ color: "#94a3b8", fontSize: 10 }}>
                {STATE_LABEL[activeAgent.state]} · {isDetailOpenForFocused ? "收起详情" : "点击看详情 ▸"}
              </Text>
            </View>

            {/* Latest Real Conversation Message on the Big Screen */}
            <Text
              numberOfLines={2}
              style={{
                color: preview ? "#e2e8f0" : "#94a3b8",
                fontSize: 11,
                lineHeight: 16,
              }}
            >
              {preview
                ? `${preview.role === "user" ? "你：" : preview.role === "assistant" ? "回复：" : ""}${preview.text}`
                : activeAgent.state === "runaway"
                  ? `该智能体已关闭，但仍有 ${activeAgent.processCount} 个进程占用 ${formatMemory(activeAgent.rssKb)} 内存。`
                  : "暂无近期对话消息，点击大屏可查看完整记录与进程。"}
            </Text>

            {/* Agent-to-Agent Delegation Indicator on the Big Screen */}
            {room.delegations.length > 0 ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 2 }}>
                {room.delegations.slice(0, 3).map((d) => (
                  <View
                    key={`${d.fromId}->${d.toId}`}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: 4,
                      backgroundColor: "rgba(59, 130, 246, 0.22)",
                      borderWidth: 1,
                      borderColor: "rgba(96, 165, 250, 0.45)",
                    }}
                  >
                    <Icon name="GitBranch" size={10} color="#93c5fd" />
                    <Text numberOfLines={1} style={{ color: "#dbeafe", fontSize: 10 }}>
                      {d.fromTitle.slice(0, 10)} ⟶ {d.toTitle.slice(0, 12)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </Pressable>

          {/* In-scene Integrated Controls directly beneath the Big Screen */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
            {activeAgent.agent && onOpenAgent ? (
              <Pressable
                onPress={() => onOpenAgent(activeAgent.id, activeAgent.workspaceId)}
                accessibilityRole="button"
                accessibilityLabel={`打开 ${activeAgent.title} 会话`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  paddingHorizontal: 9,
                  paddingVertical: 4,
                  borderRadius: 5,
                  backgroundColor: theme.colors.accent,
                }}
              >
                <Icon name="ExternalLink" size={11} color={theme.colors.accentForeground} />
                <Text style={{ color: theme.colors.accentForeground, fontSize: 11, fontWeight: "600" }}>
                  打开
                </Text>
              </Pressable>
            ) : null}

            {activeAgent.agent && activeAgent.state !== "closed" && activeAgent.state !== "runaway" ? (
              <Pressable
                onPress={() => setComposerOpen((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={`给 ${activeAgent.title} 发消息`}
                style={consoleBtn}
              >
                <Icon name="Send" size={11} color={theme.colors.foregroundMuted} />
                <Text style={{ color: theme.colors.foreground, fontSize: 11 }}>发消息</Text>
              </Pressable>
            ) : null}

            {activeAgent.agent && !activeAgent.agent.archivedAt ? (
              <Pressable
                disabled={inlineBusy !== null}
                onPress={() => {
                  const id = activeAgent.id;
                  void runInline("archive", async () => {
                    await onArchiveAgent(id);
                    return "已归档";
                  });
                }}
                accessibilityRole="button"
                accessibilityLabel={`归档 ${activeAgent.title}`}
                style={consoleBtn}
              >
                <Icon name="Archive" size={11} color={theme.colors.foregroundMuted} />
                <Text style={{ color: theme.colors.foreground, fontSize: 11 }}>
                  {inlineBusy === "archive" ? "归档中…" : "归档"}
                </Text>
              </Pressable>
            ) : null}

            {activeAgent.processCount > 0 ? (
              <Pressable
                disabled={inlineBusy !== null}
                onPress={() => {
                  const id = activeAgent.id;
                  void runInline("stop", async () => {
                    const res = await onStopAllProcesses(id);
                    if (res.failed > 0) return `停止失败：${res.error ?? "权限不足"}`;
                    if (res.stillRunning > 0) return `已发信号（${res.stillRunning} 个退出中）`;
                    if (res.stopped > 0) return `已停止 ${res.stopped} 个进程`;
                    return "进程已退出";
                  });
                }}
                accessibilityRole="button"
                accessibilityLabel={`停止 ${activeAgent.title} 全部进程`}
                style={
                  activeAgent.state === "runaway"
                    ? {
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 5,
                        backgroundColor: theme.colors.statusDanger,
                      }
                    : consoleBtn
                }
              >
                <Icon
                  name="Square"
                  size={10}
                  color={activeAgent.state === "runaway" ? "#ffffff" : theme.colors.statusDanger}
                />
                <Text
                  style={{
                    color: activeAgent.state === "runaway" ? "#ffffff" : theme.colors.foreground,
                    fontSize: 11,
                    fontWeight: activeAgent.state === "runaway" ? "700" : "500",
                  }}
                >
                  {inlineBusy === "stop" ? "停止中…" : `停进程 (${activeAgent.processCount})`}
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => onOpenDetail(activeAgent.id)}
              accessibilityRole="button"
              accessibilityLabel={`打开 ${activeAgent.title} 详情栏`}
              style={[consoleBtn, { marginLeft: "auto" }]}
            >
              <Icon name="PanelRightOpen" size={11} color={theme.colors.foregroundMuted} />
              <Text style={{ color: theme.colors.foreground, fontSize: 11 }}>
                {isDetailOpenForFocused ? "收起" : "详情"}
              </Text>
            </Pressable>
          </View>

          {/* Inline quick message box right inside the room */}
          {composerOpen && activeAgent.agent ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={`给「${activeAgent.title}」发消息…`}
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
                disabled={!draft.trim() || inlineBusy !== null}
                onPress={() => {
                  const id = activeAgent.id;
                  const text = draft.trim();
                  if (!text) return;
                  void runInline("send", async () => {
                    await onSendMessage(id, text);
                    setDraft("");
                    setComposerOpen(false);
                    return "消息已发送";
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
                  {inlineBusy === "send" ? "发送中…" : "发送"}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {inlineNotice ? (
            <Text style={{ color: theme.colors.accent, fontSize: 11 }}>{inlineNotice}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
});

export const WorkshopCanvas = memo(function WorkshopCanvas({
  theme,
  rooms,
  selectedId,
  onOpenDetail,
  onSelectArchive,
  onOpenAgent,
  onSendMessage,
  onArchiveAgent,
  onStopAllProcesses,
  toolByAgent,
  latestByAgent,
  envelopes,
  compact,
  zoom,
}: WorkshopCanvasProps) {
  const palette = useMemo(() => workshopPalette(theme), [theme]);
  const [frame, setFrame] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setFrame((f) => (f + 1) % 4), 280);
    return () => clearInterval(timer);
  }, []);

  const handleLayout = (event: LayoutChangeEvent) => {
    const w = Math.floor(event.nativeEvent.layout.width);
    if (w > 0 && Math.abs(w - containerWidth) > 4) setContainerWidth(w);
  };

  if (rooms.length === 0) {
    return (
      <View
        onLayout={handleLayout}
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: 28,
          gap: 10,
          backgroundColor: palette.canvasBg,
        }}
      >
        <PixelSprite
          bitmap={WORKBENCH_SPRITE}
          colors={palette.colors}
          paletteKey={palette.key}
          scale={2.5}
        />
        <Text style={{ color: theme.colors.foreground, fontSize: 13, fontWeight: "600" }}>
          暂无活跃智能体或进程
        </Text>
        <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12, textAlign: "center" }}>
          启动任意智能体后，像素工坊、信息大屏与子进程机械会出现在这里。
        </Text>
      </View>
    );
  }

  const pad = compact ? 8 : 14;
  const availableW = containerWidth > 0 ? Math.max(240, containerWidth - pad * 2) : compact ? 290 : 720;
  const maxCols = availableW < 420 ? 2 : availableW < 640 ? 3 : 4;

  return (
    <ScrollView
      onLayout={handleLayout}
      style={{ flex: 1, backgroundColor: palette.canvasBg }}
      contentContainerStyle={{
        padding: pad,
        gap: compact ? 12 : 16,
      }}
    >
      {rooms.map((room) => {
        const stationCount = Math.max(1, room.runaways.length + room.benches.length);
        const geom = computeRoomGeometry(stationCount, maxCols);
        const fitScale = Math.min(2.4, Math.max(1.2, availableW / geom.width));
        const effectiveScale = Number((fitScale * zoom).toFixed(2));

        return (
          <WorkshopRoomView
            key={room.workspaceId || "unassigned"}
            room={room}
            theme={theme}
            palette={palette}
            scale={effectiveScale}
            frame={frame}
            maxCols={maxCols}
            availableW={availableW}
            selectedId={selectedId}
            toolByAgent={toolByAgent}
            latestByAgent={latestByAgent}
            envelopes={envelopes}
            onOpenDetail={onOpenDetail}
            onSelectArchive={onSelectArchive}
            onOpenAgent={onOpenAgent}
            onSendMessage={onSendMessage}
            onArchiveAgent={onArchiveAgent}
            onStopAllProcesses={onStopAllProcesses}
          />
        );
      })}
    </ScrollView>
  );
});
