import { Text, View } from "react-native";
import { radius, spacing } from "../../../theme/tokens";
import type { ThemeColors } from "../../../ui/app-theme";
import { Button } from "../../../ui/Button";

export type ReportPendingAction = "save" | "pdf" | null;

export function SessionReportActions({ colors, compact, dirty, draftStatus, hasExistingReport, pendingAction = null, onSave, onExport }: {
  colors: ThemeColors;
  compact: boolean;
  dirty: boolean;
  hasExistingReport: boolean;
  draftStatus: "loading" | "idle" | "saving" | "saved" | "restored";
  pendingAction?: ReportPendingAction;
  onSave: () => void;
  onExport: () => void;
}) {
  const status = dirty
    ? draftStatus === "saving" ? "Salvando rascunho…" : draftStatus === "saved" || draftStatus === "restored" ? "Rascunho salvo no aparelho" : "Rascunho"
    : hasExistingReport ? "Salvo" : "Rascunho";
  return (
    <View style={{ flexDirection: compact ? "column" : "row", alignItems: compact ? "stretch" : "center", gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm }}>
      <Text accessibilityLiveRegion="polite" style={{ flex: compact ? undefined : 1, fontSize: 12, color: colors.muted }}>{status}</Text>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <View style={{ flex: compact ? 1 : undefined, borderRadius: radius.internal }}><Button label="Baixar PDF" variant="ghost" onPress={onExport} loading={pendingAction === "pdf"} loadingLabel="Gerando PDF…" disabled={pendingAction !== null} /></View>
        <View style={{ flex: compact ? 1 : undefined }}><Button label="Salvar relatório" onPress={onSave} disabled={!dirty || pendingAction !== null} loading={pendingAction === "save"} loadingLabel="Salvando…" /></View>
      </View>
    </View>
  );
}
