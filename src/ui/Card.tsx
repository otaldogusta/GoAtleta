import { OperationalText as Text } from "./OperationalText";
import { Pressable } from "./Pressable";
import { useAppTheme } from "./app-theme";
import { getGlassCardStyle } from "./glass-styles";
import { compactUiMetrics } from "../theme/compact-ui-metrics";

export function Card({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle?: string;
  onPress?: () => void;
}) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      style={{
        padding: 12,
        minHeight: onPress ? compactUiMetrics.touchTarget : undefined,
        borderRadius: 16,
        overflow: "hidden",
        ...getGlassCardStyle(colors),
      }}
    >
      <Text
        style={{
          fontSize: compactUiMetrics.bodyFontSize,
          lineHeight: compactUiMetrics.bodyLineHeight,
          fontWeight: "700",
          color: colors.text,
        }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={{ color: colors.text, fontSize: compactUiMetrics.metadataFontSize, lineHeight: compactUiMetrics.metadataLineHeight, marginTop: 4, opacity: 0.8 }}
        >
          {subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
}
