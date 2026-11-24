import { memo } from "react";
import { Image, PixelRatio, type ImageStyle, type StyleProp } from "react-native";
import { encodePixelPng, type ColorMap, type PixelBitmap } from "./pixel-png";

export interface PixelSpriteProps {
  bitmap: PixelBitmap;
  colors: ColorMap;
  paletteKey: string;
  /** Layout pixels per art pixel (e.g. 2 or 3). */
  scale?: number;
  style?: StyleProp<ImageStyle>;
}

export const PixelSprite = memo(function PixelSprite({
  bitmap,
  colors,
  paletteKey,
  scale = 2,
  style,
}: PixelSpriteProps) {
  const dpr = typeof PixelRatio?.get === "function" ? PixelRatio.get() : 1;
  const deviceScale = Math.max(1, Math.round(scale * dpr));
  const uri = encodePixelPng(bitmap, colors, deviceScale, paletteKey);
  const width = bitmap.width * scale;
  const height = bitmap.height * scale;
  return (
    <Image
      accessible={false}
      fadeDuration={0}
      source={{ uri, width, height }}
      style={[{ width, height }, style]}
    />
  );
});
