import { View } from "react-native";
import { OperationalText as Text } from "../../ui/OperationalText";
import { useAppTheme } from "../../ui/app-theme";
import { compactUiMetrics as metrics, spacing } from "../../theme/tokens";
export function FamilyInviteIdentitySummary({ organizationName, studentName, relationship }: {
  organizationName: string; studentName: string; relationship: string;
}) {
  const { colors } = useAppTheme();
  return <View style={{ gap: spacing.xs }}>
    <Text style={{ color: colors.muted, fontSize: metrics.bodyFontSize }}>{organizationName}</Text>
    <Text style={{ color: colors.text, fontWeight: "900", fontSize: metrics.titleFontSize }}>{studentName}</Text>
    <Text style={{ color: colors.muted, fontSize: metrics.bodyFontSize }}>Acesso como {relationship}</Text>
  </View>;
}
