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

export function FamilyAgendaScreen() {
  markRender("screen.familyAgenda.render.root");
  const { colors } = useAppTheme();
  const layout = useResponsiveLayout("dashboard");
  const padding = layout.density.cardPadding;
  const { selectedFamilyStudent } = useRole();
  const { overview, loading, failed, refresh } = useFamilyOverview();
  const agendaRestricted = !selectedFamilyStudent?.canViewAgenda || overview?.canViewSchedule === false;
  const attendance = overview?.attendance;

  return (
    <FamilyScreenShell
      title="Agenda"
      subtitle="Programação publicada pela instituição."
      refreshing={loading}
      onRefresh={selectedFamilyStudent?.canViewAgenda ? refresh : undefined}
    >
      <FamilyStudentSwitcher />
      {!selectedFamilyStudent ? (
        <FamilyEmptyState
          padding={padding}
          icon="agenda"
          title="Sem atleta selecionado"
          description="Selecione um vínculo familiar para consultar a agenda."
        />
      ) : agendaRestricted ? (
        <FamilyEmptyState
          padding={padding}
          icon="lock"
          title="Agenda restrita"
          description="A instituição ainda não liberou a agenda para este vínculo."
        />
      ) : failed && !overview ? (
        <FamilyEmptyState
          padding={padding}
          icon="warningCircle"
          title="Agenda indisponível"
          description="Não foi possível carregar a programação agora."
          action={<FamilyButton label="Tentar novamente" loading={loading} loadingLabel="Atualizando agenda…" onPress={() => void refresh()} />}
        />
      ) : loading && !overview ? (
        <FamilyEmptyState
          padding={padding}
          icon="calendar"
          title="Carregando agenda"
          description="Aguarde um instante."
        />
      ) : (
        <ResponsiveGrid columns={{ compact: "1", split: "8/4" }} gap={layout.density.pageGap}>
          <View style={{ gap: metrics.gap }}>
            {failed ? (
              <FamilyEmptyState
                padding={padding}
                icon="warningCircle"
                title="Agenda desatualizada"
                description="A atualização falhou. Você está vendo a última agenda carregada para este vínculo."
                action={<FamilyButton label="Tentar novamente" loading={loading} loadingLabel="Atualizando agenda…" onPress={() => void refresh()} />}
              />
            ) : null}
            {overview?.nextSchedule.length ? (
              overview.nextSchedule.map((item) => (
                <FamilyScheduleItemCard key={item.id} item={item} padding={padding} />
              ))
            ) : (
              <FamilyEmptyState
                padding={padding}
                icon="calendar"
                title="Nenhuma atividade publicada"
                description="Os próximos treinos e eventos aparecerão aqui quando forem publicados."
              />
            )}
          </View>
          <View style={{ gap: metrics.gap }}>
            <FamilySurface title="Turma" padding={padding}>
              <Text style={{ color: colors.text, fontWeight: "800" }}>
                {selectedFamilyStudent.className ?? "Não informada"}
              </Text>
              <Text style={{ color: colors.muted, fontSize: metrics.bodyFontSize }}>
                {selectedFamilyStudent.organizationName}
              </Text>
            </FamilySurface>
            <FamilySurface title="Frequência" padding={padding}>
              <Text style={{ color: colors.muted, fontSize: metrics.bodyFontSize }}>
                {!selectedFamilyStudent.canViewAttendance || overview?.canViewAttendance === false
                  ? "A instituição não liberou este acompanhamento."
                  : !attendance?.available
                    ? "Frequência indisponível para este vínculo."
                    : attendance.total > 0
                      ? `${attendance.present} presença(s) em ${attendance.total} registro(s).`
                      : "Nenhuma presença registrada até agora."}
              </Text>
            </FamilySurface>
          </View>
        </ResponsiveGrid>
      )}
    </FamilyScreenShell>
  );
}
