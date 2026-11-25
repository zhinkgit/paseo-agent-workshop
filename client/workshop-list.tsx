// Unified List view: crisp pixel state icon + agent info + process count + CPU/RAM.
import type { PluginTheme } from "@getpaseo/plugin";
import { memo, useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { formatCpu, formatMemory } from "../shared/format";
import { PixelSprite } from "./pixel-sprite";
import { STATE_ICONS, workshopPalette } from "./workshop-art";
import { STATE_LABEL, type WorkshopAgent } from "./workshop-model";

export interface WorkshopListProps {
  theme: PluginTheme;
  items: readonly WorkshopAgent[];
  selectedId: string | null;
  onSelect: (agentId: string) => void;
  compact: boolean;
}

export const WorkshopList = memo(function WorkshopList({
  theme,
  items,
  selectedId,
  onSelect,
  compact,
}: WorkshopListProps) {
  const palette = useMemo(() => workshopPalette(theme), [theme]);

  if (items.length === 0) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12 }}>
          没有匹配的智能体或进程
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.surface0 }}
      contentContainerStyle={{ padding: compact ? 8 : 12, gap: 6 }}
    >
      {items.map((item) => {
        const selected = selectedId === item.id;
        const pendingCount = item.agent?.pendingPermissions.length ?? 0;
        return (
          <Pressable
            key={item.id}
            onPress={() => onSelect(item.id)}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}, ${STATE_LABEL[item.state]}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              paddingHorizontal: 10,
              paddingVertical: 8,
              borderRadius: 7,
              borderWidth: selected ? 1.5 : 1,
              borderColor: selected
                ? theme.colors.accent
                : item.state === "runaway"
                  ? theme.colors.statusDanger
                  : theme.colors.border,
              backgroundColor: selected ? theme.colors.surface2 : theme.colors.surface1,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
              <PixelSprite
                bitmap={STATE_ICONS[item.state]}
                colors={palette.colors}
                paletteKey={palette.key}
                scale={2}
              />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: theme.colors.foreground,
                      fontSize: 13,
                      fontWeight: "600",
                      flexShrink: 1,
                    }}
                  >
                    {item.title}
                  </Text>
                  {pendingCount > 0 ? (
                    <View
                      style={{
                        paddingHorizontal: 5,
                        paddingVertical: 1,
                        borderRadius: 4,
                        backgroundColor: theme.colors.statusWarning,
                      }}
                    >
                      <Text style={{ color: "#ffffff", fontSize: 10, fontWeight: "700" }}>
                        {pendingCount} 待审批
                      </Text>
                    </View>
                  ) : null}
                  {item.state === "runaway" ? (
                    <View
                      style={{
                        paddingHorizontal: 5,
                        paddingVertical: 1,
                        borderRadius: 4,
                        backgroundColor: theme.colors.statusDanger,
                      }}
                    >
                      <Text style={{ color: "#ffffff", fontSize: 10, fontWeight: "700" }}>
                        失控残留
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text numberOfLines={1} style={{ color: theme.colors.foregroundMuted, fontSize: 11 }}>
                  {item.workspaceName} · {item.modelLabel}
                </Text>
              </View>
            </View>

            <View style={{ alignItems: "flex-end", gap: 2 }}>
              <Text
                style={{
                  color:
                    item.machineLoad === "runaway" || item.machineLoad === "hot"
                      ? theme.colors.statusDanger
                      : theme.colors.foreground,
                  fontSize: 11,
                  fontWeight: "600",
                }}
              >
                {item.processCount > 0
                  ? `${item.processCount} 进程 · ${formatCpu(item.cpu)}`
                  : STATE_LABEL[item.state]}
              </Text>
              {item.processCount > 0 ? (
                <Text style={{ color: theme.colors.foregroundMuted, fontSize: 10 }}>
                  {formatMemory(item.rssKb)}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
});
