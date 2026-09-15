import { Text, TextInput, View } from "react-native";
import type { FamilyAccessIntent } from "../../api/family-access-request";
import { Button } from "../../ui/Button";
import { AnimatedFieldDetails } from "../../ui/AnimatedFieldDetails";
import { useAppTheme } from "../../ui/app-theme";
import { radius, spacing } from "../../theme/tokens";

export function FamilyAccessIntentFields({ kind, studentName, relationshipLabel, onKind, onStudentName, onRelationshipLabel, disabled = false }: {
  kind: FamilyAccessIntent | null; studentName: string; relationshipLabel: string;
  onKind: (value: FamilyAccessIntent) => void; onStudentName: (value: string) => void;
  onRelationshipLabel: (value: string) => void; disabled?: boolean;
}) {
  const { colors } = useAppTheme();
  const field = (label: string, value: string, onChangeText: (value: string) => void, maxLength: number) => <View style={{ gap: spacing.xs }}>
    <Text style={{ color: colors.muted, fontSize: 13 }}>{label}</Text>
    <View style={{ minHeight: 50, borderRadius: radius.internal, paddingHorizontal: 14, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border }}>
      <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} editable={!disabled} maxLength={maxLength}
        style={{ minHeight: 50, borderRadius: 0, color: colors.inputText }} />
    </View>
  </View>;
  return <View style={{ gap: spacing.sm }}>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
      <Button label="Sou atleta" variant={kind === "athlete" ? "primary" : "outline"} disabled={disabled} onPress={() => onKind("athlete")} />
      <Button label="Sou responsável" variant={kind === "guardian" ? "primary" : "outline"} disabled={disabled} onPress={() => onKind("guardian")} />
    </View>
    {kind ? field(kind === "athlete" ? "Seu nome no cadastro de atleta" : "Nome do atleta", studentName, onStudentName, 160) : null}
    <AnimatedFieldDetails open={kind === "guardian"}>{field("Parentesco", relationshipLabel, onRelationshipLabel, 80)}</AnimatedFieldDetails>
  </View>;
}
