import { Image } from "expo-image";
import {
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from "react-native";

const brandSources = {
  navy: {
    mark: require("../../assets/brand/goatleta-mark.svg"),
    wordmark: require("../../assets/brand/goatleta-wordmark.svg"),
  },
  light: {
    mark: require("../../assets/brand/goatleta-mark-light.svg"),
    wordmark: require("../../assets/brand/goatleta-wordmark-light.svg"),
  },
} as const;

const WORDMARK_ASPECT_RATIO = 634 / 121;

type BrandAssetProps = {
  decorative?: boolean;
  tone?: keyof typeof brandSources;
  style?: StyleProp<ImageStyle>;
};

export function GoAtletaBrandMark({
  size = 40,
  tone = "navy",
  decorative = false,
  style,
}: BrandAssetProps & { size?: number }) {
  return (
    <Image
      accessible={!decorative}
      accessibilityLabel={decorative ? undefined : "Go Atleta"}
      source={brandSources[tone].mark}
      contentFit="contain"
      transition={0}
      style={[{ width: size, height: size }, style]}
    />
  );
}

export function GoAtletaBrandWordmark({
  height = 20,
  tone = "navy",
  decorative = false,
  style,
}: BrandAssetProps & { height?: number }) {
  return (
    <Image
      accessible={!decorative}
      accessibilityLabel={decorative ? undefined : "Go Atleta"}
      source={brandSources[tone].wordmark}
      contentFit="contain"
      transition={0}
      style={[
        {
          width: Math.round(height * WORDMARK_ASPECT_RATIO),
          height,
        },
        style,
      ]}
    />
  );
}

export function GoAtletaBrandLockup({
  height = 36,
  tone = "navy",
  gap = 8,
  style,
}: Omit<BrandAssetProps, "style"> & {
  height?: number;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const wordmarkHeight = Math.round(height * 0.5);

  return (
    <View
      accessible
      accessibilityLabel="Go Atleta"
      style={[{ flexDirection: "row", alignItems: "center", gap }, style]}
    >
      <GoAtletaBrandMark size={height} tone={tone} decorative />
      <GoAtletaBrandWordmark height={wordmarkHeight} tone={tone} decorative />
    </View>
  );
}
