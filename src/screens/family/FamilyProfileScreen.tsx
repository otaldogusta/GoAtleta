// perf-check: ignore-measure -- profile reads hydrated auth state only.
import { useRouter } from "expo-router";
import { Text, View } from "react-native";

import { useAuth } from "../../auth/auth";
import { useRole } from "../../auth/role";
import type { SelectableUserRole } from "../../auth/role-types";
import { markRender } from "../../observability/perf";
import { spacing } from "../../theme/tokens";
import { Button } from "../../ui/Button";
import { useAppTheme } from "../../ui/app-theme";
import { FamilyScreenShell } from "./FamilyScreenShell";
import { FamilyStudentSwitcher } from "./FamilyStudentSwitcher";
import { FamilySurface } from "./FamilyUi";

const roleLabel: Record<SelectableUserRole, string> = {
  trainer: "Área profissional",
  student: "Minha jornada",
  family: "Família",
};

export function FamilyProfileScreen() {
  markRender("screen.familyProfile.render.root");
  const router = useRouter();
  const { colors } = useAppTheme();
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
      <View style={{ gap: spacing.md }}>
        <FamilySurface title="Conta">
          <Text style={{ color: colors.text, fontWeight: "800" }}>
            {session?.user?.email ?? "Conta Go Atleta"}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 13 }}>
            {familyContexts.length} atleta(s) vinculado(s)
          </Text>
        </FamilySurface>
        {selectedFamilyStudent ? (
          <FamilySurface title="Vínculo ativo">
            <Text style={{ color: colors.text, fontWeight: "800" }}>
              {selectedFamilyStudent.studentName}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13 }}>
              {selectedFamilyStudent.relationshipLabel} · {selectedFamilyStudent.organizationName}
            </Text>
          </FamilySurface>
        ) : null}
        {otherRoles.length ? (
          <FamilySurface title="Alternar perfil">
            <View style={{ gap: spacing.xs }}>
              {otherRoles.map((role) => (
                <Button
                  key={role}
                  label={roleLabel[role]}
                  variant="outline"
                  onPress={() => {
                    void switchRole(role);
                  }}
                />
              ))}
            </View>
          </FamilySurface>
        ) : null}
        <Button
          label="Sair da conta"
          variant="danger"
          onPress={() => {
            void signOut();
          }}
        />
      </View>
    </FamilyScreenShell>
  );
}
