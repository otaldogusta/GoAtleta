// perf-check: ignore-measure -- profile reads hydrated auth state only.
import { useRouter } from "expo-router";
import { View } from "react-native";
import { OperationalText as Text } from "../../ui/OperationalText";

import { useAuth } from "../../auth/auth";
import { useRole } from "../../auth/role";
import type { SelectableUserRole } from "../../auth/role-types";
import { ResponsiveGrid } from "../../components/ui/ResponsiveGrid";
import { markRender } from "../../observability/perf";
import { compactUiMetrics as metrics } from "../../theme/tokens";
import { useAppTheme } from "../../ui/app-theme";
import { useResponsiveLayout } from "../../ui/use-responsive-layout";
import { FamilyScreenShell } from "./FamilyScreenShell";
import { FamilyStudentSwitcher } from "./FamilyStudentSwitcher";
import { FamilyButton, FamilySurface } from "./FamilyUi";
import { GuardianAthleteInvite } from "./GuardianAthleteInvite";

const roleLabel: Record<SelectableUserRole, string> = {
  trainer: "Área profissional",
  student: "Minha jornada",
  family: "Família",
};

export function FamilyProfileScreen() {
  markRender("screen.familyProfile.render.root");
  const router = useRouter();
  const { colors } = useAppTheme();
  const layout = useResponsiveLayout("dashboard");
  const padding = layout.density.cardPadding;
  const { session, signOut } = useAuth();
  const {
    availableRoles,
    familyContexts,
    selectedFamilyStudent,
    setActiveRole,
  } = useRole();
  const otherRoles = availableRoles.filter((role) => role !== "family");

  const switchRole = async (role: SelectableUserRole) => {
    const changed = await setActiveRole(role);
    if (changed) router.replace("/" as never);
  };

  return (
    <FamilyScreenShell title="Perfil" subtitle="Conta e vínculos familiares.">
      <FamilyStudentSwitcher />
      <ResponsiveGrid columns={{ compact: "1", split: "8/4" }} gap={layout.density.pageGap}>
        <View style={{ gap: metrics.gap }}>
        <FamilySurface title="Conta" padding={padding}>
          <Text style={{ color: colors.text, fontSize: metrics.bodyFontSize, fontWeight: "800" }}>
            {session?.user?.email ?? "Conta Go Atleta"}
          </Text>
          <Text style={{ color: colors.muted, fontSize: metrics.bodyFontSize }}>
            {familyContexts.length} atleta(s) vinculado(s)
          </Text>
        </FamilySurface>
        {selectedFamilyStudent ? (
          <FamilySurface title="Vínculo ativo" padding={padding}>
            <Text style={{ color: colors.text, fontSize: metrics.bodyFontSize, fontWeight: "800" }}>
              {selectedFamilyStudent.studentName}
            </Text>
            <Text style={{ color: colors.muted, fontSize: metrics.bodyFontSize }}>
              {selectedFamilyStudent.relationshipLabel} · {selectedFamilyStudent.organizationName}
            </Text>
            {selectedFamilyStudent.relationshipType === "guardian" ? <GuardianAthleteInvite
              key={`${selectedFamilyStudent.organizationId}:${selectedFamilyStudent.studentId}`}
              organizationId={selectedFamilyStudent.organizationId} studentId={selectedFamilyStudent.studentId} /> : null}
          </FamilySurface>
        ) : null}
        </View>
        <View style={{ gap: metrics.gap }}>
        {otherRoles.length ? (
          <FamilySurface title="Alternar perfil" padding={padding}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: metrics.smallGap }}>
              {otherRoles.map((role) => (
                <FamilyButton
                  key={role}
                  label={roleLabel[role]}
                  onPress={() => {
                    void switchRole(role);
                  }}
                />
              ))}
            </View>
          </FamilySurface>
        ) : null}
        <FamilySurface title="Ações da conta" padding={padding}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: metrics.smallGap }}>
        <FamilyButton
          label="Vincular outro atleta"
          onPress={() => router.push("/pending" as never)}
        />
        <FamilyButton
          label="Sair da conta"
          variant="danger"
          onPress={() => {
            void signOut();
          }}
        />
        </View>
        </FamilySurface>
      </View>
      </ResponsiveGrid>
    </FamilyScreenShell>
  );
}
