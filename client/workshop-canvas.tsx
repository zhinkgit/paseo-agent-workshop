// High-craft 2.5D Retro RPG Workshop canvas: continuous tilemap backdrop, flickering hearth,
// smooth-walking artisans (bench <-> lounge rug), spinning mini-machines, runaway orphan alerts,
// pixel speech bubbles, flying wax-sealed envelopes, and corner archive chest.
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
  ENVELOPE_SPRITE,
  HEARTH_FIRE_FRAMES,
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

/** Smoothly moves an artisan sprite between its bench and the lounge rug when state changes. */
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
  bubbleTone: "normal" | "warn" | "danger";
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
    const duration = Math.min(1400, Math.max(380, Math.round(dist * 7)));
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
      ? "#dc2626"
      : bubbleTone === "warn"
        ? "#d97706"
        : palette.isDark
          ? "#fbf3df"
          : "#fffcf2";
  const bubbleFg = bubbleTone === "normal" ? "#241914" : "#ffffff";

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        zIndex: Math.round(targetY) + (selected ? 500 : 100),
        transform: [{ translateX: pos.x }, { translateY: pos.y }],
      }}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}, ${STATE_LABEL[item.state]}`}
        style={{ alignItems: "center" }}
      >
        {/* Crisp pixel-framed speech / tool bubble */}
        {bubbleText ? (
          <View
            style={{
              position: "absolute",
              bottom: h + 3,
              alignItems: "center",
              zIndex: 999,
            }}
          >
            <View
              style={{
                paddingHorizontal: 5,
                paddingVertical: 1.5,
                borderRadius: 3,
                borderWidth: 1,
                borderColor: "#17110e",
                backgroundColor: bubbleBg,
                maxWidth: Math.max(76, w * 2.6),
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  color: bubbleFg,
                  fontSize: 9,
                  fontWeight: "700",
                  letterSpacing: 0.2,
                }}
              >
                {bubbleText}
              </Text>
            </View>
            {/* Tiny pixel bubble tail */}
            <View
              style={{
                width: 4,
                height: 3,
                backgroundColor: bubbleBg,
                borderLeftWidth: 1,
                borderRightWidth: 1,
                borderBottomWidth: 1,
                borderColor: "#17110e",
                marginTop: -1,
              }}
            />
          </View>
        ) : null}

        {/* Subtle golden RPG selection ring beneath feet */}
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
              backgroundColor: "rgba(245, 196, 81, 0.22)",
            }}
          />
        ) : null}

        <PixelSprite
          bitmap={sprite}
          colors={charPalette.colors}
          paletteKey={charPalette.key}
          scale={scale}
        />

        {/* Compact floating nameplate beneath feet */}
        <View
          style={{
            marginTop: 1,
            paddingHorizontal: 4,
            paddingVertical: 0.5,
            borderRadius: 3,
            backgroundColor: selected
              ? palette.selectedRing
              : palette.isDark
                ? "rgba(22, 18, 15, 0.78)"
                : "rgba(255, 252, 242, 0.86)",
            maxWidth: Math.max(66, scale * 28),
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              color: selected ? "#17110e" : palette.roomHeaderText,
              fontSize: 9,
              fontWeight: "700",
            }}
          >
            {item.title}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
});

/** Smoothly glides a wax-sealed pixel envelope from sender to recipient across the room. */
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

  // Compute exact pixel coordinates for every bench & character so envelopes can glide between them.
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
        // Stand right behind the workbench
        map.set(item.id, { x: (origin.x + 5) * scale, y: (origin.y - 2) * scale });
      }
    });
    return map;
  }, [stations, geom, scale]);

  const roomEnvelopes = envelopes.filter(
    (e) => coordsByAgent.has(e.fromId) && coordsByAgent.has(e.toId),
  );

  const roomPxW = geom.width * scale;
  const roomPxH = geom.height * scale;

  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderRadius: 8,
        borderWidth: 1,
        borderColor: room.runaways.length > 0 ? "#ef4444" : palette.roomFrame,
        backgroundColor: palette.roomHeaderBg,
        overflow: "hidden",
      }}
    >
      {/* Quiet wooden room title bar */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          paddingHorizontal: 10,
          paddingVertical: 5,
          backgroundColor: palette.roomHeaderBg,
          borderBottomWidth: 1,
          borderBottomColor: palette.roomFrame,
          width: roomPxW,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{
              color: palette.roomHeaderText,
              fontSize: 11,
              fontWeight: "700",
              flexShrink: 1,
            }}
          >
            {room.name}
          </Text>
          {room.runaways.length > 0 ? (
            <View
              style={{
                paddingHorizontal: 5,
                paddingVertical: 1,
                borderRadius: 3,
                backgroundColor: "#dc2626",
              }}
            >
              <Text style={{ color: "#ffffff", fontSize: 9, fontWeight: "700" }}>
                {room.runaways.length} 失控
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={{ color: palette.roomHeaderMuted, fontSize: 10 }}>
          {room.totalProcesses > 0
            ? `${room.totalProcesses}p · ${formatCpu(room.totalCpu)} · ${formatMemory(room.totalRssKb)}`
            : `${room.benches.length} 工匠`}
        </Text>
      </View>

      {/* Continuous 2.5D pixel-art room scene */}
      <View style={{ width: roomPxW, height: roomPxH, position: "relative" }}>
        <PixelSprite
          bitmap={backdrop}
          colors={palette.colors}
          paletteKey={palette.key}
          scale={scale}
          style={{ position: "absolute", left: 0, top: 0 }}
        />

        {/* Animated flickering fireplace hearth */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: geom.hearthPos.x * scale,
            top: geom.hearthPos.y * scale,
            zIndex: 5,
          }}
        >
          <PixelSprite
            bitmap={HEARTH_FIRE_FRAMES[frame % HEARTH_FIRE_FRAMES.length]!}
            colors={palette.colors}
            paletteKey={palette.key}
            scale={scale}
          />
        </View>

        {/* Workbenches + Mini-Machine contraptions + Artisans */}
        {stations.map((item, idx) => {
          const origin = geom.stationOrigin(idx);
          const benchLeft = origin.x * scale;
          const benchTop = (origin.y + 12) * scale;
          const machineLeft = (origin.x + 25) * scale;
          const machineTop = (origin.y + 12) * scale;
          const isRunaway = item.state === "runaway";
          const selected = selectedId === item.id;
          const machineSprite =
            item.machineLoad !== "none" ? machineFrames(item.machineLoad)[frame % 2]! : null;
          const charTarget = coordsByAgent.get(item.id) ?? {
            x: (origin.x + 5) * scale,
            y: (origin.y - 2) * scale,
          };

          const toolWord = toolByAgent.get(item.id);
          const bubbleText = isRunaway
            ? `失控 · ${item.processCount}p`
            : item.state === "needs-input"
              ? "需审批!"
              : item.state === "failed"
                ? "出错!"
                : toolWord
                  ? toolWord
                  : item.machineLoad === "hot"
                    ? `${formatCpu(item.cpu)} 过热`
                    : null;
          const bubbleTone: "normal" | "warn" | "danger" =
            isRunaway || item.state === "failed"
              ? "danger"
              : item.state === "needs-input" || item.machineLoad === "hot"
                ? "warn"
                : "normal";

          return (
            <View key={item.id} style={{ position: "absolute", left: 0, top: 0 }}>
              {/* Wooden Workbench */}
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
                  bitmap={WORKBENCH_SPRITE}
                  colors={palette.colors}
                  paletteKey={palette.key}
                  scale={scale}
                />
              </Pressable>

              {/* Spinning Mini-Machine contraption beside the workbench */}
              {machineSprite ? (
                <Pressable
                  onPress={() => onSelect(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title} processes: ${item.processCount}`}
                  style={{
                    position: "absolute",
                    left: machineLeft,
                    top: machineTop,
                    zIndex: Math.round(machineTop) + 25,
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
                        borderRadius: 3,
                        borderWidth: 1,
                        borderColor: "#17110e",
                        backgroundColor: "#dc2626",
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
                        bottom: -2,
                        width: machineSprite.width * scale + 6,
                        height: Math.max(8, scale * 3.5),
                        borderRadius: 999,
                        borderWidth: 2,
                        borderColor: palette.selectedRing,
                        backgroundColor: "rgba(239, 68, 68, 0.25)",
                      }}
                    />
                  ) : null}

                  <PixelSprite
                    bitmap={machineSprite}
                    colors={palette.colors}
                    paletteKey={palette.key}
                    scale={scale}
                  />
                  <Text
                    style={{
                      color: isRunaway || item.machineLoad === "hot" ? "#f87171" : palette.roomHeaderMuted,
                      fontSize: 8,
                      fontWeight: "700",
                      marginTop: -1,
                    }}
                  >
                    {item.processCount}p·{formatMemory(item.rssKb)}
                  </Text>
                </Pressable>
              ) : null}

              {/* Live Artisan character (walks between bench and lounge rug) */}
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

        {/* Corner Archive Treasure Chest */}
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
                borderRadius: 3,
                borderWidth: 1,
                borderColor: "#17110e",
                backgroundColor: palette.roomHeaderBg,
                marginBottom: 1,
              }}
            >
              <Text style={{ color: palette.roomHeaderText, fontSize: 8, fontWeight: "700" }}>
                ×{room.archived.length}
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

        {/* Flying Wax-Sealed Envelopes between agents */}
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

  // Smooth 260ms animation tick for 4-frame hammering, walking, fire flickering, and gears.
  useEffect(() => {
    const timer = setInterval(() => setFrame((f) => (f + 1) % 4), 260);
    return () => clearInterval(timer);
  }, []);

  if (rooms.length === 0) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          gap: 10,
          backgroundColor: palette.canvasBg,
        }}
      >
        <PixelSprite
          bitmap={WORKBENCH_SPRITE}
          colors={palette.colors}
          paletteKey={palette.key}
          scale={3}
        />
        <Text style={{ color: theme.colors.foreground, fontSize: 13, fontWeight: "600" }}>
          工坊目前空无一人
        </Text>
        <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12, textAlign: "center" }}>
          启动任意 Agent 后，像素工匠与运转中的子进程机械将出现在工坊里。
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
        gap: compact ? 10 : 14,
      }}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ gap: compact ? 10 : 14 }}>
          {rooms.map((room) => (
            <WorkshopRoomView
              key={room.workspaceId || "unassigned"}
              room={room}
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
    </ScrollView>
  );
});
