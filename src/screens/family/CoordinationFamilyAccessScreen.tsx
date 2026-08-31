import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import {
  createStudentRelationshipInvite,
  listStudentRelationshipInvites,
  listStudentRelationships,
  revokeStudentRelationshipInvite,
  revokeStudentRelationship,
  type StudentRelationship,
  type StudentRelationshipInvite,
  type StudentRelationshipKind,
  type StudentRelationshipPermissions,
} from "../../api/student-relationship-invite";
import {
  createTuitionAgreement,
  listTuitionPlans,
  type TuitionPlan,
} from "../../api/finance";
import { ResponsiveGrid } from "../../components/ui/ResponsiveGrid";
import { ResponsivePage } from "../../components/ui/ResponsivePage";
import { ScreenPageHeader } from "../../components/ui/ScreenPageHeader";
import type { Student } from "../../core/models";
import { getStudents } from "../../db/students";
import {
  normalizeRelationshipPermissions,
  permissionsForRelationshipKind,
  relationshipKindLabel,
} from "../../family/application/relationship-presets";
import { canManageFinanceFromFamilyAccess } from "../../finance/application/finance-permissions";
import { markRender, measureAsync } from "../../observability/perf";
import { useOrganization } from "../../providers/OrganizationProvider";
import { radius, spacing } from "../../theme/tokens";
import { Button } from "../../ui/Button";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon } from "../../ui/icon-registry";

const relationshipKinds: StudentRelationshipKind[] = [
  "guardian",
  "athlete",
  "payer",
  "viewer",
];

const permissionOptions: {
  key: keyof StudentRelationshipPermissions;
  label: string;
}[] = [
  { key: "canViewSchedule", label: "Agenda" },
  { key: "canViewAttendance", label: "Frequência" },
  { key: "canViewProgress", label: "Evolução" },
  { key: "canViewFinancial", label: "Financeiro" },
  { key: "canPay", label: "Pagar" },
];

const upcomingPermissionLabels = ["Saúde", "Consentimentos"] as const;

const todayDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

function AccessInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "default" | "email-address";
}) {
  const { colors } = useAppTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.text, fontSize: 12, fontWeight: "800" }}>
        {label}
      </Text>
      <View
        style={{
          minHeight: 50,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.inputBg,
          paddingHorizontal: 14,
          justifyContent: "center",
        }}
      >
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          keyboardType={keyboardType}
          autoCapitalize={
            keyboardType === "email-address" ? "none" : "sentences"
          }
          style={[
            {
              minHeight: 50,
              paddingVertical: 0,
              borderWidth: 0,
              borderRadius: 0,
              color: colors.inputText,
              backgroundColor: "transparent",
            },
            Platform.OS === "web" ? ({ outlineStyle: "none" } as never) : null,
          ]}
        />
      </View>
    </View>
  );
}

type CoordinationFamilyAccessScreenProps = {
  embedded?: boolean;
  onClose?: () => void;
};

export default function CoordinationFamilyAccessScreen({
  embedded = false,
  onClose,
}: CoordinationFamilyAccessScreenProps = {}) {
  markRender("screen.coordFamilyAccess.render.root");
  const router = useRouter();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { activeOrganization, memberPermissions, permissionsLoading } =
    useOrganization();
  const organizationId = activeOrganization?.id ?? "";
  const canManageFinance = canManageFinanceFromFamilyAccess({
    roleLevel: activeOrganization?.role_level ?? 0,
    canManageFinancial: memberPermissions.financial === true,
    permissionsLoading,
  });
  const [students, setStudents] = useState<Student[]>([]);
  const [plans, setPlans] = useState<TuitionPlan[]>([]);
  const [invites, setInvites] = useState<StudentRelationshipInvite[]>([]);
  const [relationships, setRelationships] = useState<StudentRelationship[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [query, setQuery] = useState("");
  const [email, setEmail] = useState("");
  const [kind, setKind] = useState<StudentRelationshipKind>("guardian");
  const [permissions, setPermissions] =
    useState<StudentRelationshipPermissions>(() =>
      permissionsForRelationshipKind("guardian"),
    );
  const [inviteUrl, setInviteUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const relationRequestRef = useRef(0);

  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedStudentId) ?? null,
    [selectedStudentId, students],
  );
  const filteredStudents = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    if (!normalized) return students.slice(0, 40);
    return students
      .filter((student) =>
        student.name.toLocaleLowerCase("pt-BR").includes(normalized),
      )
      .slice(0, 40);
  }, [query, students]);
  const listStyles = useMemo(
    () => ({
      studentOption: [styles.studentOption, { borderColor: colors.border }],
      selectedStudentOption: [
        styles.studentOption,
        {
          borderColor: colors.primaryBg,
          backgroundColor: colors.secondaryBg,
        },
      ],
      studentName: [styles.studentName, { color: colors.text }],
      selectedStudentName: [styles.selectedStudentName, { color: colors.text }],
      relationshipKind: [
        styles.relationshipKind,
        { borderColor: colors.border, backgroundColor: colors.card },
      ],
      selectedRelationshipKind: [
        styles.relationshipKind,
        {
          borderColor: colors.primaryBg,
          backgroundColor: colors.primaryBg,
        },
      ],
      relationshipKindText: [
        styles.relationshipKindText,
        { color: colors.text },
      ],
      selectedRelationshipKindText: [
        styles.relationshipKindText,
        { color: colors.primaryText },
      ],
      permission: [styles.permission, { borderColor: colors.border }],
      selectedPermission: [
        styles.permission,
        {
          borderColor: colors.successBg,
          backgroundColor: colors.secondaryBg,
        },
      ],
      permissionText: [styles.permissionText, { color: colors.text }],
      upcomingPermission: [
        styles.upcomingPermission,
        {
          borderColor: colors.border,
          backgroundColor: colors.secondaryBg,
        },
      ],
      upcomingPermissionText: [styles.permissionText, { color: colors.muted }],
      inviteRow: [styles.inviteRow, { borderTopColor: colors.border }],
      relationshipRow: [
        styles.relationshipRow,
        { borderTopColor: colors.border },
      ],
      itemTitle: [styles.itemTitle, { color: colors.text }],
      itemMeta: [styles.itemMeta, { color: colors.muted }],
      plan: [styles.plan, { borderColor: colors.border }],
      selectedPlan: [
        styles.plan,
        {
          borderColor: colors.primaryBg,
          backgroundColor: colors.primaryBg,
        },
      ],
      planText: [styles.planText, { color: colors.text }],
      selectedPlanText: [styles.planText, { color: colors.primaryText }],
    }),
    [
      colors.border,
      colors.card,
      colors.muted,
      colors.primaryBg,
      colors.primaryText,
      colors.secondaryBg,
      colors.successBg,
      colors.text,
    ],
  );

  /* eslint-disable react-hooks/set-state-in-effect -- These effects synchronize the selected organization and athlete with remote access data. */
  useEffect(() => {
    let active = true;
    if (!organizationId) {
      setLoading(false);
      return () => {
        active = false;
      };
    }
    setLoading(true);
    void measureAsync(
      "screen.coordFamilyAccess.load.directory",
      () =>
        Promise.all([
          getStudents({ organizationId }),
          canManageFinance
            ? listTuitionPlans(organizationId).catch(() => [])
            : Promise.resolve([] as TuitionPlan[]),
        ]),
      { organizationId },
    )
      .then(([studentRows, planRows]) => {
        if (!active) return;
        setStudents(studentRows);
        setPlans(planRows.filter((plan) => plan.active));
        setSelectedStudentId((current) => current || studentRows[0]?.id || "");
        setSelectedPlanId(
          (current) =>
            current || planRows.find((plan) => plan.active)?.id || "",
        );
      })
      .catch(() => {
        if (active) setMessage("Não foi possível carregar os atletas.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [canManageFinance, organizationId]);

  const loadRelationships = useCallback(async () => {
    const request = relationRequestRef.current + 1;
    relationRequestRef.current = request;
    if (!organizationId || !selectedStudentId) {
      setInvites([]);
      setRelationships([]);
      return;
    }
    try {
      const [relationshipRows, inviteRows] = await measureAsync(
        "screen.coordFamilyAccess.load.relationships",
        () =>
          Promise.all([
            listStudentRelationships(organizationId, selectedStudentId),
            listStudentRelationshipInvites(organizationId, selectedStudentId),
          ]),
        { organizationId, studentId: selectedStudentId },
      );
      if (request === relationRequestRef.current) {
        setRelationships(relationshipRows);
        setInvites(inviteRows);
      }
    } catch {
      if (request === relationRequestRef.current) {
        setRelationships([]);
        setInvites([]);
      }
    }
  }, [organizationId, selectedStudentId]);

  useEffect(() => {
    void loadRelationships();
  }, [loadRelationships]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const changeKind = (nextKind: StudentRelationshipKind) => {
    setKind(nextKind);
    setPermissions(permissionsForRelationshipKind(nextKind));
    setInviteUrl("");
    setMessage("");
  };

  const togglePermission = (key: keyof StudentRelationshipPermissions) => {
    setPermissions((current) =>
      normalizeRelationshipPermissions({ ...current, [key]: !current[key] }),
    );
  };

  const handleCreateInvite = async () => {
    if (!organizationId || !selectedStudentId || busy) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setMessage("Informe o e-mail que usará o convite.");
      return;
    }
    setBusy(true);
    setMessage("");
    setInviteUrl("");
    try {
      const result = await createStudentRelationshipInvite({
        organizationId,
        studentId: selectedStudentId,
        invitedEmail: normalizedEmail,
        relationshipKind: kind,
        relationshipLabel: relationshipKindLabel[kind],
        invitedVia: "link",
        permissions: normalizeRelationshipPermissions(permissions),
      });
      setInviteUrl(result.inviteUrl);
      setMessage("Link criado. Envie somente para o e-mail informado.");
      await loadRelationships();
    } catch {
      setMessage(
        "Não foi possível criar o convite. Confira se já existe um vínculo pendente.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRevokeInvite = async (invite: StudentRelationshipInvite) => {
    if (
      !organizationId ||
      !selectedStudentId ||
      busy ||
      invite.status !== "pending"
    )
      return;
    setBusy(true);
    setMessage("");
    try {
      const rows = await revokeStudentRelationshipInvite({
        organizationId,
        studentId: selectedStudentId,
        inviteId: invite.id,
        reason: "revoked_by_coordination",
      });
      setInvites(rows);
      setMessage("Convite cancelado.");
    } catch {
      setMessage("Não foi possível cancelar o convite.");
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    if (!inviteUrl) return;
    await Clipboard.setStringAsync(inviteUrl);
    setMessage("Link copiado.");
  };

  const handleShare = async () => {
    if (!inviteUrl) return;
    await Share.share({
      message: `Convite Go Atleta para ${selectedStudent?.name ?? "o atleta"}: ${inviteUrl}`,
    });
  };

  const handleRevoke = async (relationship: StudentRelationship) => {
    if (!organizationId || !selectedStudentId || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const rows = await revokeStudentRelationship({
        organizationId,
        studentId: selectedStudentId,
        relationshipId: relationship.id,
        reason: "revoked_by_coordination",
        clearLegacyLoginEmail: relationship.kind === "athlete",
      });
      setRelationships(rows);
      setMessage("Acesso revogado.");
    } catch {
      setMessage("Não foi possível revogar o acesso.");
    } finally {
      setBusy(false);
    }
  };

  const handleCreateAgreement = async (relationship: StudentRelationship) => {
    if (
      !canManageFinance ||
      !organizationId ||
      !selectedStudentId ||
      !selectedPlanId ||
      busy
    )
      return;
    setBusy(true);
    setMessage("");
    try {
      await createTuitionAgreement({
        organizationId,
        studentId: selectedStudentId,
        planId: selectedPlanId,
        payerRelationshipId: relationship.id,
        startsOn: todayDate(),
        idempotencyKey: `agreement:${selectedStudentId}:${selectedPlanId}:${relationship.id}`,
      });
      setMessage("Mensalidade vinculada ao responsável.");
    } catch {
      setMessage(
        "Não foi possível vincular. Verifique se o atleta já possui um plano ativo.",
      );
    } finally {
      setBusy(false);
    }
  };
  const handleStandaloneBack = useCallback(() => {
    router.replace("/coord/management" as never);
  }, [router]);

  return (
    <SafeAreaView
      edges={embedded ? [] : ["top"]}
      style={{
        flex: 1,
        minHeight: 0,
        backgroundColor: embedded ? colors.card : colors.background,
      }}
    >
      <ScrollView
        style={{ flex: 1, minHeight: 0 }}
        contentContainerStyle={{
          paddingBottom: embedded ? spacing.md : insets.bottom + 84,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <ResponsivePage variant="dashboard" gap={spacing.md}>
          <ScreenPageHeader
            title="Acessos familiares"
            subtitle="Responsáveis, atletas e pagadores"
            onBack={onClose ?? handleStandaloneBack}
            horizontalBleed={0}
          />

          {message ? (
            <Pressable
              accessibilityRole="alert"
              onPress={() => setMessage("")}
              style={{
                borderRadius: radius.container,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                padding: spacing.md,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "800" }}>
                {message}
              </Text>
            </Pressable>
          ) : null}

          <ResponsiveGrid
            columns={{ compact: "1", split: "4/8" }}
            gap={spacing.md}
          >
            <View
              style={{
                borderRadius: radius.container,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                padding: spacing.md,
                gap: spacing.sm,
              }}
            >
              <Text
                style={{ color: colors.text, fontSize: 16, fontWeight: "900" }}
              >
                1. Escolha o atleta
              </Text>
              <AccessInput
                label="Buscar"
                value={query}
                onChangeText={setQuery}
                placeholder="Nome do atleta"
              />
              <View style={{ maxHeight: 420, gap: 6 }}>
                {loading ? (
                  <Text style={{ color: colors.muted }}>Carregando...</Text>
                ) : null}
                {filteredStudents.map((student) => {
                  const selected = student.id === selectedStudentId;
                  return (
                    <Pressable
                      key={student.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => {
                        setSelectedStudentId(student.id);
                        setInviteUrl("");
                        setMessage("");
                      }}
                      style={
                        selected
                          ? listStyles.selectedStudentOption
                          : listStyles.studentOption
                      }
                    >
                      <Text
                        numberOfLines={1}
                        style={
                          selected
                            ? listStyles.selectedStudentName
                            : listStyles.studentName
                        }
                      >
                        {student.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={{ gap: spacing.md }}>
              <View
                style={{
                  borderRadius: radius.container,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  padding: spacing.md,
                  gap: spacing.sm,
                }}
              >
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 16,
                    fontWeight: "900",
                  }}
                >
                  2. Defina o vínculo
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {selectedStudent?.name ?? "Selecione um atleta"}
                </Text>
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}
                >
                  {relationshipKinds.map((option) => {
                    const selected = kind === option;
                    return (
                      <Pressable
                        key={option}
                        onPress={() => changeKind(option)}
                        style={
                          selected
                            ? listStyles.selectedRelationshipKind
                            : listStyles.relationshipKind
                        }
                      >
                        <Text
                          style={
                            selected
                              ? listStyles.selectedRelationshipKindText
                              : listStyles.relationshipKindText
                          }
                        >
                          {relationshipKindLabel[option]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <AccessInput
                  label="E-mail do convidado"
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    setInviteUrl("");
                  }}
                  placeholder="responsavel@exemplo.com"
                  keyboardType="email-address"
                />
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 12,
                    fontWeight: "800",
                  }}
                >
                  Acessos do convite
                </Text>
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}
                >
                  {permissionOptions.map((option) => {
                    const selected = permissions[option.key];
                    return (
                      <Pressable
                        key={option.key}
                        onPress={() => togglePermission(option.key)}
                        style={
                          selected
                            ? listStyles.selectedPermission
                            : listStyles.permission
                        }
                      >
                        <GoAtletaIcon
                          name={selected ? "checkmark" : "circleOutline"}
                          size={14}
                          color={selected ? colors.success : colors.muted}
                        />
                        <Text style={listStyles.permissionText}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                  {upcomingPermissionLabels.map((label) => (
                    <View
                      key={label}
                      accessibilityLabel={`${label}, em breve`}
                      style={listStyles.upcomingPermission}
                    >
                      <GoAtletaIcon
                        name="lock"
                        size={14}
                        color={colors.muted}
                      />
                      <Text style={listStyles.upcomingPermissionText}>
                        {label} · Em breve
                      </Text>
                    </View>
                  ))}
                </View>
                <Button
                  label="Criar link de acesso"
                  loading={busy}
                  loadingLabel="Criando..."
                  disabled={!selectedStudentId || !email.trim()}
                  onPress={() => void handleCreateInvite()}
                />
                {inviteUrl ? (
                  <View
                    style={{
                      borderRadius: radius.card,
                      borderWidth: 1,
                      borderColor: colors.successBg,
                      backgroundColor: colors.secondaryBg,
                      padding: spacing.sm,
                      gap: 9,
                    }}
                  >
                    <Text
                      selectable
                      numberOfLines={3}
                      style={{ color: colors.text, fontSize: 12 }}
                    >
                      {inviteUrl}
                    </Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Button
                          label="Copiar"
                          variant="outline"
                          onPress={() => void handleCopy()}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Button
                          label="Compartilhar"
                          variant="outline"
                          onPress={() => void handleShare()}
                        />
                      </View>
                    </View>
                  </View>
                ) : null}
              </View>

              <View
                style={{
                  borderRadius: radius.container,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  padding: spacing.md,
                  gap: spacing.sm,
                }}
              >
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 16,
                    fontWeight: "900",
                  }}
                >
                  Convites enviados
                </Text>
                {invites.length === 0 ? (
                  <Text style={{ color: colors.muted, fontSize: 13 }}>
                    Nenhum convite para este atleta.
                  </Text>
                ) : null}
                {invites.slice(0, 12).map((invite) => (
                  <View key={invite.id} style={listStyles.inviteRow}>
                    <View style={styles.inviteContent}>
                      <Text numberOfLines={1} style={listStyles.itemTitle}>
                        {invite.invitedEmail}
                      </Text>
                      <Text style={listStyles.itemMeta}>
                        {relationshipKindLabel[invite.relationshipKind]} ·{" "}
                        {invite.status === "pending"
                          ? "aguardando aceite"
                          : invite.status === "claimed"
                            ? "aceito"
                            : invite.status === "expired"
                              ? "expirado"
                              : "cancelado"}
                      </Text>
                    </View>
                    {invite.status === "pending" ? (
                      <Button
                        label="Cancelar"
                        variant="danger"
                        disabled={busy}
                        onPress={() => void handleRevokeInvite(invite)}
                      />
                    ) : null}
                  </View>
                ))}
              </View>

              <View
                style={{
                  borderRadius: radius.container,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  padding: spacing.md,
                  gap: spacing.sm,
                }}
              >
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 16,
                    fontWeight: "900",
                  }}
                >
                  Vínculos aceitos
                </Text>
                {!permissionsLoading && !canManageFinance ? (
                  <View
                    accessible
                    accessibilityLabel="Permissão Financeiro necessária para vincular mensalidades"
                    style={{
                      borderRadius: radius.card,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.secondaryBg,
                      padding: spacing.sm,
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: 8,
                    }}
                  >
                    <GoAtletaIcon name="lock" size={16} color={colors.muted} />
                    <Text
                      style={{
                        flex: 1,
                        color: colors.muted,
                        fontSize: 12,
                        lineHeight: 18,
                      }}
                    >
                      Convites continuam disponíveis. Vincular mensalidades
                      exige a permissão Financeiro.
                    </Text>
                  </View>
                ) : null}
                {relationships.length === 0 ? (
                  <Text style={{ color: colors.muted, fontSize: 13 }}>
                    Nenhum acesso aceito para este atleta.
                  </Text>
                ) : null}
                {relationships.map((relationship) => (
                  <View
                    key={relationship.id}
                    style={listStyles.relationshipRow}
                  >
                    <View style={styles.relationshipHeader}>
                      <View style={styles.relationshipContent}>
                        <Text numberOfLines={1} style={listStyles.itemTitle}>
                          {relationship.contactEmail || "Conta removida"}
                        </Text>
                        <Text style={listStyles.itemMeta}>
                          {relationshipKindLabel[relationship.kind]} ·{" "}
                          {relationship.status === "active"
                            ? "ativo"
                            : "revogado"}
                        </Text>
                      </View>
                      {relationship.status === "active" ? (
                        <Button
                          label="Revogar"
                          variant="danger"
                          disabled={busy}
                          onPress={() => void handleRevoke(relationship)}
                        />
                      ) : null}
                    </View>
                    {relationship.status === "active" &&
                    relationship.canPay &&
                    canManageFinance ? (
                      <View style={{ gap: 7 }}>
                        <View
                          style={{
                            flexDirection: "row",
                            flexWrap: "wrap",
                            gap: 6,
                          }}
                        >
                          {plans.map((plan) => {
                            const selected = selectedPlanId === plan.id;
                            return (
                              <Pressable
                                key={plan.id}
                                onPress={() => setSelectedPlanId(plan.id)}
                                style={
                                  selected
                                    ? listStyles.selectedPlan
                                    : listStyles.plan
                                }
                              >
                                <Text
                                  style={
                                    selected
                                      ? listStyles.selectedPlanText
                                      : listStyles.planText
                                  }
                                >
                                  {plan.name}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                        <Button
                          label="Vincular mensalidade"
                          variant="outline"
                          disabled={!selectedPlanId || busy}
                          onPress={() =>
                            void handleCreateAgreement(relationship)
                          }
                        />
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            </View>
          </ResponsiveGrid>
        </ResponsivePage>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  studentOption: {
    minHeight: 44,
    borderRadius: radius.card,
    borderWidth: 1,
    backgroundColor: "transparent",
    paddingHorizontal: 11,
    justifyContent: "center",
  },
  studentName: {
    fontWeight: "700",
  },
  selectedStudentName: {
    fontWeight: "900",
  },
  relationshipKind: {
    minHeight: 38,
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  relationshipKindText: {
    fontSize: 12,
    fontWeight: "800",
  },
  permission: {
    minHeight: 36,
    borderRadius: radius.card,
    borderWidth: 1,
    backgroundColor: "transparent",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  upcomingPermission: {
    minHeight: 36,
    borderRadius: radius.card,
    borderWidth: 1,
    opacity: 0.72,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  permissionText: {
    fontSize: 12,
    fontWeight: "700",
  },
  inviteRow: {
    minHeight: 62,
    borderTopWidth: 1,
    paddingTop: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  inviteContent: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  relationshipRow: {
    minHeight: 72,
    borderTopWidth: 1,
    paddingTop: 11,
    gap: 8,
  },
  relationshipHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  relationshipContent: {
    flex: 1,
    minWidth: 0,
  },
  itemTitle: {
    fontWeight: "800",
  },
  itemMeta: {
    fontSize: 12,
  },
  plan: {
    minHeight: 34,
    borderRadius: radius.full,
    borderWidth: 1,
    backgroundColor: "transparent",
    paddingHorizontal: 9,
    justifyContent: "center",
  },
  planText: {
    fontSize: 11,
    fontWeight: "800",
  },
});
