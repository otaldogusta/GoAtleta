import { Text, View } from "react-native";

import { useAppTheme } from "../../ui/app-theme";
import { Pressable } from "../../ui/Pressable";
import { radius } from "../../theme/tokens";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { useResponsiveLayout } from "../../ui/use-responsive-layout";

type AppHeaderProps = {
  title: string;
  subtitle?: string;
};

export function AppHeader({ title, subtitle }: AppHeaderProps) {
  const { colors } = useAppTheme();
  const { density } = useResponsiveLayout();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
      }}
    >
      <View style={{ gap: 2 }}>
        <Text style={{ fontSize: density.pageTitleFontSize, lineHeight: density.pageTitleLineHeight, fontWeight: "800", color: colors.text }}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ fontSize: 14, color: colors.muted }}>{subtitle}</Text>
        ) : null}
      </View>
      <Pressable
        style={{
          width: 40,
          height: 40,
          borderRadius: radius.full,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <GoAtletaIcon name="notifications" size={20} color={colors.text} />
      </Pressable>
    </View>
  );
}
