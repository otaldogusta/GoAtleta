import { Text, View } from "react-native";
import { Pressable } from "./Pressable";
import { useAppTheme } from "./app-theme";
import { GoAtletaIcon, type GoAtletaIconName } from "./icon-registry";

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
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  };
  const content = (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: iconBg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <GoAtletaIcon name={icon} size={18} color={colors.text} />
        </View>
        <View>
          <Text style={{ color: colors.text, fontWeight: "600" }}>{label}</Text>
          {subtitle ? (
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
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
