import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  adminListOrgMembers,
  adminUpdateMemberRole,
  OrgMember,
} from "../src/api/members";
import {
  AdminPendingAttendance,
  AdminPendingSessionLogs,
  AdminRecentActivity,
  listAdminPendingAttendance,
  listAdminPendingSessionLogs,
  listAdminRecentActivity,
} from "../src/api/reports";
import { useOrganization } from "../src/providers/OrganizationProvider";
import { Pressable } from "../src/ui/Pressable";
import { useAppTheme } from "../src/ui/app-theme";

type CoordinationTab = "dashboard" | "members";
type RoleLevel = 5 | 10 | 50;

const ROLE_OPTIONS: { label: string; value: RoleLevel }[] = [
  { label: "Coordenação", value: 50 },
  { label: "Professor", value: 10 },
  { label: "Estagiário", value: 5 },
];

const formatDateBr = (value: string | null | undefined) => {
  if (!value) return "-";
  const datePart = value.includes("T") ? value.split("T")[0] : value;
  const parts = datePart.split("-");
  if (parts.length !== 3) return value;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const formatDateTimeBr = (value: string | null | undefined) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const roleLabel = (roleLevel: number) => {
  if (roleLevel >= 50) return "Coordenação";
  if (roleLevel >= 10) return "Professor";
  return "Estagiário";
};

const shortUserId = (value: string | null | undefined) => {
  if (!value) return "Sistema";
  return value.length > 8 ? `${value.slice(0, 8)}...` : value;
};

const parseRpcErrorMessage = (err: unknown) => {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  try {
    const parsed = JSON.parse(raw) as { message?: string; error?: string };
    return parsed.message || parsed.error || raw;
  } catch {
    return raw;
  }
};

const humanizeRoleError = (message: string) => {
  if (message.includes("Member has responsible classes")) {
    return "Este membro ainda é responsável por turmas. Reatribua as turmas antes de alterar o cargo.";
  }
  if (message.includes("Cannot demote last admin")) {
    return "Não é possível rebaixar o último admin da organização.";
  }
  if (message.includes("Not authorized")) {
    return "Você não tem permissão para alterar cargos nesta organização.";
  }
  if (message.includes("Member not found")) {
    return "Membro não encontrado.";
  }
  if (message.includes("Invalid role_level")) {
    return "Cargo inválido.";
  }
  return message || "Não foi possível atualizar o cargo.";
};

export default function CoordinationScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { activeOrganization } = useOrganization();
  const isAdmin = (activeOrganization?.role_level ?? 0) >= 50;
  const organizationId = activeOrganization?.id ?? null;

  const [activeTab, setActiveTab] = useState<CoordinationTab>("dashboard");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [roleBusyUserId, setRoleBusyUserId] = useState<string | null>(null);
  const [pendingAttendance, setPendingAttendance] = useState<AdminPendingAttendance[]>([]);
  const [pendingReports, setPendingReports] = useState<AdminPendingSessionLogs[]>([]);
  const [recentActivity, setRecentActivity] = useState<AdminRecentActivity[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);

  const tabItems = useMemo(
    () => [
      { id: "dashboard" as const, label: "Dashboard" },
      { id: "members" as const, label: "Gerenciar membros" },
    ],
    []
  );

  const loadCoordinationData = useCallback(async () => {
    if (!organizationId || !isAdmin) {
      setPendingAttendance([]);
      setPendingReports([]);
      setRecentActivity([]);
      setMembers([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setRoleError(null);
    try {
      const [attendanceRows, reportRows, activityRows, memberRows] = await Promise.all([
        listAdminPendingAttendance({ organizationId }),
        listAdminPendingSessionLogs({ organizationId }),
        listAdminRecentActivity({ organizationId, limit: 12 }),
        adminListOrgMembers(organizationId),
      ]);
      setPendingAttendance(attendanceRows);
      setPendingReports(reportRows);
      setRecentActivity(activityRows);
      setMembers(memberRows);
    } catch (err) {
      setPendingAttendance([]);
      setPendingReports([]);
      setRecentActivity([]);
      setMembers([]);
      setError(err instanceof Error ? err.message : "Falha ao carregar dados da coordenação.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, organizationId]);

  useFocusEffect(
    useCallback(() => {
      void loadCoordinationData();
    }, [loadCoordinationData])
  );

  const memberStats = useMemo(() => {
    const coordination = members.filter((member) => member.roleLevel >= 50).length;
    const professor = members.filter((member) => member.roleLevel >= 10 && member.roleLevel < 50).length;
    const intern = members.filter((member) => member.roleLevel < 10).length;
    return {
      total: members.length,
      coordination,
      professor,
      intern,
    };
  }, [members]);

  const sortedMembers = useMemo(() => {
    return members
      .slice()
      .sort((a, b) => b.roleLevel - a.roleLevel || a.displayName.localeCompare(b.displayName));
  }, [members]);

  const handleRoleChange = useCallback(
    async (member: OrgMember, nextRole: RoleLevel) => {
      if (!organizationId) return;
      if (member.roleLevel === nextRole) return;

      setRoleError(null);
      setRoleBusyUserId(member.userId);
      try {
        await adminUpdateMemberRole(organizationId, member.userId, nextRole);
        setMembers((current) =>
          current.map((item) =>
            item.userId === member.userId ? { ...item, roleLevel: nextRole } : item
          )
        );
      } catch (err) {
        setRoleError(humanizeRoleError(parseRpcErrorMessage(err)));
      } finally {
        setRoleBusyUserId(null);
      }
    },
    [organizationId]
  );

  if (!isAdmin) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, padding: 16 }}>
          <View
            style={{
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              padding: 14,
              gap: 8,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>
              Coordenação
            </Text>
            <Text style={{ color: colors.muted }}>
              Você não tem acesso a esta área.
            </Text>
            <Pressable
              onPress={() => router.replace("/")}
              style={{
                alignSelf: "flex-start",
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.secondaryBg,
                paddingHorizontal: 12,
                paddingVertical: 8,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700" }}>Voltar</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 12 }}>
        <View style={{ gap: 4 }}>
          <Text style={{ color: colors.text, fontSize: 30, fontWeight: "800" }}>
            Coordenação
          </Text>
          <Text style={{ color: colors.muted }}>
            Dashboard e gestão de membros da organização
            {activeOrganization?.name ? ` • ${activeOrganization.name}` : ""}.
          </Text>
        </View>

        <View
          style={{
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            padding: 8,
            gap: 8,
          }}
        >
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {tabItems.map((tab) => {
              const selected = activeTab === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => setActiveTab(tab.id)}
                  style={{
                    flexGrow: 1,
                    minWidth: 130,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: selected ? colors.primaryBg : colors.secondaryBg,
                  }}
                >
                  <Text
                    style={{
                      color: selected ? colors.primaryText : colors.text,
                      fontWeight: "700",
                      fontSize: 13,
                      textAlign: "center",
                    }}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {error ? (
          <View
            style={{
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              padding: 12,
            }}
          >
            <Text style={{ color: colors.dangerSolidBg, fontWeight: "700" }}>Erro</Text>
            <Text style={{ color: colors.muted, marginTop: 4 }}>{error}</Text>
          </View>
        ) : null}

        {activeTab === "dashboard" ? (
          <View style={{ gap: 10 }}>
            <View
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                padding: 14,
                gap: 10,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>
                Indicadores
              </Text>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                <View
                  style={{
                    minWidth: 120,
                    flexGrow: 1,
                    padding: 10,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.secondaryBg,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>
                    {loading ? "..." : pendingAttendance.length}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>Chamada pendente</Text>
                </View>
                <View
                  style={{
                    minWidth: 120,
                    flexGrow: 1,
                    padding: 10,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.secondaryBg,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>
                    {loading ? "..." : pendingReports.length}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>Relatórios pendentes</Text>
                </View>
                <View
                  style={{
                    minWidth: 120,
                    flexGrow: 1,
                    padding: 10,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.secondaryBg,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>
                    {loading ? "..." : recentActivity.length}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>Atividade (7d)</Text>
                </View>
              </View>
            </View>

            <View
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                padding: 14,
                gap: 10,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
                Chamadas pendentes
              </Text>
              {loading ? (
                <Text style={{ color: colors.muted }}>Carregando...</Text>
              ) : pendingAttendance.length === 0 ? (
                <Text style={{ color: colors.muted }}>Nenhuma turma com chamada pendente.</Text>
              ) : (
                pendingAttendance.slice(0, 6).map((item) => (
                  <Pressable
                    key={`${item.classId}_${item.targetDate}`}
                    onPress={() =>
                      router.push({
                        pathname: "/class/[id]/attendance",
                        params: { id: item.classId, date: item.targetDate },
                      })
                    }
                    style={{
                      padding: 10,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.secondaryBg,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "700" }}>{item.className}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      {item.unit || "Sem unidade"} • {item.studentCount} alunos • {formatDateBr(item.targetDate)}
                    </Text>
                  </Pressable>
                ))
              )}
            </View>

            <View
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                padding: 14,
                gap: 10,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
                Relatórios pendentes
              </Text>
              {loading ? (
                <Text style={{ color: colors.muted }}>Carregando...</Text>
              ) : pendingReports.length === 0 ? (
                <Text style={{ color: colors.muted }}>Nenhuma turma sem relatório recente.</Text>
              ) : (
                pendingReports.slice(0, 6).map((item) => (
                  <Pressable
                    key={`${item.classId}_${item.periodStart}`}
                    onPress={() =>
                      router.push({
                        pathname: "/class/[id]/session",
                        params: { id: item.classId, tab: "relatório" },
                      })
                    }
                    style={{
                      padding: 10,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.secondaryBg,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "700" }}>{item.className}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      {item.unit || "Sem unidade"} • Último: {formatDateTimeBr(item.lastReportAt)}
                    </Text>
                  </Pressable>
                ))
              )}
            </View>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <View
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                padding: 14,
                gap: 10,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>
                Membros da organização
              </Text>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                <View
                  style={{
                    minWidth: 120,
                    flexGrow: 1,
                    padding: 10,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.secondaryBg,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>
                    {loading ? "..." : memberStats.coordination}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>Coordenação</Text>
                </View>
                <View
                  style={{
                    minWidth: 120,
                    flexGrow: 1,
                    padding: 10,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.secondaryBg,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>
                    {loading ? "..." : memberStats.professor}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>Professor</Text>
                </View>
                <View
                  style={{
                    minWidth: 120,
                    flexGrow: 1,
                    padding: 10,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.secondaryBg,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>
                    {loading ? "..." : memberStats.intern}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>Estagiário</Text>
                </View>
                <View
                  style={{
                    minWidth: 120,
                    flexGrow: 1,
                    padding: 10,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.secondaryBg,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>
                    {loading ? "..." : memberStats.total}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>Total</Text>
                </View>
              </View>
            </View>

            {roleError ? (
              <View
                style={{
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  padding: 12,
                }}
              >
                <Text style={{ color: colors.dangerSolidBg, fontWeight: "700" }}>Erro</Text>
                <Text style={{ color: colors.muted, marginTop: 4 }}>{roleError}</Text>
              </View>
            ) : null}

            <View
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                padding: 14,
                gap: 10,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
                Lista de membros
              </Text>
              {loading ? (
                <Text style={{ color: colors.muted }}>Carregando...</Text>
              ) : sortedMembers.length === 0 ? (
                <Text style={{ color: colors.muted }}>Nenhum membro encontrado.</Text>
              ) : (
                sortedMembers.map((member) => {
                  const isUpdatingRole = roleBusyUserId === member.userId;
                  return (
                    <View
                      key={member.userId}
                      style={{
                        padding: 10,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.secondaryBg,
                        gap: 8,
                      }}
                    >
                      <View style={{ gap: 3 }}>
                        <Text style={{ color: colors.text, fontWeight: "700" }}>{member.displayName}</Text>
                        <Text style={{ color: colors.muted, fontSize: 12 }}>
                          {member.email || member.userId}
                        </Text>
                      </View>

                      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                        {ROLE_OPTIONS.map((option) => {
                          const selected = member.roleLevel === option.value;
                          return (
                            <Pressable
                              key={`${member.userId}_${option.value}`}
                              onPress={() => void handleRoleChange(member, option.value)}
                              disabled={isUpdatingRole || selected}
                              style={{
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: 999,
                                borderWidth: 1,
                                borderColor: selected ? colors.primaryBg : colors.border,
                                backgroundColor: selected ? colors.primaryBg : colors.card,
                                opacity: isUpdatingRole && !selected ? 0.6 : 1,
                              }}
                            >
                              <Text
                                style={{
                                  color: selected ? colors.primaryText : colors.text,
                                  fontSize: 12,
                                  fontWeight: "700",
                                }}
                              >
                                {option.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>

                      <Text style={{ color: colors.muted, fontSize: 12 }}>
                        Cargo atual: {roleLabel(member.roleLevel)}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>

            <View
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                padding: 14,
                gap: 10,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
                Atividade recente
              </Text>
              {loading ? (
                <Text style={{ color: colors.muted }}>Carregando...</Text>
              ) : recentActivity.length === 0 ? (
                <Text style={{ color: colors.muted }}>Sem atividade recente.</Text>
              ) : (
                recentActivity.slice(0, 8).map((activity, index) => (
                  <View
                    key={`${activity.kind}_${activity.classId}_${activity.occurredAt}_${index}`}
                    style={{
                      padding: 10,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.secondaryBg,
                      gap: 4,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "700" }}>
                      {activity.kind === "attendance" ? "Chamada" : "Relatório"} • {activity.className}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      {activity.unit || "Sem unidade"} • {formatDateTimeBr(activity.occurredAt)}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      Responsável: {shortUserId(activity.actorUserId)} • Registros: {activity.affectedRows}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
