import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";
import { OperationalText as Text } from "../../ui/OperationalText";
import { Button } from "../../ui/Button";
import { ListEmptyState } from "../../ui/ListEmptyState";

import type { ThemeColors } from "../../ui/app-theme";
import { spacing } from "../../theme/tokens";
import { useResponsiveLayout } from "../../ui/use-responsive-layout";

type PanelProps = {
  children: ReactNode;
  colors: ThemeColors;
  style?: StyleProp<ViewStyle>;
};

export function RegulationPanel({ children, style }: PanelProps) {
  const { density } = useResponsiveLayout("content");
  return (
    <View
      style={[
        {
          paddingVertical: density.cardPadding,
          gap: density.sectionGap,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function RegulationSectionHeader({
  title,
  description,
  colors,
}: {
  title: string;
  description?: string;
  colors: ThemeColors;
}) {
  const { density } = useResponsiveLayout("content");
  return (
    <View style={{ gap: 3 }}>
      <Text accessibilityRole="header" style={{ color: colors.text, fontSize: density.sectionTitleFontSize, fontWeight: "700" }}>{title}</Text>
      {description ? <Text style={{ color: colors.muted }}>{description}</Text> : null}
    </View>
  );
}

export function RegulationEmpty({ title, detail, children }: {
  title: string;
  detail: string;
  colors: ThemeColors;
  children?: ReactNode;
}) {
  return (
    <View>
      <ListEmptyState title={title} description={detail} />
      {children ? <View style={{ alignSelf: "center", marginTop: -24, marginBottom: 24 }}>{children}</View> : null}
    </View>
  );
}

export function RegulationProblem({
  title,
  detail,
  onRetry,
  colors,
}: {
  title: string;
  detail?: string;
  onRetry?: () => void;
  colors: ThemeColors;
}) {
  return (
    <View style={{ gap: spacing.xs }}>
      <View accessibilityRole="alert" style={{ gap: 4 }}>
        <Text style={{ color: colors.dangerText, fontWeight: "700" }}>{title}</Text>
        {detail ? <Text style={{ color: colors.muted }}>{detail}</Text> : null}
      </View>
      {onRetry ? <View style={{ alignSelf: "flex-start" }}><Button label="Tentar novamente" variant="secondary" onPress={onRetry} /></View> : null}
    </View>
  );
}
