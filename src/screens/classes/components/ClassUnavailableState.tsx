import { ScrollView, StyleSheet, View } from "react-native";
import { OperationalText as Text } from "../../../ui/OperationalText";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenPageHeader } from "../../../components/ui/ScreenPageHeader";
import { radius, spacing } from "../../../theme/tokens";
import { Button } from "../../../ui/Button";
import { useAppTheme } from "../../../ui/app-theme";
import { GoAtletaIcon } from "../../../ui/icon-registry";

type ClassUnavailableStateProps = {
  kind: "unavailable" | "error" | "context";
  organizationName?: string;
  errorMessage?: string | null;
  onBack: () => void;
  onRetry: () => void;
};

export function ClassUnavailableState({
  kind,
  organizationName,
  errorMessage,
  onBack,
  onRetry,
}: ClassUnavailableStateProps) {
  const { colors } = useAppTheme();
  const title = kind === "context"
    ? "Escolha uma instituição"
    : kind === "error"
      ? "Não foi possível carregar a turma"
      : "Turma indisponível";
  const institution = organizationName?.trim();
  const description = kind === "context"
    ? "Abra uma instituição com acesso a esta turma."
    : kind === "error"
      ? errorMessage || "Confira sua conexão e tente novamente."
      : `Não encontramos esta turma ${institution ? `em ${institution}` : "na instituição atual"}. Confira a instituição e seu acesso.`;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenPageHeader title="Turma" onBack={onBack} horizontalBleed={0} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.icon, { backgroundColor: colors.secondaryBg }]}>
            <GoAtletaIcon name="classes" size={26} color={colors.muted} />
          </View>
          <View style={styles.copy}>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{title}</Text>
            <Text style={[styles.description, { color: colors.muted }]}>{description}</Text>
          </View>
          <View style={styles.actions}>
            <Button label="Voltar para turmas" onPress={onBack} />
            {kind !== "context" ? <Button label="Tentar novamente" onPress={onRetry} variant="outline" /> : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "center", padding: spacing.md, paddingBottom: spacing.xxl },
  card: { width: "100%", maxWidth: 440, alignSelf: "center", padding: spacing.xl, borderRadius: radius.xl, borderWidth: 1, gap: spacing.lg },
  icon: { width: 56, height: 56, borderRadius: radius.full, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  copy: { gap: spacing.xs },
  title: { fontSize: 20, lineHeight: 26, fontWeight: "700", textAlign: "center" },
  description: { fontSize: 14, lineHeight: 21, textAlign: "center" },
  actions: { gap: spacing.xs },
});
