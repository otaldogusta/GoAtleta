// perf-check: ignore-measure -- profile reads hydrated auth state only.
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { OperationalText as Text } from "../../ui/OperationalText";

import { useAuth } from "../../auth/auth";
import { useRole } from "../../auth/role";
import type { SelectableUserRole } from "../../auth/role-types";
import { ResponsiveGrid } from "../../components/ui/ResponsiveGrid";
import { markRender } from "../../observability/perf";
import { compactUiMetrics as metrics, radius } from "../../theme/tokens";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { useResponsiveLayout } from "../../ui/use-responsive-layout";
import { FamilyScreenShell } from "./FamilyScreenShell";
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
    setActiveFamilyStudent,
    setActiveRole,
  } = useRole();
  const otherRoles = availableRoles.filter((role) => role !== "family");
  const [pendingRelationship, setPendingRelationship] = useState<string | null>(null);
  const [relationshipError, setRelationshipError] = useState(false);
  const selectionPending = useRef(false);
  const activeGuardian = familyContexts.find((context) =>
    context.relationshipId === selectedFamilyStudent?.relationshipId && context.relationshipType === "guardian",
  );

  const switchRole = async (role: SelectableUserRole) => {
    const changed = await setActiveRole(role);
    if (changed) router.replace("/" as never);
  };

  const switchRelationship = async (relationshipId: string, studentId: string) => {
    if (selectionPending.current || selectedFamilyStudent?.relationshipId === relationshipId) return;
    selectionPending.current = true;
    setPendingRelationship(relationshipId);
    setRelationshipError(false);
    try {
      const changed = await setActiveFamilyStudent(studentId);
      setRelationshipError(!changed);
    } catch {
      setRelationshipError(true);
    } finally {
      selectionPending.current = false;
      setPendingRelationship(null);
    }
  };

  return (
    <FamilyScreenShell title="Perfil" subtitle="Conta e vínculos familiares.">
      <ResponsiveGrid columns={{ compact: "1", split: "8/4" }} gap={layout.density.pageGap}>
        <View style={{ gap: metrics.gap }}>
          <FamilySurface title="Conta" padding={padding}>
            <Text style={{ color: colors.text, fontSize: metrics.bodyFontSize, fontWeight: "800" }}>
              {session?.user?.email ?? "Conta Go Atleta"}
            </Text>
          </FamilySurface>
          <FamilySurface title="Vínculos familiares" padding={padding}>
            {familyContexts.length ? familyContexts.map((context) => {
              const selected = context.relationshipId === selectedFamilyStudent?.relationshipId;
              const label = `${context.studentName}, ${context.relationshipLabel}, ${context.organizationName}`;
              return (
                <Pressable
                  key={context.relationshipId}
                  accessibilityRole="button"
                  accessibilityLabel={selected ? `${label}, vínculo em uso` : `Acompanhar ${label}`}
                  accessibilityState={{ selected, busy: pendingRelationship === context.relationshipId }}
                  aria-pressed={selected}
                  disabled={pendingRelationship !== null}
                  onPress={() => void switchRelationship(context.relationshipId, context.studentId)}
                  suppressWebHoverFeedback
                  disableWebPressScale
                  style={({ pressed, hovered }) => ({
                    minHeight: metrics.touchTarget,
                    flexDirection: "row",
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: selected ? colors.successBorder : colors.border,
                    borderRadius: radius.card,
                    padding: metrics.gap,
                    gap: metrics.gap,
                    backgroundColor: selected ? colors.successBg : pressed || hovered ? colors.secondaryBg : colors.card,
                  })}
                >
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={{ color: colors.text, fontSize: metrics.bodyFontSize, lineHeight: metrics.bodyLineHeight, fontWeight: "700" }}>
                      {context.studentName}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: metrics.metadataFontSize, lineHeight: metrics.metadataLineHeight }}>
                      {context.relationshipLabel} · {context.organizationName}
                    </Text>
                    {selected ? (
                      <Text style={{ color: colors.successText, fontSize: metrics.metadataFontSize, lineHeight: metrics.metadataLineHeight, fontWeight: "700" }}>
                        Em uso
                      </Text>
                    ) : null}
                  </View>
                  <GoAtletaIcon name={selected ? "checkmarkCircle" : "chevronRight"} size={metrics.iconSize} color={selected ? colors.successText : colors.muted} />
                </Pressable>
              );
            }) : (
              <Text style={{ color: colors.muted, fontSize: metrics.bodyFontSize, lineHeight: metrics.bodyLineHeight }}>
                Nenhum atleta vinculado. Peça um convite à instituição ou use a opção de vincular outro atleta.
              </Text>
            )}
            {relationshipError ? (
              <Text accessibilityRole="alert" style={{ color: colors.dangerText, fontSize: metrics.bodyFontSize }}>
                Não foi possível trocar de vínculo. Tente novamente.
              </Text>
            ) : null}
            {activeGuardian ? (
              <View style={{ borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: metrics.gap }}>
                <GuardianAthleteInvite
                  key={activeGuardian.relationshipId}
                  organizationId={activeGuardian.organizationId}
                  studentId={activeGuardian.studentId}
                />
              </View>
            ) : null}
          </FamilySurface>
        </View>
        <View style={{ gap: metrics.gap }}>
          {otherRoles.length ? (
            <FamilySurface title="Alternar perfil" padding={padding}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: metrics.smallGap }}>
                {otherRoles.map((role) => (
                  <FamilyButton key={role} label={roleLabel[role]} onPress={() => void switchRole(role)} />
                ))}
              </View>
            </FamilySurface>
          ) : null}
          <FamilySurface title="Ações da conta" padding={padding}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: metrics.smallGap }}>
              <FamilyButton label="Vincular outro atleta" onPress={() => router.push("/pending" as never)} />
              <FamilyButton label="Sair da conta" variant="danger" onPress={() => void signOut()} />
            </View>
          </FamilySurface>
        </View>
      </ResponsiveGrid>
    </FamilyScreenShell>
  );
}
