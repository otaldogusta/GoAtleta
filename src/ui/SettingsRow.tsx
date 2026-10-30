import { View } from "react-native";
import { OperationalText as Text } from "./OperationalText";
import { Pressable } from "./Pressable";
import { useAppTheme } from "./app-theme";
import { GoAtletaIcon, type GoAtletaIconName } from "./icon-registry";
import { compactUiMetrics } from "../theme/compact-ui-metrics";

export function SettingsRow({
  icon,
  iconBg,
  label,
  subtitle,
  onPress,
  rightContent,
}: {
  icon: GoAtletaIconName;
  iconBg: string;
  label: string;
  subtitle?: string;
  onPress?: () => void;
  rightContent?: React.ReactNode;
}) {
  const { colors } = useAppTheme();
  const rowStyle = {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    minHeight: compactUiMetrics.touchTarget,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  };
  const content = (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", flex: 1, minWidth: 0, gap: compactUiMetrics.gap }}>
        <View
          style={{
            width: compactUiMetrics.controlHeight,
            height: compactUiMetrics.controlHeight,
            borderRadius: 16,
            backgroundColor: iconBg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <GoAtletaIcon name={icon} size={compactUiMetrics.iconSize} color={colors.text} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.text, fontSize: compactUiMetrics.bodyFontSize, lineHeight: compactUiMetrics.bodyLineHeight, fontWeight: "600" }}>{label}</Text>
          {subtitle ? (
            <Text style={{ color: colors.muted, fontSize: compactUiMetrics.metadataFontSize, lineHeight: compactUiMetrics.metadataLineHeight, marginTop: 2 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {rightContent ? (
        rightContent
      ) : onPress ? (
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: colors.secondaryBg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <GoAtletaIcon name="chevronForward" size={16} color={colors.text} />
        </View>
      ) : null}
    </>
  );

  if (!onPress) {
    return <View style={rowStyle}>{content}</View>;
  }

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={rowStyle}>
      {content}
    </Pressable>
  );
}
