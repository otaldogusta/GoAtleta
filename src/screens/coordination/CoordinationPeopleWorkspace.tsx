import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, Text, TextInput, useWindowDimensions, View } from "react-native";

import type { MemberClassHead, OrgMember } from "../../api/members";
import type { AdminPendingAttendance, AdminPendingSessionLogs } from "../../api/reports";
import type { TrainerInviteItem } from "../../api/trainer-invite";
import { radius } from "../../theme/tokens";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon, type GoAtletaIconName } from "../../ui/icon-registry";
import { Pressable } from "../../ui/Pressable";

type SecondaryModuleKey = "attendance" | "classes" | "access" | "reports" | "sync";
type RoleFilter = "all" | "coordination" | "professor" | "intern";
type StatusFilter = "all" | "active" | "pending";

type CoordinationPeopleWorkspaceProps = {
  organizationId: string;
  organizationName: string;
  loading: boolean;
  healthScore: number | null;
  members: OrgMember[];
  memberClassHeads: MemberClassHead[];
  pendingInvites: TrainerInviteItem[];
  pendingAttendance: AdminPendingAttendance[];
  pendingReports: AdminPendingSessionLogs[];
  syncHealthy: boolean;
  notifySending: boolean;
  onInvite: () => void;
  onEditMember: (member: OrgMember) => void;
  onOpenAttendance: (item: AdminPendingAttendance) => void;
  onNotifyAttendance: (item: AdminPendingAttendance, member: OrgMember) => void;
};

const DEFAULT_MODULE_ORDER: SecondaryModuleKey[] = [
  "attendance",
  "classes",
  "access",
  "reports",
  "sync",
];

const moduleIcon: Record<SecondaryModuleKey, GoAtletaIconName> = {
  attendance: "attendance",
  classes: "members",
  access: "communications",
  reports: "document",
  sync: "sync",
};

const roleLabel = (roleLevel: number) => {
  if (roleLevel >= 50) return "Coordenação";
  if (roleLevel >= 10) return "Professor";
  return "Estagiário";
};

const initials = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "US";

const cycleRole = (current: RoleFilter): RoleFilter =>
  current === "all"
    ? "coordination"
    : current === "coordination"
      ? "professor"
      : current === "professor"
        ? "intern"
        : "all";

const cycleStatus = (current: StatusFilter): StatusFilter =>
  current === "all" ? "active" : current === "active" ? "pending" : "all";

export function CoordinationPeopleWorkspace({
  organizationId,
  organizationName,
  loading,
  healthScore,
  members,
  memberClassHeads,
  pendingInvites,
  pendingAttendance,
  pendingReports,
  syncHealthy,
  notifySending,
  onInvite,
  onEditMember,
  onOpenAttendance,
  onNotifyAttendance,
}: CoordinationPeopleWorkspaceProps) {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === "web" && width >= 1180;
  const compact = width < 760;
  const storageKey = `coordination_workspace_order_v1:${organizationId}`;

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [peopleExpanded, setPeopleExpanded] = useState(true);
  const [organizing, setOrganizing] = useState(false);
  const [messageReady, setMessageReady] = useState(false);
  const [showAllAttendance, setShowAllAttendance] = useState(false);
  const [moduleOrder, setModuleOrder] = useState(DEFAULT_MODULE_ORDER);
  const [expandedModules, setExpandedModules] = useState<
    Partial<Record<SecondaryModuleKey, boolean>>
  >({});

  useEffect(() => {
    void AsyncStorage.getItem(storageKey).then((stored) => {
      if (!stored) return;
      try {
        const parsed = JSON.parse(stored) as SecondaryModuleKey[];
        if (
          parsed.length === DEFAULT_MODULE_ORDER.length &&
          DEFAULT_MODULE_ORDER.every((key) => parsed.includes(key))
        ) {
          setModuleOrder(parsed);
        }
      } catch {
        // A ordem padrão é mantida quando a preferência local está inválida.
      }
    });
  }, [storageKey]);

  useEffect(() => {
    if (selectedMemberId && members.some((member) => member.userId === selectedMemberId)) return;
    setSelectedMemberId(members[0]?.userId ?? null);
  }, [members, selectedMemberId]);

  useEffect(() => {
    setShowAllAttendance(false);
    setMessageReady(false);
  }, [selectedMemberId]);

  const classesByUser = useMemo(() => {
    const result = new Map<string, MemberClassHead[]>();
    memberClassHeads.forEach((head) => {
      result.set(head.userId, [...(result.get(head.userId) ?? []), head]);
    });
    return result;
  }, [memberClassHeads]);

  const attendanceByClass = useMemo(
    () => new Map(pendingAttendance.map((item) => [item.classId, item])),
    [pendingAttendance]
  );

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return members.filter((member) => {
      const roleMatches =
        roleFilter === "all" ||
        (roleFilter === "coordination" && member.roleLevel >= 50) ||
        (roleFilter === "professor" && member.roleLevel >= 10 && member.roleLevel < 50) ||
        (roleFilter === "intern" && member.roleLevel < 10);
      const statusMatches = statusFilter !== "pending";
      const queryMatches =
        !query ||
        `${member.displayName} ${member.email ?? ""} ${roleLabel(member.roleLevel)}`
          .toLowerCase()
          .includes(query);
      return roleMatches && statusMatches && queryMatches;
    });
  }, [members, roleFilter, search, statusFilter]);

  const filteredInvites = useMemo(() => {
    if (statusFilter === "active" || roleFilter !== "all") return [];
    const query = search.trim().toLowerCase();
    return pendingInvites.filter(
      (invite) =>
        !query || (invite.invited_to ?? "convite pendente").toLowerCase().includes(query)
    );
  }, [pendingInvites, roleFilter, search, statusFilter]);

  const selectedMember =
    members.find((member) => member.userId === selectedMemberId) ?? members[0] ?? null;
  const selectedClasses = selectedMember
    ? classesByUser.get(selectedMember.userId) ?? []
    : [];
  const selectedAttendance = selectedClasses
    .map((head) => attendanceByClass.get(head.classId))
    .filter((item): item is AdminPendingAttendance => Boolean(item));

  const moveModule = useCallback(
    (key: SecondaryModuleKey, direction: -1 | 1) => {
      setModuleOrder((current) => {
        const index = current.indexOf(key);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= current.length) return current;
        const next = [...current];
        [next[index], next[target]] = [next[target], next[index]];
        void AsyncStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
    },
    [storageKey]
  );

  const uniqueClasses = new Set(memberClassHeads.map((item) => item.classId)).size;
  const moduleMeta: Record<SecondaryModuleKey, { label: string; value: string | number }> = {
    attendance: { label: "Chamadas pendentes", value: pendingAttendance.length },
    classes: { label: "Turmas monitoradas", value: uniqueClasses },
    access: { label: "Convites e solicitações de acesso", value: pendingInvites.length },
    reports: { label: "Relatórios pendentes", value: pendingReports.length },
    sync: { label: "Suporte e sincronização", value: syncHealthy ? "Tudo certo" : "Atenção" },
  };

  const border = colors.border;
  const panel = colors.card;
  const inner = colors.secondaryBg;
  const roleFilterLabel: Record<RoleFilter, string> = {
    all: "Todas as funções",
    coordination: "Coordenação",
    professor: "Professores",
    intern: "Estagiários",
  };
  const statusFilterLabel: Record<StatusFilter, string> = {
    all: "Todos os status",
    active: "Ativos",
    pending: "Pendentes",
  };

  return (
    <View style={{ gap: 12 }}>
      <View
        style={{
          flexDirection: compact ? "column" : "row",
          alignItems: compact ? "stretch" : "center",
          justifyContent: "space-between",
          gap: 14,
        }}
      >
        <View style={{ flexShrink: 0, width: desktop ? "48%" : undefined }}>
          <Text style={{ color: colors.text, fontSize: compact ? 28 : 31, fontWeight: "800" }}>
            Coordenação
          </Text>
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 3 }}>
            {organizationName} •{" "}
            {new Date().toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </Text>
        </View>
        <View
          style={{
            flexDirection: "row",
            gap: 12,
            flexGrow: compact ? 1 : 0,
            flexShrink: 0,
            width: desktop ? "46%" : undefined,
            minWidth: 0,
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              width: compact ? undefined : 330,
              flex: compact ? 1 : undefined,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: border,
              backgroundColor: colors.inputBg,
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 12,
            }}
          >
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar pessoas, turmas, chamadas..."
              placeholderTextColor={colors.placeholder}
              style={{ color: colors.inputText, flex: 1, paddingVertical: 11 }}
            />
            <GoAtletaIcon name="search" size={17} color={colors.muted} />
          </View>
          <Pressable
            onPress={onInvite}
            style={{
              borderRadius: 8,
              borderWidth: 1,
              borderColor: border,
              paddingHorizontal: compact ? 13 : 20,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 8,
            }}
          >
            <GoAtletaIcon name="addStudent" size={18} color={colors.text} />
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              {compact ? "Convidar" : "Convidar pessoa"}
            </Text>
          </Pressable>
        </View>
      </View>

      <View
        style={{
          borderRadius: 8,
          borderWidth: 1,
          borderColor: border,
          backgroundColor: panel,
          paddingVertical: 15,
          paddingHorizontal: 18,
          flexDirection: "row",
          flexWrap: compact ? "wrap" : "nowrap",
        }}
      >
        {[
          ["members", members.length, "membros"],
          ["communications", pendingInvites.length, "convite"],
          ["attendance", pendingAttendance.length, "chamadas pendentes"],
          ["classes", uniqueClasses, "turmas"],
          ["reports", healthScore === null ? "..." : `${healthScore}%`, "operacional"],
        ].map(([icon, value, label], index) => (
          <View
            key={String(label)}
            style={{
              minWidth: compact ? "50%" : 0,
              flexGrow: compact ? 1 : 0,
              flexShrink: 0,
              width: compact ? undefined : "20%",
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center",
              gap: 10,
              borderLeftWidth: !compact && index > 0 ? 1 : 0,
              borderLeftColor: border,
            }}
          >
            <GoAtletaIcon name={icon as GoAtletaIconName} size={21} color={colors.muted} />
            <View>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: "800" }}>
                {loading ? "..." : value}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>{label}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: desktop ? "row" : "column", alignItems: "flex-start", gap: 12 }}>
        <View
          style={{
            flexGrow: 0,
            flexShrink: 0,
            width: desktop ? "57%" : "100%",
            minWidth: 0,
            gap: 6,
          }}
        >
          <View
            style={{
              borderRadius: 8,
              borderWidth: 1,
              borderColor: border,
              backgroundColor: panel,
              overflow: "hidden",
            }}
          >
            <Pressable
              onPress={() => setPeopleExpanded((current) => !current)}
              style={{ padding: 15, flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <GoAtletaIcon name="align" size={18} color={colors.muted} />
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800", flex: 1 }}>
                Pessoas e responsabilidades
              </Text>
              <GoAtletaIcon
                name={peopleExpanded ? "chevronUp" : "chevronDown"}
                size={18}
                color={colors.text}
              />
            </Pressable>

            {peopleExpanded ? (
              <>
                <View style={{ paddingHorizontal: 14, paddingBottom: 12, flexDirection: compact ? "column" : "row", gap: 10 }}>
                  <View
                    style={{
                      flex: 1.35,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: border,
                      backgroundColor: colors.inputBg,
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: 11,
                    }}
                  >
                    <TextInput
                      value={search}
                      onChangeText={setSearch}
                      placeholder="Buscar pessoa..."
                      placeholderTextColor={colors.placeholder}
                      style={{ color: colors.inputText, flex: 1, paddingVertical: 10 }}
                    />
                    <GoAtletaIcon name="search" size={16} color={colors.muted} />
                  </View>
                  <Pressable
                    onPress={() => setRoleFilter(cycleRole)}
                    style={{
                      flex: 1,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: border,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text style={{ color: colors.text }}>{roleFilterLabel[roleFilter]}</Text>
                    <GoAtletaIcon name="chevronDown" size={16} color={colors.text} />
                  </Pressable>
                  <Pressable
                    onPress={() => setStatusFilter(cycleStatus)}
                    style={{
                      flex: 0.85,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: border,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text style={{ color: colors.text }}>{statusFilterLabel[statusFilter]}</Text>
                    <GoAtletaIcon name="chevronDown" size={16} color={colors.text} />
                  </Pressable>
                </View>

                {!compact ? (
                  <View style={{ paddingHorizontal: 18, paddingVertical: 8, flexDirection: "row" }}>
                    {[
                      ["Pessoa", 1.35],
                      ["Função", 1],
                      ["Turmas", 0.8],
                      ["Chamadas pendentes", 1.05],
                      ["Status", 0.7],
                    ].map(([label, flex]) => (
                      <Text key={String(label)} style={{ color: colors.muted, fontSize: 11, flex: Number(flex) }}>
                        {label}
                      </Text>
                    ))}
                    <View style={{ width: 24 }} />
                  </View>
                ) : null}

                {filteredMembers.map((member) => {
                  const assigned = classesByUser.get(member.userId) ?? [];
                  const attendanceCount = assigned.filter((item) => attendanceByClass.has(item.classId)).length;
                  const selected = member.userId === selectedMember?.userId;
                  return (
                    <Pressable
                      key={member.userId}
                      onPress={() => setSelectedMemberId(member.userId)}
                      style={{
                        marginHorizontal: 12,
                        marginBottom: 1,
                        borderRadius: 4,
                        borderWidth: selected ? 1 : 0,
                        borderColor: selected ? colors.successBorder : "transparent",
                        backgroundColor: selected ? colors.successBg : panel,
                        paddingHorizontal: 10,
                        paddingVertical: 10,
                        flexDirection: "row",
                        alignItems: "center",
                      }}
                    >
                      <View style={{ flex: compact ? 1 : 1.35, flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <View
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: selected ? colors.primaryBg : inner,
                          }}
                        >
                          <Text style={{ color: selected ? colors.primaryText : colors.text, fontWeight: "800", fontSize: 11 }}>
                            {initials(member.displayName)}
                          </Text>
                        </View>
                        <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "700", flex: 1 }}>
                          {member.displayName}
                        </Text>
                      </View>
                      {!compact ? (
                        <>
                          <Text style={{ color: colors.text, flex: 1, fontSize: 12 }}>{roleLabel(member.roleLevel)}</Text>
                          <Text style={{ color: colors.text, flex: 0.8, fontSize: 12 }}>
                            {assigned.length ? `${assigned.length} turmas` : "—\nsem turmas"}
                          </Text>
                          <Text style={{ color: attendanceCount ? colors.warningText : colors.muted, flex: 1.05, fontSize: 12 }}>
                            {attendanceCount ? `${attendanceCount} ${attendanceCount === 1 ? "chamada" : "chamadas"}` : "—"}
                          </Text>
                          <View style={{ flex: 0.7, flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <GoAtletaIcon name="circle" size={7} color={colors.successText} />
                            <Text style={{ color: colors.text, fontSize: 12 }}>{attendanceCount ? "Ativo" : "Em dia"}</Text>
                          </View>
                          <GoAtletaIcon name="ellipsisHorizontal" size={18} color={colors.text} />
                        </>
                      ) : (
                        <Text style={{ color: attendanceCount ? colors.warningText : colors.muted, fontSize: 11 }}>
                          {attendanceCount ? `${attendanceCount} pendente(s)` : "Em dia"}
                        </Text>
                      )}
                    </Pressable>
                  );
                })}

                {filteredInvites.map((invite) => (
                  <View
                    key={invite.id}
                    style={{
                      marginHorizontal: 12,
                      paddingHorizontal: 10,
                      paddingVertical: 10,
                      borderTopWidth: 1,
                      borderTopColor: border,
                      flexDirection: "row",
                      alignItems: "center",
                    }}
                  >
                    <View style={{ flex: compact ? 1 : 1.35, flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#3E2466" }}>
                        <Text style={{ color: "#D9B7FF", fontWeight: "800", fontSize: 11 }}>
                          {initials(invite.invited_to ?? "Convite")}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "700" }}>
                          {invite.invited_to ?? "Convite pendente"}
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 10 }}>
                          Enviado em {new Date(invite.created_at).toLocaleDateString("pt-BR")}
                        </Text>
                      </View>
                    </View>
                    {!compact ? (
                      <>
                        <Text style={{ color: colors.muted, flex: 1, fontSize: 12 }}>Convite pendente</Text>
                        <Text style={{ color: colors.muted, flex: 0.8 }}>—</Text>
                        <Text style={{ color: colors.muted, flex: 1.05 }}>—</Text>
                        <View style={{ flex: 0.7, flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <GoAtletaIcon name="circle" size={7} color={colors.warningText} />
                          <Text style={{ color: colors.text, fontSize: 12 }}>Pendente</Text>
                        </View>
                        <GoAtletaIcon name="ellipsisHorizontal" size={18} color={colors.text} />
                      </>
                    ) : (
                      <Text style={{ color: colors.warningText, fontSize: 11 }}>Pendente</Text>
                    )}
                  </View>
                ))}
                <Text style={{ color: colors.muted, fontSize: 11, paddingHorizontal: 16, paddingVertical: 10 }}>
                  {filteredMembers.length + filteredInvites.length} pessoas
                </Text>
              </>
            ) : null}
          </View>

          {moduleOrder.map((key, index) => {
            const expanded = Boolean(expandedModules[key]);
            const metadata = moduleMeta[key];
            return (
              <View key={key} style={{ borderRadius: 6, borderWidth: 1, borderColor: border, backgroundColor: panel, overflow: "hidden" }}>
                <Pressable
                  onPress={() => setExpandedModules((current) => ({ ...current, [key]: !current[key] }))}
                  style={{ paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 11 }}
                >
                  <GoAtletaIcon name="align" size={16} color={colors.muted} />
                  <GoAtletaIcon name={moduleIcon[key]} size={18} color={colors.text} />
                  <Text style={{ color: colors.text, fontWeight: "700", flex: 1 }}>{metadata.label}</Text>
                  <Text style={{ color: key === "sync" && syncHealthy ? colors.successText : colors.text, fontWeight: "700" }}>
                    {metadata.value}
                  </Text>
                  {organizing ? (
                    <View style={{ flexDirection: "row", gap: 4 }}>
                      <Pressable disabled={index === 0} onPress={() => moveModule(key, -1)} style={{ opacity: index === 0 ? 0.3 : 1 }}>
                        <GoAtletaIcon name="arrowUp" size={17} color={colors.text} />
                      </Pressable>
                      <Pressable disabled={index === moduleOrder.length - 1} onPress={() => moveModule(key, 1)} style={{ opacity: index === moduleOrder.length - 1 ? 0.3 : 1 }}>
                        <GoAtletaIcon name="chevronDown" size={17} color={colors.text} />
                      </Pressable>
                    </View>
                  ) : (
                    <GoAtletaIcon name={expanded ? "chevronDown" : "chevronRight"} size={17} color={colors.text} />
                  )}
                </Pressable>
                {expanded ? (
                  <View style={{ borderTopWidth: 1, borderTopColor: border, paddingHorizontal: 16, paddingVertical: 10 }}>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      {key === "attendance"
                        ? `${pendingAttendance.length} chamadas precisam de acompanhamento.`
                        : key === "classes"
                          ? `${uniqueClasses} turmas possuem responsáveis definidos.`
                          : key === "access"
                            ? `${pendingInvites.length} convite pendente.`
                            : key === "reports"
                              ? `${pendingReports.length} relatórios pendentes, mantidos como acompanhamento secundário.`
                              : syncHealthy
                                ? "Tudo sincronizado. Nenhuma ação necessária."
                                : "Há itens que precisam de intervenção."}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })}

          <View style={{ alignItems: "center", paddingTop: 14, gap: 9 }}>
            <Pressable
              onPress={() => setOrganizing((current) => !current)}
              style={{ borderRadius: 6, borderWidth: 1, borderColor: border, paddingHorizontal: 20, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <GoAtletaIcon name="options" size={17} color={colors.text} />
              <Text style={{ color: colors.text, fontWeight: "700" }}>
                {organizing ? "Concluir organização" : "Organizar painel"}
              </Text>
            </Pressable>
            <Text style={{ color: colors.muted, fontSize: 11 }}>
              Escolha o que aparece primeiro, segundo, terceiro.
            </Text>
          </View>
        </View>

        <View
          style={{
            flexGrow: 0,
            flexShrink: 0,
            width: desktop ? "42%" : "100%",
            minWidth: 0,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: border,
            backgroundColor: panel,
            padding: 18,
            gap: 18,
          }}
        >
          {selectedMember ? (
            <>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 13 }}>
                <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: colors.primaryBg, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: colors.primaryText, fontSize: 18, fontWeight: "800" }}>{initials(selectedMember.displayName)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 20, fontWeight: "800" }}>{selectedMember.displayName}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={{ color: colors.muted }}>{roleLabel(selectedMember.roleLevel)}</Text>
                    <GoAtletaIcon name="circle" size={7} color={colors.successText} />
                    <Text style={{ color: colors.successText }}>Ativo</Text>
                  </View>
                </View>
                <Pressable onPress={() => onEditMember(selectedMember)} style={{ borderRadius: 6, borderWidth: 1, borderColor: border, paddingHorizontal: 14, paddingVertical: 9, flexDirection: "row", gap: 8 }}>
                  <GoAtletaIcon name="edit" size={16} color={colors.text} />
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>Editar perfil e permissões</Text>
                </Pressable>
              </View>

              <View style={{ borderTopWidth: 1, borderTopColor: border, paddingTop: 18, gap: 15 }}>
                <View style={{ flexDirection: "row" }}>
                  <Text style={{ color: colors.muted, width: 150 }}>Função</Text>
                  <Text style={{ color: colors.text }}>{roleLabel(selectedMember.roleLevel)}</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                  <Text style={{ color: colors.muted, width: 150 }}>Turmas atribuídas</Text>
                  <View style={{ flex: 1, gap: 8 }}>
                    {selectedClasses.length ? selectedClasses.map((item) => (
                      <Text key={item.classId} style={{ color: colors.text }}>{item.className}</Text>
                    )) : <Text style={{ color: colors.text }}>Sem turmas atribuídas.</Text>}
                  </View>
                  <Pressable onPress={() => onEditMember(selectedMember)}>
                    <Text style={{ color: colors.infoText, fontSize: 12 }}>Editar turmas</Text>
                  </Pressable>
                </View>
                <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                  <Text style={{ color: colors.muted, width: 150 }}>Permissões de telas</Text>
                  <Text style={{ color: colors.text, flex: 1 }}>
                    {selectedMember.roleLevel >= 50
                      ? "Coordenação, Professores,\nEstagiários, Convites pendentes"
                      : "Permissões configuráveis por tela"}
                  </Text>
                  <Pressable onPress={() => onEditMember(selectedMember)}>
                    <Text style={{ color: colors.infoText, fontSize: 12 }}>Editar permissões</Text>
                  </Pressable>
                </View>
                {selectedMember.roleLevel >= 50 ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <GoAtletaIcon name="shield" size={17} color={colors.text} />
                    <Text style={{ color: colors.muted, fontSize: 12 }}>O acesso administrativo próprio não pode ser removido.</Text>
                  </View>
                ) : null}
              </View>

              <View style={{ borderTopWidth: 1, borderTopColor: border, paddingTop: 18, gap: 14 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800" }}>Chamadas para cobrar</Text>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: inner, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>{selectedAttendance.length ? 1 : 0}</Text>
                  </View>
                </View>
                {selectedAttendance.length ? (
                  <>
                    {selectedAttendance.slice(0, showAllAttendance ? selectedAttendance.length : 1).map((item, index) => (
                      <View key={`${item.classId}:${item.targetDate}`} style={{ borderRadius: 8, borderWidth: 1, borderColor: border, backgroundColor: inner, padding: 13, flexDirection: compact ? "column" : "row", alignItems: compact ? "stretch" : "center", gap: 12 }}>
                        <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" }}>
                          <GoAtletaIcon name="attendance" size={22} color={colors.muted} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.text, fontWeight: "800" }}>{item.className}</Text>
                          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                            {new Date(`${item.targetDate}T12:00:00`).toLocaleDateString("pt-BR")} • {item.unit}
                          </Text>
                          <Text style={{ color: colors.warningText, fontSize: 12, marginTop: 7 }}>1 chamada pendente</Text>
                        </View>
                        <View style={{ width: compact ? "100%" : 185, gap: 7 }}>
                          <Pressable disabled={notifySending} onPress={() => onNotifyAttendance(item, selectedMember)} style={{ borderRadius: 5, backgroundColor: colors.primaryBg, paddingVertical: 10, alignItems: "center", opacity: notifySending ? 0.65 : 1 }}>
                            <Text style={{ color: colors.primaryText, fontWeight: "800" }}>{notifySending && index === 0 ? "Enviando..." : "Cobrar chamada"}</Text>
                          </Pressable>
                          <Pressable onPress={() => onOpenAttendance(item)} style={{ borderRadius: 5, borderWidth: 1, borderColor: border, paddingVertical: 9, alignItems: "center" }}>
                            <Text style={{ color: colors.text, fontWeight: "700" }}>Abrir chamada</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))}
                    {selectedAttendance.length > 1 ? (
                      <Pressable onPress={() => setShowAllAttendance((current) => !current)} style={{ alignSelf: "flex-start" }}>
                        <Text style={{ color: colors.infoText, fontSize: 12, fontWeight: "700" }}>
                          {showAllAttendance ? "Recolher chamadas" : `Ver todas as ${selectedAttendance.length} chamadas pendentes`}
                        </Text>
                      </Pressable>
                    ) : null}
                  </>
                ) : (
                  <Text style={{ color: colors.muted, fontSize: 12 }}>Nenhuma chamada pendente para este responsável.</Text>
                )}
              </View>

              <View style={{ borderTopWidth: 1, borderTopColor: border, paddingTop: 18, gap: 12 }}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>Comunicação</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Text style={{ color: colors.muted, fontSize: 12, flex: 1 }}>
                    {messageReady ? "Mensagem contextual pronta para copiar e enviar." : "Gere e copie uma mensagem para enviar no WhatsApp."}
                  </Text>
                  <Pressable onPress={() => setMessageReady(true)} style={{ borderRadius: 5, borderWidth: 1, borderColor: border, paddingHorizontal: 15, paddingVertical: 9 }}>
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>{messageReady ? "Mensagem pronta" : "Gerar mensagem"}</Text>
                  </Pressable>
                </View>
              </View>
            </>
          ) : (
            <Text style={{ color: colors.muted }}>Nenhum membro selecionado.</Text>
          )}
        </View>
      </View>
    </View>
  );
}
