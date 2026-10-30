import { useRouter } from "expo-router";
import { View } from "react-native";
import { OperationalText as Text } from "../../ui/OperationalText";

import { useRole } from "../../auth/role";
import { ResponsiveGrid } from "../../components/ui/ResponsiveGrid";
import { markRender } from "../../observability/perf";
import { compactUiMetrics as metrics } from "../../theme/tokens";
import { useAppTheme } from "../../ui/app-theme";
import { useResponsiveLayout } from "../../ui/use-responsive-layout";
import { FamilyScreenShell } from "./FamilyScreenShell";
import { FamilyScheduleItemCard } from "./FamilyScheduleItemCard";
import { FamilyStudentSwitcher } from "./FamilyStudentSwitcher";
import { FamilyButton, FamilyEmptyState, FamilySurface } from "./FamilyUi";
import { useFamilyOverview } from "./useFamilyOverview";

export function FamilyHomeScreen() {
  markRender("screen.familyHome.render.root");
  const router = useRouter();
  const { colors } = useAppTheme();
  const layout = useResponsiveLayout("dashboard");
  const padding = layout.density.cardPadding;
  const { selectedFamilyStudent } = useRole();
  const { overview, loading, failed, refresh } = useFamilyOverview();
  const nextSchedule = overview?.nextSchedule[0] ?? null;

  return (
    <FamilyScreenShell
      title="Hoje"
      subtitle="Acompanhe a rotina esportiva e as mensalidades."
      refreshing={loading}
      onRefresh={selectedFamilyStudent ? refresh : undefined}
    >
      <FamilyStudentSwitcher />
      {!selectedFamilyStudent ? (
        <FamilyEmptyState
          padding={padding}
          title="Vínculo não encontrado"
          description="Peça à instituição um convite para acompanhar o atleta."
        />
      ) : (
        <ResponsiveGrid columns={{ compact: "1", split: "8/4" }} gap={layout.density.pageGap}>
          <View style={{ gap: metrics.gap }}>
            {failed ? (
              <FamilyEmptyState
                padding={padding}
                icon="warningCircle"
                title="Resumo indisponível"
                description="Não foi possível carregar agenda e frequência agora."
              />
            ) : loading && !overview ? (
              <FamilyEmptyState
                padding={padding}
                icon="calendar"
                title="Carregando resumo"
                description="Aguarde um instante."
              />
            ) : nextSchedule ? (
              <FamilyScheduleItemCard item={nextSchedule} padding={padding} />
            ) : selectedFamilyStudent.canViewAgenda ? (
              <FamilySurface title="Próxima atividade" padding={padding}>
                <Text style={{ color: colors.muted, fontSize: metrics.bodyFontSize }}>
                  Nenhuma atividade futura foi publicada.
                </Text>
              </FamilySurface>
            ) : null}
            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: metrics.smallGap }}>
              <FamilyButton label="Agenda" icon="agenda" onPress={() => router.push("/family/agenda" as never)} />
              <FamilyButton label="Pagamentos" icon="payments" onPress={() => router.push("/family/payments" as never)} />
              <FamilyButton label="Perfil" icon="profile" onPress={() => router.push("/family/profile" as never)} />
            </View>
          </View>
          <View style={{ gap: metrics.gap }}>
            <FamilySurface title="Frequência" padding={padding} accessory={selectedFamilyStudent.canViewAttendance && overview?.attendance.available ? (
              <Text style={{ color: colors.text, fontSize: metrics.titleFontSize, lineHeight: metrics.titleLineHeight, fontWeight: "700" }}>
                {overview.attendance.attendanceRatePercent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
              </Text>
            ) : undefined}>
              {!selectedFamilyStudent.canViewAttendance ? (
                <Text style={{ color: colors.muted, fontSize: metrics.bodyFontSize }}>
                  A instituição não liberou este acompanhamento.
                </Text>
              ) : overview?.attendance.available ? (
                <Text style={{ color: colors.muted, fontSize: metrics.metadataFontSize, lineHeight: metrics.metadataLineHeight }}>
                  {overview.attendance.present} presença(s) em {overview.attendance.total} registro(s)
                </Text>
              ) : (
                <Text style={{ color: colors.muted, fontSize: metrics.bodyFontSize }}>
                  Nenhuma presença registrada até agora.
                </Text>
              )}
            </FamilySurface>
            <FamilySurface title="Evolução" padding={padding}>
              {!selectedFamilyStudent.canViewProgress ? (
                <Text style={{ color: colors.muted, fontSize: metrics.bodyFontSize }}>
                  A instituição não liberou este acompanhamento.
                </Text>
              ) : overview?.progress.reason === "progress_semantics_not_modeled_yet" ? (
                <Text style={{ color: colors.muted, fontSize: metrics.bodyFontSize }}>
                  Ainda não disponível. O modelo de evolução está sendo definido.
                </Text>
              ) : (
                <Text style={{ color: colors.muted, fontSize: metrics.bodyFontSize }}>
                  Ainda não há evolução publicada.
                </Text>
              )}
            </FamilySurface>
            <FamilySurface title="Acesso do vínculo" padding={padding}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: metrics.gap, rowGap: metrics.smallGap }}>
                <Text style={{ color: colors.muted, fontSize: metrics.metadataFontSize, lineHeight: metrics.metadataLineHeight }}>
                  Agenda {selectedFamilyStudent.canViewAgenda ? "liberada" : "restrita"}
                </Text>
                <Text style={{ color: colors.muted, fontSize: metrics.metadataFontSize, lineHeight: metrics.metadataLineHeight }}>
                  Frequência {selectedFamilyStudent.canViewAttendance ? "liberada" : "restrita"}
                </Text>
                <Text style={{ color: colors.muted, fontSize: metrics.metadataFontSize, lineHeight: metrics.metadataLineHeight }}>
                  Evolução {selectedFamilyStudent.canViewProgress ? "liberada" : "restrita"}
                </Text>
                <Text style={{ color: colors.muted, fontSize: metrics.metadataFontSize, lineHeight: metrics.metadataLineHeight }}>
                  Financeiro {selectedFamilyStudent.canViewFinance ? "liberado" : "restrito"}
                </Text>
              </View>
            </FamilySurface>
          </View>
        </ResponsiveGrid>
      )}
    </FamilyScreenShell>
  );
}
