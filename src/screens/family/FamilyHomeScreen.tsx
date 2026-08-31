import { useRouter } from "expo-router";
import { Text, View } from "react-native";

import { useRole } from "../../auth/role";
import { ResponsiveGrid } from "../../components/ui/ResponsiveGrid";
import { markRender } from "../../observability/perf";
import { radius, spacing } from "../../theme/tokens";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon, type GoAtletaIconName } from "../../ui/icon-registry";
import { FamilyScreenShell } from "./FamilyScreenShell";
import { FamilyScheduleItemCard } from "./FamilyScheduleItemCard";
import { FamilyStudentSwitcher } from "./FamilyStudentSwitcher";
import { FamilyEmptyState, FamilySurface } from "./FamilyUi";
import { useFamilyOverview } from "./useFamilyOverview";

function FamilyAction({
  label,
  description,
  icon,
  onPress,
}: {
  label: string;
  description: string;
  icon: GoAtletaIconName;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        minHeight: 78,
        borderRadius: radius.container,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        padding: spacing.md,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
      }}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 21,
          backgroundColor: colors.successBg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <GoAtletaIcon name={icon} size={20} color={colors.successText} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={{ color: colors.text, fontWeight: "800" }}>{label}</Text>
        <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 12 }}>
          {description}
        </Text>
      </View>
      <GoAtletaIcon name="chevronForward" size={18} color={colors.muted} />
    </Pressable>
  );
}

export function FamilyHomeScreen() {
  markRender("screen.familyHome.render.root");
  const router = useRouter();
  const { colors } = useAppTheme();
  const { selectedFamilyStudent } = useRole();
  const { overview, loading, failed, refresh } = useFamilyOverview();
  const firstName = selectedFamilyStudent?.studentName.split(/\s+/)[0] ?? "";
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
          title="Vínculo não encontrado"
          description="Peça à instituição um convite para acompanhar o atleta."
        />
      ) : (
        <ResponsiveGrid columns={{ compact: "1", split: "8/4" }} gap={spacing.md}>
          <View style={{ gap: spacing.sm }}>
            <FamilySurface
              eyebrow={selectedFamilyStudent.relationshipLabel}
              title={firstName ? `Acompanhando ${firstName}` : "Atleta acompanhado"}
            >
              <Text style={{ color: colors.muted, fontSize: 13 }}>
                {selectedFamilyStudent.organizationName}
              </Text>
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
                {selectedFamilyStudent.className ?? "Turma ainda não informada"}
              </Text>
            </FamilySurface>
            {failed ? (
              <FamilyEmptyState
                icon="warningCircle"
                title="Resumo indisponível"
                description="Não foi possível carregar agenda e frequência agora."
              />
            ) : loading && !overview ? (
              <FamilyEmptyState
                icon="calendar"
                title="Carregando resumo"
                description="Aguarde um instante."
              />
            ) : nextSchedule ? (
              <FamilyScheduleItemCard item={nextSchedule} />
            ) : selectedFamilyStudent.canViewAgenda ? (
              <FamilySurface title="Próxima atividade">
                <Text style={{ color: colors.muted, fontSize: 13 }}>
                  Nenhuma atividade futura foi publicada.
                </Text>
              </FamilySurface>
            ) : null}
            <FamilyAction
              label="Agenda"
              description="Consulte as atividades publicadas pela instituição."
              icon="agenda"
              onPress={() => router.push("/family/agenda" as never)}
            />
            <FamilyAction
              label="Pagamentos"
              description="Veja mensalidades, vencimentos e comprovantes."
              icon="payments"
              onPress={() => router.push("/family/payments" as never)}
            />
          </View>
          <View style={{ gap: spacing.sm }}>
            <FamilySurface title="Frequência">
              {!selectedFamilyStudent.canViewAttendance ? (
                <Text style={{ color: colors.muted, fontSize: 13 }}>
                  A instituição não liberou este acompanhamento.
                </Text>
              ) : overview?.attendance.available ? (
                <>
                  <Text style={{ color: colors.text, fontSize: 24, fontWeight: "900" }}>
                    {overview.attendance.attendanceRatePercent.toLocaleString("pt-BR", {
                      maximumFractionDigits: 1,
                    })}%
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {overview.attendance.present} presença(s) em {overview.attendance.total} registro(s)
                  </Text>
                </>
              ) : (
                <Text style={{ color: colors.muted, fontSize: 13 }}>
                  Nenhuma presença registrada até agora.
                </Text>
              )}
            </FamilySurface>
            <FamilySurface title="Evolução">
              {!selectedFamilyStudent.canViewProgress ? (
                <Text style={{ color: colors.muted, fontSize: 13 }}>
                  A instituição não liberou este acompanhamento.
                </Text>
              ) : overview?.progress.reason === "progress_semantics_not_modeled_yet" ? (
                <Text style={{ color: colors.muted, fontSize: 13 }}>
                  Ainda não disponível. O modelo de evolução está sendo definido.
                </Text>
              ) : (
                <Text style={{ color: colors.muted, fontSize: 13 }}>
                  Ainda não há evolução publicada.
                </Text>
              )}
            </FamilySurface>
            <FamilySurface title="Acesso do vínculo">
              <Text style={{ color: colors.muted, fontSize: 13 }}>
                Agenda {selectedFamilyStudent.canViewAgenda ? "liberada" : "restrita"}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 13 }}>
                Frequência {selectedFamilyStudent.canViewAttendance ? "liberada" : "restrita"}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 13 }}>
                Evolução {selectedFamilyStudent.canViewProgress ? "liberada" : "restrita"}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 13 }}>
                Financeiro {selectedFamilyStudent.canViewFinance ? "liberado" : "restrito"}
              </Text>
            </FamilySurface>
            <FamilyAction
              label="Perfil"
              description="Gerencie atletas vinculados e perfis da conta."
              icon="profile"
              onPress={() => router.push("/family/profile" as never)}
            />
          </View>
        </ResponsiveGrid>
      )}
    </FamilyScreenShell>
  );
}
