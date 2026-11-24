// Crisp, airy studio-workshop pixel-art canvas (Lobby-inspired layout & polish).
// Pure white/host canvas, floating room title pills straddling the top wall, side-by-side rooms,
// tight oak workbenches with animated screens, process gear pods, smooth-walking artisans,
// crisp pixel bubbles, and flying wax-sealed envelopes.
import type { PluginTheme } from "@getpaseo/plugin";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, Text, View } from "react-native";
import { formatCpu, formatMemory } from "../shared/format";
import { PixelSprite } from "./pixel-sprite";
import type { ActiveEnvelope } from "./use-feed";
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
  selectedId: string | null;
  onSelect: (agentId: string) => void;
  onSelectArchive: (room: WorkshopRoom) => void;
  toolByAgent: ReadonlyMap<string, string>;
  envelopes: readonly ActiveEnvelope[];
  compact: boolean;
  scale: number;
}

const WalkingArtisan = memo(function WalkingArtisan({
  item,
  palette,
  targetX,
  targetY,
  scale,
  frame,
  selected,
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
  selected: boolean;
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
        zIndex: Math.round(targetY) + (selected ? 600 : 120),
        transform: [{ translateX: pos.x }, { translateY: pos.y }],
      }}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}, ${STATE_LABEL[item.state]}`}
        style={{ alignItems: "center" }}
      >
        {/* Crisp Lobby-style dark pixel speech/tool bubble */}
        {bubbleText ? (
          <View
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
                maxWidth: Math.max(72, w * 2.5),
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  color: "#ffffff",
                  fontSize: 9,
                  fontWeight: "700",
                  letterSpacing: 0.2,
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

        {/* Subtle crisp selection halo beneath feet */}
        {selected ? (
          <View
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

const WorkshopRoomView = memo(function WorkshopRoomView({
  room,
  theme,
  palette,
  scale,
  frame,
  maxCols,
  selectedId,
  toolByAgent,
  envelopes,
  onSelect,
  onSelectArchive,
}: {
  room: WorkshopRoom;
  theme: PluginTheme;
  palette: WorkshopPalette;
  scale: number;
  frame: number;
  maxCols: number;
  selectedId: string | null;
  toolByAgent: ReadonlyMap<string, string>;
  envelopes: readonly ActiveEnvelope[];
  onSelect: (id: string) => void;
  onSelectArchive: (room: WorkshopRoom) => void;
}) {
  const stations = useMemo(() => [...room.runaways, ...room.benches], [room.runaways, room.benches]);
  const geom: RoomGeometry = useMemo(
    () => computeRoomGeometry(stations.length, maxCols),
    [stations.length, maxCols],
  );
  const backdrop = useMemo(() => buildWorkshopBackdrop(geom), [geom]);

  const coordsByAgent = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    let loungeIdx = 0;
    stations.forEach((item, idx) => {
      const origin = geom.stationOrigin(idx);
      const isResting = item.state === "idle" || item.state === "ready";
      if (isResting) {
        const spot = geom.loungeSpot(loungeIdx++);
        map.set(item.id, { x: spot.x * scale, y: spot.y * scale });
      } else {
        // Seated / standing right in front of the workbench monitor
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

  return (
    <View style={{ paddingTop: 11, position: "relative" }}>
      {/* Floating Lobby-style white pill room title straddling the top wall */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: Math.round(14 * scale),
          zIndex: 1500,
          flexDirection: "row",
          alignItems: "center",
          gap: 5,
          paddingHorizontal: 8,
          paddingVertical: 2.5,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: room.runaways.length > 0 ? theme.colors.statusDanger : palette.pillBorder,
          backgroundColor: palette.pillBg,
          maxWidth: Math.max(140, roomPxW - 24),
        }}
      >
        <View
          style={{
            width: 7,
            height: 7,
            borderRadius: 999,
            backgroundColor: dotColor,
          }}
        />
        <Text
          numberOfLines={1}
          style={{
            color: theme.colors.foreground,
            fontSize: 11,
            fontWeight: "600",
            flexShrink: 1,
          }}
        >
          {room.name}
        </Text>
        <Text style={{ color: theme.colors.foregroundMuted, fontSize: 10 }}>
          {stations.length}
        </Text>
        {room.totalProcesses > 0 ? (
          <Text
            style={{
              color: room.runaways.length > 0 ? theme.colors.statusDanger : theme.colors.foregroundMuted,
              fontSize: 10,
              fontWeight: room.runaways.length > 0 ? "700" : "400",
            }}
          >
            · {room.totalProcesses}p · {formatMemory(room.totalRssKb)}
          </Text>
        ) : null}
      </View>

      {/* Crisp 2.5D studio room */}
      <View style={{ width: roomPxW, height: roomPxH, position: "relative" }}>
        <PixelSprite
          bitmap={backdrop}
          colors={palette.colors}
          paletteKey={palette.key}
          scale={scale}
          style={{ position: "absolute", left: 0, top: 0 }}
        />

        {stations.map((item, idx) => {
          const origin = geom.stationOrigin(idx);
          const benchLeft = origin.x * scale;
          const benchTop = origin.y * scale;
          const podLeft = (origin.x + 28) * scale;
          const podTop = (origin.y + 4) * scale;
          const isRunaway = item.state === "runaway";
          const selected = selectedId === item.id;
          const machineSprite =
            item.machineLoad !== "none" ? machineFrames(item.machineLoad)[frame % 2]! : null;
          const charTarget = coordsByAgent.get(item.id) ?? {
            x: (origin.x + 7) * scale,
            y: (origin.y + 11) * scale,
          };

          const toolWord = toolByAgent.get(item.id);
          const bubbleText = isRunaway
            ? `Runaway ${item.processCount}p`
            : item.state === "needs-input"
              ? "Approve?"
              : item.state === "failed"
                ? "Error"
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
              {/* Oak Studio Workbench with live/off/error monitor */}
              <Pressable
                onPress={() => onSelect(item.id)}
                accessibilityRole="button"
                accessibilityLabel={`${item.title} workbench`}
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

              {/* Compact Process Gear Pod beside the workbench */}
              {machineSprite ? (
                <Pressable
                  onPress={() => onSelect(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title} processes: ${item.processCount}`}
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

                  {selected && isRunaway ? (
                    <View
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

              {/* Smooth-walking Artisan */}
              {!isRunaway ? (
                <WalkingArtisan
                  item={item}
                  palette={palette}
                  targetX={charTarget.x}
                  targetY={charTarget.y}
                  scale={scale}
                  frame={frame}
                  selected={selected}
                  bubbleText={bubbleText}
                  bubbleTone={bubbleTone}
                  onPress={() => onSelect(item.id)}
                />
              ) : null}
            </View>
          );
        })}

        {/* Corner Filing Cabinet with crisp count badge */}
        {room.archived.length > 0 ? (
          <Pressable
            onPress={() => onSelectArchive(room)}
            accessibilityRole="button"
            accessibilityLabel={`${room.archived.length} closed agents`}
            style={{
              position: "absolute",
              left: geom.chestPos.x * scale,
              top: geom.chestPos.y * scale,
              zIndex: 400,
              alignItems: "center",
            }}
          >
            <View
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

        {/* Flying Wax-Sealed Envelopes */}
        {roomEnvelopes.map((env) => {
          const from = coordsByAgent.get(env.fromId)!;
          const to = coordsByAgent.get(env.toId)!;
          return <FlyingEnvelope key={env.id} from={from} to={to} palette={palette} scale={scale} />;
        })}
      </View>
    </View>
  );
});

export const WorkshopCanvas = memo(function WorkshopCanvas({
  theme,
  rooms,
  selectedId,
  onSelect,
  onSelectArchive,
  toolByAgent,
  envelopes,
  compact,
  scale,
}: WorkshopCanvasProps) {
  const palette = useMemo(() => workshopPalette(theme), [theme]);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setFrame((f) => (f + 1) % 4), 280);
    return () => clearInterval(timer);
  }, []);

  if (rooms.length === 0) {
    return (
      <View
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
          暂无活跃 Agent 或进程
        </Text>
        <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12, textAlign: "center" }}>
          启动任意 Agent 后，工作台与子进程机械会出现在这里。
        </Text>
      </View>
    );
  }

  const maxCols = compact ? 2 : 4;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.canvasBg }}
      contentContainerStyle={{
        padding: compact ? 8 : 14,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "flex-start",
          gap: compact ? 10 : 12,
        }}
      >
        {rooms.map((room) => (
          <WorkshopRoomView
            key={room.workspaceId || "unassigned"}
            room={room}
            theme={theme}
            palette={palette}
            scale={scale}
            frame={frame}
            maxCols={maxCols}
            selectedId={selectedId}
            toolByAgent={toolByAgent}
            envelopes={envelopes}
            onSelect={onSelect}
            onSelectArchive={onSelectArchive}
          />
        ))}
      </View>
    </ScrollView>
  );
});
