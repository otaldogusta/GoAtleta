import { Text, View } from "react-native";
import { useAppTheme } from "../../ui/app-theme";
import { spacing } from "../../theme/tokens";
export function FamilyInviteIdentitySummary({ organizationName, studentName, relationship }: {
  organizationName: string; studentName: string; relationship: string;
}) {
  const { colors } = useAppTheme();
  return <View style={{ gap: spacing.xs }}>
    <Text style={{ color: colors.muted, fontSize: 13 }}>{organizationName}</Text>
    <Text style={{ color: colors.text, fontWeight: "900", fontSize: 20 }}>{studentName}</Text>
    <Text style={{ color: colors.muted }}>Acesso como {relationship}</Text>
  </View>;
}
