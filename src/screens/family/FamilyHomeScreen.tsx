import { useRouter } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { OperationalText as Text } from "../../ui/OperationalText";

import { useRole } from "../../auth/role";
import { markRender } from "../../observability/perf";
import { compactUiMetrics as metrics, spacing } from "../../theme/tokens";
import { ListEmptyState } from "../../ui/ListEmptyState";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { useResponsiveLayout } from "../../ui/use-responsive-layout";
import { FamilyScreenShell } from "./FamilyScreenShell";
import { FamilyScheduleItemCard } from "./FamilyScheduleItemCard";
import { FamilyStudentSwitcher } from "./FamilyStudentSwitcher";
import { FamilyButton } from "./FamilyUi";
import { useFamilyOverview } from "./useFamilyOverview";

export function FamilyHomeScreen() {
  markRender("screen.familyHome.render.root");
  const router = useRouter();
  const { colors } = useAppTheme();
  const layout = useResponsiveLayout("dashboard");
  const { selectedFamilyStudent } = useRole();
  const { overview, loading, failed, refresh } = useFamilyOverview();
  const canShowAgenda = selectedFamilyStudent?.canViewAgenda && overview?.canViewSchedule;
  const nextSchedule = canShowAgenda ? overview?.nextSchedule[0] : undefined;
  const attendance = selectedFamilyStudent?.canViewAttendance && overview?.attendance;

  return (
    <FamilyScreenShell
      title="Hoje"
      refreshing={loading}
      onRefresh={selectedFamilyStudent ? refresh : undefined}
    >
      {selectedFamilyStudent ? <FamilyStudentSwitcher /> : null}
      {!selectedFamilyStudent ? (
        <ListEmptyState
          title="Nenhum atleta vinculado"
          description="Peça à instituição um convite para acompanhar o atleta."
        />
      ) : (
        <View style={{ gap: spacing.xl }}>
          {failed ? (
            <View style={{ alignItems: overview ? "flex-start" : "center", gap: metrics.gap, paddingVertical: overview ? spacing.sm : spacing.xxl, paddingHorizontal: overview ? 0 : spacing.md }}>
              <GoAtletaIcon name="warningCircle" size={metrics.iconSize} color={colors.muted} />
              <Text accessibilityRole="alert" style={{ color: colors.text, fontSize: metrics.bodyFontSize, fontWeight: "600", textAlign: overview ? "left" : "center" }}>
                {overview ? "Não foi possível atualizar" : "Não foi possível carregar o resumo"}
              </Text>
              <Text style={{ color: colors.muted, fontSize: metrics.metadataFontSize, lineHeight: metrics.metadataLineHeight, textAlign: overview ? "left" : "center", maxWidth: 280 }}>
                {overview ? "Os últimos dados deste atleta continuam visíveis." : "Tente novamente para ver as atividades e a frequência."}
              </Text>
              <View style={{ alignItems: "center" }}>
                <FamilyButton label="Tentar novamente" loading={loading} loadingLabel="Atualizando…" onPress={() => void refresh()} />
              </View>
            </View>
          ) : null}
          {loading && !overview && !failed ? (
            <View style={{ alignItems: "center", gap: metrics.gap, paddingVertical: spacing.xxl }}>
              <ActivityIndicator size="small" color={colors.muted} />
              <Text accessibilityLiveRegion="polite" style={{ color: colors.muted, fontSize: metrics.bodyFontSize }}>Carregando resumo…</Text>
            </View>
          ) : null}
          {canShowAgenda ? (
            <View style={{ gap: metrics.gap }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: metrics.gap }}>
                <Text style={{ color: colors.text, fontSize: metrics.bodyFontSize, fontWeight: "600" }}>Próxima atividade</Text>
                <FamilyButton label="Ver agenda" onPress={() => router.push("/family/agenda" as never)} />
              </View>
              {nextSchedule ? (
                <FamilyScheduleItemCard item={nextSchedule} padding={layout.density.cardPadding} />
              ) : (
                <Text style={{ color: colors.muted, fontSize: metrics.bodyFontSize, lineHeight: metrics.bodyLineHeight }}>
                  Nenhuma atividade prevista. Os próximos treinos aparecem aqui quando forem publicados.
                </Text>
              )}
            </View>
          ) : null}
          {attendance && attendance.available ? (
            <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.lg, gap: spacing.sm }}>
              <Text style={{ color: colors.text, fontSize: metrics.bodyFontSize, fontWeight: "600" }}>Frequência</Text>
              {attendance.total > 0 ? (
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.md }}>
                  <Text style={{ color: colors.text, fontSize: layout.density.pageTitleFontSize, lineHeight: layout.density.pageTitleLineHeight, fontWeight: "600" }}>
                    {attendance.attendanceRatePercent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: metrics.bodyFontSize, lineHeight: metrics.bodyLineHeight }}>
                    {attendance.present} {attendance.present === 1 ? "presença" : "presenças"} em {attendance.total} {attendance.total === 1 ? "registro" : "registros"}
                  </Text>
                </View>
              ) : (
                <Text style={{ color: colors.muted, fontSize: metrics.bodyFontSize }}>A primeira chamada aparecerá aqui.</Text>
              )}
            </View>
          ) : null}
          {overview && !canShowAgenda && !(attendance && attendance.available) ? (
            <ListEmptyState title="Sem atividades para acompanhar" description="A instituição define as informações disponíveis para este vínculo." />
          ) : null}
        </View>
      )}
    </FamilyScreenShell>
  );
}
