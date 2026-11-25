// Truly Diegetic Pixel Studio-Workshop Canvas:
// ZERO external headers or button bars — every control and display lives INSIDE the room as a pixel object:
// - Wooden Door (top-left wall) = Open agent session
// - Wall Signboard (top-center wall) = Project & Workspace name
// - Wall Gauge (top-right wall) = Process count / CPU / RAM
// - Pixel Mailbox (left aisle) = Send message (opens in-room parchment popover)
// - Power Breaker Switch (left aisle) = Stop all processes
// - Floor-standing Pixel Big Screen (lower-left) = Latest real message + delegation badge (click -> Detail Dock!)
// - Archive Cabinet (bottom-right) = Archive active agent / view closed archive
// - Artisans & Workbenches = Click to focus which agent the room's Big Screen & props control
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
  breakerSprite,
  DOOR_SPRITE,
  ENVELOPE_SPRITE,
  machineFrames,
  MAILBOX_SPRITE,
  WORKBENCH_SPRITE,
  workshopPalette,
  type WorkshopPalette,
} from "./workshop-art";
import { buildWorkshopBackdrop, computeRoomGeometry, type RoomGeometry } from "./workshop-backdrop";
import { STATE_LABEL, type WorkshopAgent, type WorkshopRoom } from "./workshop-model";

export interface WorkshopCanvasProps {
  theme: PluginTheme;
  rooms: readonly WorkshopRoom[];
  selectedId: string | null;
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

/** Crisp micro-tag printed directly on an in-room interactive pixel prop. */
function PropTag({ text, danger = false }: { text: string; danger?: boolean }) {
  return (
    <View
      pointerEvents="none"
      style={{
        marginTop: 1,
        paddingHorizontal: 3,
        paddingVertical: 0.5,
        borderRadius: 2,
        backgroundColor: danger ? "#b91c1c" : "rgba(20, 22, 26, 0.78)",
      }}
    >
      <Text style={{ color: "#ffffff", fontSize: 8, fontWeight: "700" }}>{text}</Text>
    </View>
  );
}

const WorkshopRoomView = memo(function WorkshopRoomView({
  room,
  theme,
  palette,
  scale,
  frame,
  maxCols,
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

  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [popover, setPopover] = useState<"mail" | "archive" | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

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

  useEffect(() => {
    setPopover(null);
    setDraft("");
    setToastMsg(null);
  }, [activeAgent?.id]);

  // Auto-fade transient in-room status toast after 3.5s
  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 3_500);
    return () => clearTimeout(t);
  }, [toastMsg]);

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

  const runPropAction = async (fn: () => Promise<string>) => {
    setBusy(true);
    try {
      setToastMsg(await fn());
    } catch (err) {
      setToastMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ width: roomPxW, height: roomPxH, position: "relative" }}>
      {/* Continuous 2.5D Pixel Studio Room Backdrop */}
      <PixelSprite
        bitmap={backdrop}
        colors={palette.colors}
        paletteKey={palette.key}
        scale={scale}
        style={{ position: "absolute", left: 0, top: 0 }}
      />

      {/* 1. Interactive Wooden Door on top-left wall = 打开会话 */}
      <Pressable
        disabled={!activeAgent?.agent || !onOpenAgent}
        onPress={() => {
          if (activeAgent?.agent && onOpenAgent) {
            onOpenAgent(activeAgent.id, activeAgent.workspaceId);
          }
        }}
        accessibilityRole="button"
        accessibilityLabel={activeAgent ? `点击木门打开 ${activeAgent.title} 会话` : "工坊木门"}
        style={{
          position: "absolute",
          left: geom.doorPos.x * scale,
          top: geom.doorPos.y * scale,
          zIndex: 320,
          alignItems: "center",
        }}
      >
        <PixelSprite
          bitmap={DOOR_SPRITE}
          colors={palette.colors}
          paletteKey={palette.key}
          scale={scale}
        />
        {activeAgent?.agent ? <PropTag text="打开" /> : null}
      </Pressable>

      {/* 2. Wall-mounted Signboard Plaque on top-center wall = 项目名 & 工作区名 (separated & unclipped) */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: geom.signRect.x * scale,
          top: geom.signRect.y * scale,
          width: geom.signRect.w * scale,
          height: geom.signRect.h * scale,
          zIndex: 310,
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 3,
          borderWidth: 1.5,
          borderColor: "#1f242b",
          backgroundColor: palette.isDark ? "#232832" : "#ffffff",
          justifyContent: "center",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: dotColor }} />
          <Text
            numberOfLines={1}
            style={{ color: theme.colors.foreground, fontSize: 10, fontWeight: "700", flex: 1 }}
          >
            {room.projectName}
          </Text>
        </View>
        {room.workspaceTitle && room.workspaceTitle !== room.projectName ? (
          <Text
            numberOfLines={1}
            style={{ color: theme.colors.foregroundMuted, fontSize: 8.5, marginTop: 1 }}
          >
            {room.workspaceTitle}
          </Text>
        ) : null}
      </View>

      {/* 3. Wall-mounted Resource Gauge on top-right wall = 进程 / CPU / 内存 */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: geom.gaugeRect.x * scale,
          top: geom.gaugeRect.y * scale,
          width: geom.gaugeRect.w * scale,
          height: geom.gaugeRect.h * scale,
          zIndex: 310,
          paddingHorizontal: 5,
          borderRadius: 3,
          borderWidth: 1.5,
          borderColor: room.runaways.length > 0 ? "#dc2626" : "#1f242b",
          backgroundColor: "#18202c",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            color: room.runaways.length > 0 ? "#fca5a5" : "#86efac",
            fontSize: 8.5,
            fontWeight: "700",
          }}
        >
          {room.totalProcesses > 0
            ? `${room.totalProcesses}p · ${formatCpu(room.totalCpu)}`
            : `${stations.length} 工匠`}
        </Text>
        {room.totalProcesses > 0 ? (
          <Text numberOfLines={1} style={{ color: "#cbd5e1", fontSize: 8 }}>
            {formatMemory(room.totalRssKb)}
          </Text>
        ) : null}
      </View>

      {/* 4. Interactive Pixel Mailbox in left aisle = 发消息 */}
      {activeAgent?.agent && activeAgent.state !== "closed" && activeAgent.state !== "runaway" ? (
        <Pressable
          onPress={() => setPopover((p) => (p === "mail" ? null : "mail"))}
          accessibilityRole="button"
          accessibilityLabel={`点击邮筒给 ${activeAgent.title} 发消息`}
          style={{
            position: "absolute",
            left: geom.mailboxPos.x * scale,
            top: geom.mailboxPos.y * scale,
            zIndex: 360,
            alignItems: "center",
          }}
        >
          <PixelSprite
            bitmap={MAILBOX_SPRITE}
            colors={palette.colors}
            paletteKey={palette.key}
            scale={scale}
          />
          <PropTag text="发信" />
        </Pressable>
      ) : null}

      {/* 5. Interactive Power Breaker Switch in left aisle = 停进程 */}
      {activeAgent ? (
        <Pressable
          disabled={busy || activeAgent.processCount === 0}
          onPress={() => {
            const id = activeAgent.id;
            void runPropAction(async () => {
              const res = await onStopAllProcesses(id);
              if (res.failed > 0) return `停止失败：${res.error ?? "权限不足"}`;
              if (res.stillRunning > 0) return `已拉闸，${res.stillRunning} 个进程退出中`;
              if (res.stopped > 0) return `已停止 ${res.stopped} 个进程`;
              return "进程已退出";
            });
          }}
          accessibilityRole="button"
          accessibilityLabel={`点击电闸停止 ${activeAgent.title} 的进程`}
          style={{
            position: "absolute",
            left: geom.breakerPos.x * scale,
            top: geom.breakerPos.y * scale,
            zIndex: 360,
            alignItems: "center",
            opacity: activeAgent.processCount > 0 ? 1 : 0.45,
          }}
        >
          <PixelSprite
            bitmap={breakerSprite(activeAgent.machineLoad, frame)}
            colors={palette.colors}
            paletteKey={palette.key}
            scale={scale}
          />
          <PropTag
            text={activeAgent.processCount > 0 ? `停(${activeAgent.processCount})` : "电闸"}
            danger={activeAgent.state === "runaway"}
          />
        </Pressable>
      ) : null}

      {/* 6. Dashed Agent-to-Agent Delegation Lines */}
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

      {/* 7. Workbenches + Process Gear Pods + Smooth-walking Artisans */}
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

      {/* 8. In-Room Floor-Standing Pixel Big Screen Monitor (Click -> Open Detail Dock!) */}
      {activeAgent ? (
        <Pressable
          onPress={() => onOpenDetail(activeAgent.id)}
          accessibilityRole="button"
          accessibilityLabel={`点击房内信息大屏查看 ${activeAgent.title} 详情`}
          style={{
            position: "absolute",
            left: geom.bigScreenRect.x * scale,
            top: geom.bigScreenRect.y * scale,
            width: geom.bigScreenRect.w * scale,
            height: geom.bigScreenRect.h * scale,
            zIndex: 450,
            paddingHorizontal: 6,
            paddingVertical: 4,
            borderRadius: 4,
            borderWidth: 2,
            borderColor: isDetailOpenForFocused ? theme.colors.accent : "#1f242b",
            backgroundColor: "#141d2b",
            justifyContent: "space-between",
            overflow: "hidden",
          }}
        >
          {/* Screen top LED bar: Agent Title + State */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View
              style={{
                width: 5,
                height: 5,
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
              style={{ color: "#f8fafc", fontSize: 9.5, fontWeight: "700", flex: 1 }}
            >
              {activeAgent.title}
            </Text>
            <Text style={{ color: "#60a5fa", fontSize: 8.5, fontWeight: "600" }}>
              {isDetailOpenForFocused ? "收起" : "详情▸"}
            </Text>
          </View>

          {/* Latest Real Conversation Line */}
          <Text
            numberOfLines={2}
            style={{ color: preview ? "#e2e8f0" : "#94a3b8", fontSize: 9, lineHeight: 12 }}
          >
            {preview
              ? `${preview.role === "user" ? "我：" : ""}${preview.text}`
              : activeAgent.state === "runaway"
                ? `残留 ${activeAgent.processCount} 进程 (${formatMemory(activeAgent.rssKb)})`
                : `${STATE_LABEL[activeAgent.state]} · 点击大屏查看详情`}
          </Text>

          {/* Delegation indicator inside the Big Screen */}
          {room.delegations.length > 0 ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Icon name="GitBranch" size={9} color="#93c5fd" />
              <Text numberOfLines={1} style={{ color: "#bfdbfe", fontSize: 8.5, flex: 1 }}>
                {room.delegations[0]!.fromTitle.slice(0, 8)} ⟶ {room.delegations[0]!.toTitle}
              </Text>
            </View>
          ) : null}
        </Pressable>
      ) : null}

      {/* 9. Interactive Archive Cabinet in bottom-right corner = 归档 / 查看档案 */}
      <Pressable
        onPress={() => {
          if (activeAgent?.agent && !activeAgent.agent.archivedAt) {
            setPopover((p) => (p === "archive" ? null : "archive"));
          } else if (room.archived.length > 0) {
            onSelectArchive(room);
          }
        }}
        accessibilityRole="button"
        accessibilityLabel="点击档案柜归档或查看已关闭智能体"
        style={{
          position: "absolute",
          left: geom.chestPos.x * scale,
          top: geom.chestPos.y * scale,
          zIndex: 420,
          alignItems: "center",
        }}
      >
        {room.archived.length > 0 ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: -10,
              paddingHorizontal: 3.5,
              paddingVertical: 0.5,
              borderRadius: 2,
              borderWidth: 1,
              borderColor: "#1f242b",
              backgroundColor: palette.pillBg,
            }}
          >
            <Text style={{ color: theme.colors.foreground, fontSize: 8, fontWeight: "700" }}>
              {room.archived.length}
            </Text>
          </View>
        ) : null}
        <PixelSprite
          bitmap={ARCHIVE_CHEST}
          colors={palette.colors}
          paletteKey={palette.key}
          scale={scale}
        />
        <PropTag text="归档" />
      </Pressable>

      {/* Flying Wax-Sealed Envelopes */}
      {roomEnvelopes.map((env) => {
        const from = coordsByAgent.get(env.fromId)!;
        const to = coordsByAgent.get(env.toId)!;
        return <FlyingEnvelope key={env.id} from={from} to={to} palette={palette} scale={scale} />;
      })}

      {/* In-Room Floating Parchment Popover for Mailbox (发消息) */}
      {popover === "mail" && activeAgent?.agent ? (
        <View
          style={{
            position: "absolute",
            left: Math.round(24 * scale),
            top: Math.round(34 * scale),
            width: Math.min(roomPxW - 36, 250),
            zIndex: 2500,
            padding: 8,
            borderRadius: 6,
            borderWidth: 2,
            borderColor: "#1f242b",
            backgroundColor: theme.colors.surface0,
            gap: 6,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text numberOfLines={1} style={{ color: theme.colors.foreground, fontSize: 11, fontWeight: "700", flex: 1 }}>
              发信给：{activeAgent.title}
            </Text>
            <Pressable onPress={() => setPopover(null)} accessibilityLabel="关闭发信框">
              <Icon name="X" size={13} color={theme.colors.foregroundMuted} />
            </Pressable>
          </View>
          <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="输入消息…"
              placeholderTextColor={theme.colors.foregroundMuted}
              style={{
                flex: 1,
                paddingHorizontal: 7,
                paddingVertical: 4,
                borderRadius: 5,
                borderWidth: 1,
                borderColor: theme.colors.border,
                color: theme.colors.foreground,
                backgroundColor: theme.colors.surface1,
                fontSize: 11,
              }}
            />
            <Pressable
              disabled={!draft.trim() || busy}
              onPress={() => {
                const id = activeAgent.id;
                const text = draft.trim();
                if (!text) return;
                void runPropAction(async () => {
                  await onSendMessage(id, text);
                  setDraft("");
                  setPopover(null);
                  return "消息已投入邮筒";
                });
              }}
              style={{
                paddingHorizontal: 9,
                paddingVertical: 5,
                borderRadius: 5,
                backgroundColor: theme.colors.accent,
              }}
            >
              <Text style={{ color: theme.colors.accentForeground, fontSize: 11, fontWeight: "700" }}>
                发送
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* In-Room Floating Menu for Archive Cabinet (归档当前 / 查看档案) */}
      {popover === "archive" && activeAgent?.agent ? (
        <View
          style={{
            position: "absolute",
            right: Math.round(6 * scale),
            bottom: Math.round(24 * scale),
            zIndex: 2500,
            padding: 7,
            borderRadius: 6,
            borderWidth: 2,
            borderColor: "#1f242b",
            backgroundColor: theme.colors.surface0,
            gap: 5,
            minWidth: 132,
          }}
        >
          <Pressable
            disabled={busy}
            onPress={() => {
              const id = activeAgent.id;
              void runPropAction(async () => {
                await onArchiveAgent(id);
                setPopover(null);
                return "已收入档案柜";
              });
            }}
            style={{
              paddingHorizontal: 8,
              paddingVertical: 5,
              borderRadius: 4,
              backgroundColor: theme.colors.surface2,
            }}
          >
            <Text style={{ color: theme.colors.foreground, fontSize: 11, fontWeight: "600" }}>
              归档当前智能体
            </Text>
          </Pressable>
          {room.archived.length > 0 ? (
            <Pressable
              onPress={() => {
                setPopover(null);
                onSelectArchive(room);
              }}
              style={{
                paddingHorizontal: 8,
                paddingVertical: 5,
                borderRadius: 4,
                borderWidth: 1,
                borderColor: theme.colors.border,
              }}
            >
              <Text style={{ color: theme.colors.foreground, fontSize: 11 }}>
                查看档案箱 ({room.archived.length})
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* Subtle transient in-room toast */}
      {toastMsg ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 10,
            right: 10,
            bottom: 6,
            zIndex: 2600,
            alignItems: "center",
          }}
        >
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 4,
              borderWidth: 1,
              borderColor: "#1f242b",
              backgroundColor: "rgba(20, 29, 43, 0.92)",
            }}
          >
            <Text style={{ color: "#f8fafc", fontSize: 10, fontWeight: "600" }}>{toastMsg}</Text>
          </View>
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
          启动任意智能体后，像素工坊、房内大屏与子进程机械会出现在这里。
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
        const fitScale = Math.min(2.5, Math.max(1.3, availableW / geom.width));
        const effectiveScale = Number((fitScale * zoom).toFixed(2));
        const needsHScroll = geom.width * effectiveScale > availableW + 2;

        const roomNode = (
          <WorkshopRoomView
            key={room.workspaceId || "unassigned"}
            room={room}
            theme={theme}
            palette={palette}
            scale={effectiveScale}
            frame={frame}
            maxCols={maxCols}
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

        return needsHScroll ? (
          <ScrollView
            key={room.workspaceId || "unassigned"}
            horizontal
            showsHorizontalScrollIndicator
          >
            {roomNode}
          </ScrollView>
        ) : (
          roomNode
        );
      })}
    </ScrollView>
  );
});
