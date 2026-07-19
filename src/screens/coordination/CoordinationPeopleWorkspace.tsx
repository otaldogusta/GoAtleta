import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type View as ViewType,
} from "react-native";

import {
  adminListMemberPermissions,
  adminSetMemberClassHeads,
  adminSetMemberPermission,
  adminUpdateMemberRole,
  MEMBER_PERMISSION_OPTIONS,
  type MemberClassHead,
  type MemberPermissionKey,
  type OrgClass,
  type OrgMember,
} from "../../api/members";
import type { AdminPendingAttendance, AdminPendingSessionLogs } from "../../api/reports";
import {
  createTrainerInvite,
  type TrainerInviteItem,
  type TrainerInviteRole,
} from "../../api/trainer-invite";
import { radius } from "../../theme/tokens";
import { AnchoredDropdown } from "../../ui/AnchoredDropdown";
import { AnchoredDropdownOption } from "../../ui/AnchoredDropdownOption";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon, type GoAtletaIconName } from "../../ui/icon-registry";
import { ModalSheet } from "../../ui/ModalSheet";
import { Pressable } from "../../ui/Pressable";

type SecondaryModuleKey = "attendance" | "classes" | "access" | "reports" | "sync";
type RoleFilter = "all" | "coordination" | "professor" | "intern";
type StatusFilter = "all" | "active" | "pending";
type ModalMode = "invite" | "edit" | "message" | null;
type Layout = { x: number; y: number; width: number; height: number };
type InviteAudience = Exclude<TrainerInviteRole, "collaborator"> | "student";

type CoordinationPeopleWorkspaceProps = {
  organizationId: string;
  organizationName: string;
  loading: boolean;
  healthScore: number | null;
  members: OrgMember[];
  memberClassHeads: MemberClassHead[];
  organizationClasses: OrgClass[];
  pendingInvites: TrainerInviteItem[];
  pendingAttendance: AdminPendingAttendance[];
  pendingReports: AdminPendingSessionLogs[];
  syncHealthy: boolean;
  notifySending: boolean;
  onRefresh: () => void;
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

function DropdownButton<T extends string | number>({
  value,
  options,
  onChange,
  compact,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  compact?: boolean;
}) {
  const { colors } = useAppTheme();
  const triggerRef = useRef<ViewType | null>(null);
  const [open, setOpen] = useState(false);
  const [layout, setLayout] = useState<Layout | null>(null);
  const activeLabel = options.find((option) => option.value === value)?.label ?? value;

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setLayout({ x, y, width, height });
      setOpen(true);
    });
  };

  return (
    <>
      <View ref={triggerRef}>
        <Pressable
          onPress={toggle}
          style={{
          minWidth: compact ? 0 : 160,
          flex: compact ? 1 : undefined,
          borderRadius: radius.internal,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.inputBg,
          paddingHorizontal: 12,
          paddingVertical: 10,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          }}
        >
          <Text numberOfLines={1} style={{ color: colors.text, flex: 1 }}>
            {activeLabel}
          </Text>
          <GoAtletaIcon name={open ? "chevronUp" : "chevronDown"} size={16} color={colors.text} />
        </Pressable>
      </View>
      <AnchoredDropdown
        visible={open}
        layout={layout}
        container={null}
        animationStyle={{}}
        zIndex={4200}
        maxHeight={220}
        nestedScrollEnabled
        onRequestClose={() => setOpen(false)}
        interactiveRefs={[triggerRef]}
      >
        {options.map((option) => (
          <AnchoredDropdownOption
            key={option.value}
            active={option.value === value}
            onPress={() => {
              onChange(option.value);
              setOpen(false);
            }}
          >
            <Text
              style={{
                color: option.value === value ? colors.primaryText : colors.text,
                fontWeight: "700",
              }}
            >
              {option.label}
            </Text>
          </AnchoredDropdownOption>
        ))}
      </AnchoredDropdown>
    </>
  );
}

function OverflowSummary({
  labels,
  icon,
  limit = 4,
}: {
  labels: string[];
  icon?: GoAtletaIconName;
  limit?: number;
}) {
  const { colors } = useAppTheme();
  const shown = labels.slice(0, limit);
  const remainder = Math.max(0, labels.length - shown.length);

  if (!labels.length) {
    return <Text style={{ color: colors.muted, fontSize: 12 }}>Nenhum item atribuído.</Text>;
  }

  return (
    <View style={{ flexDirection: "row", alignItems: "center", minHeight: 34 }}>
      {shown.map((label, index) => (
        <View
          key={`${label}:${index}`}
          style={{
            width: 34,
            height: 34,
            marginLeft: index === 0 ? 0 : -8,
            borderRadius: 17,
            borderWidth: 2,
            borderColor: colors.card,
            backgroundColor: index % 2 === 0 ? colors.successBg : colors.secondaryBg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon ? (
            <GoAtletaIcon name={icon} size={15} color={colors.text} />
          ) : (
            <Text numberOfLines={1} style={{ color: colors.text, fontSize: 9, fontWeight: "800" }}>
              {initials(label)}
            </Text>
          )}
        </View>
      ))}
      {remainder > 0 ? (
        <View
          style={{
            minWidth: 34,
            height: 34,
            marginLeft: -5,
            paddingHorizontal: 7,
            borderRadius: 17,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: colors.text, fontSize: 10, fontWeight: "800" }}>+{remainder}</Text>
        </View>
      ) : null}
    </View>
  );
}

function MemberActionMenu({
  member,
  onEdit,
  onMessage,
}: {
  member: OrgMember;
  onEdit: (member: OrgMember) => void;
  onMessage: (member: OrgMember) => void;
}) {
  const { colors } = useAppTheme();
  const triggerRef = useRef<ViewType | null>(null);
  const [open, setOpen] = useState(false);
  const [layout, setLayout] = useState<Layout | null>(null);
  const actions: Array<{
    label: string;
    icon: GoAtletaIconName;
    destructive?: boolean;
    onPress: () => void;
  }> = [
    { label: "Editar perfil e permissões", icon: "edit", onPress: () => onEdit(member) },
    { label: "Editar turmas", icon: "classes", onPress: () => onEdit(member) },
    { label: "Gerar mensagem", icon: "message", onPress: () => onMessage(member) },
    {
      label: "Desativar acesso",
      icon: "trash",
      destructive: true,
      onPress: () =>
        Alert.alert(
          "Desativar acesso",
          "A desativação permanece disponível na gestão completa de membros para evitar alterações acidentais."
        ),
    },
  ];

  return (
    <>
      <View ref={triggerRef}>
        <Pressable
          accessibilityLabel={`Ações de ${member.displayName}`}
          onPress={() => {
          if (open) {
            setOpen(false);
            return;
          }
          triggerRef.current?.measureInWindow((x, y, width, height) => {
            setLayout({ x: x - 180 + width, y, width: 180, height });
            setOpen(true);
          });
          }}
          style={{ width: 30, height: 30, alignItems: "center", justifyContent: "center" }}
        >
          <GoAtletaIcon name="ellipsisHorizontal" size={19} color={colors.text} />
        </Pressable>
      </View>
      <AnchoredDropdown
        visible={open}
        layout={layout}
        container={null}
        animationStyle={{}}
        zIndex={4300}
        maxHeight={260}
        nestedScrollEnabled
        onRequestClose={() => setOpen(false)}
        interactiveRefs={[triggerRef]}
      >
        {actions.map((action) => (
          <AnchoredDropdownOption
            key={action.label}
            active={false}
            onPress={() => {
              setOpen(false);
              action.onPress();
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
              <GoAtletaIcon
                name={action.icon}
                size={16}
                color={action.destructive ? colors.dangerText : colors.text}
              />
              <Text
                style={{
                  color: action.destructive ? colors.dangerText : colors.text,
                  fontWeight: "700",
                }}
              >
                {action.label}
              </Text>
            </View>
          </AnchoredDropdownOption>
        ))}
      </AnchoredDropdown>
    </>
  );
}

export function CoordinationPeopleWorkspace({
  organizationId,
  organizationName,
  loading,
  healthScore,
  members,
  memberClassHeads,
  organizationClasses,
  pendingInvites,
  pendingAttendance,
  pendingReports,
  syncHealthy,
  notifySending,
  onRefresh,
  onOpenAttendance,
  onNotifyAttendance,
}: CoordinationPeopleWorkspaceProps) {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const desktop = Platform.OS === "web" && width >= 1180;
  const compact = width < 760;
  const storageKey = `coordination_workspace_order_v1:${organizationId}`;

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [peopleExpanded, setPeopleExpanded] = useState(true);
  const [organizing, setOrganizing] = useState(false);
  const [moduleOrder, setModuleOrder] = useState(DEFAULT_MODULE_ORDER);
  const [expandedModules, setExpandedModules] = useState<
    Partial<Record<SecondaryModuleKey, boolean>>
  >({ attendance: true });
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [modalMember, setModalMember] = useState<OrgMember | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteAudience>("professor");
  const [invitePermissionKeys, setInvitePermissionKeys] = useState<MemberPermissionKey[]>([
    "classes",
    "training",
    "calendar",
    "absence_notices",
  ]);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteResult, setInviteResult] = useState<string | null>(null);
  const [inviteEmailSent, setInviteEmailSent] = useState<boolean | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editRole, setEditRole] = useState<5 | 10 | 50>(10);
  const [editClassIds, setEditClassIds] = useState<string[]>([]);
  const [editPermissionKeys, setEditPermissionKeys] = useState<MemberPermissionKey[]>([]);
  const [permissionLoading, setPermissionLoading] = useState(false);
  const [selectedPermissionKeys, setSelectedPermissionKeys] = useState<MemberPermissionKey[]>([]);
  const [selectedPermissionsLoading, setSelectedPermissionsLoading] = useState(false);
  const selectedPermissionRequestRef = useRef(0);
  const editPermissionRequestRef = useRef(0);

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
        // Mantém a ordem padrão se a preferência local estiver inválida.
      }
    });
  }, [storageKey]);

  useEffect(() => {
    if (selectedMemberId && members.some((member) => member.userId === selectedMemberId)) return;
    setSelectedMemberId(members[0]?.userId ?? null);
  }, [members, selectedMemberId]);

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
      const assigned = classesByUser.get(member.userId) ?? [];
      const roleMatches =
        roleFilter === "all" ||
        (roleFilter === "coordination" && member.roleLevel >= 50) ||
        (roleFilter === "professor" && member.roleLevel >= 10 && member.roleLevel < 50) ||
        (roleFilter === "intern" && member.roleLevel < 10);
      const statusMatches = statusFilter !== "pending";
      const haystack = `${member.displayName} ${member.email ?? ""} ${roleLabel(
        member.roleLevel
      )} ${assigned.map((item) => `${item.className} ${item.unit}`).join(" ")}`.toLowerCase();
      return roleMatches && statusMatches && (!query || haystack.includes(query));
    });
  }, [classesByUser, members, roleFilter, search, statusFilter]);

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

  useEffect(() => {
    const requestId = selectedPermissionRequestRef.current + 1;
    selectedPermissionRequestRef.current = requestId;

    if (!selectedMember) {
      setSelectedPermissionKeys([]);
      setSelectedPermissionsLoading(false);
      return;
    }
    if (selectedMember.roleLevel >= 50) {
      setSelectedPermissionKeys(MEMBER_PERMISSION_OPTIONS.map((option) => option.key));
      setSelectedPermissionsLoading(false);
      return;
    }

    setSelectedPermissionsLoading(true);
    void adminListMemberPermissions(organizationId, selectedMember.userId)
      .then((permissions) => {
        if (selectedPermissionRequestRef.current !== requestId) return;
        setSelectedPermissionKeys(
          permissions
            .filter((permission) => permission.isAllowed)
            .map((permission) => permission.permissionKey)
        );
      })
      .catch(() => {
        if (selectedPermissionRequestRef.current !== requestId) return;
        setSelectedPermissionKeys([]);
      })
      .finally(() => {
        if (selectedPermissionRequestRef.current === requestId) {
          setSelectedPermissionsLoading(false);
        }
      });
  }, [organizationId, selectedMember]);

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

  const openInvite = () => {
    setInviteEmail("");
    setInviteRole("professor");
    setInvitePermissionKeys(["classes", "training", "calendar", "absence_notices"]);
    setInviteResult(null);
    setInviteEmailSent(null);
    setModalMember(null);
    setModalMode("invite");
  };

  const openEdit = async (member: OrgMember) => {
    const requestId = editPermissionRequestRef.current + 1;
    editPermissionRequestRef.current = requestId;
    setModalMember(member);
    setEditRole(member.roleLevel >= 50 ? 50 : member.roleLevel >= 10 ? 10 : 5);
    setEditClassIds((classesByUser.get(member.userId) ?? []).map((item) => item.classId));
    setEditPermissionKeys([]);
    setPermissionLoading(true);
    setModalMode("edit");
    try {
      const permissions = await adminListMemberPermissions(organizationId, member.userId);
      if (editPermissionRequestRef.current !== requestId) return;
      setEditPermissionKeys(
        permissions.filter((permission) => permission.isAllowed).map((permission) => permission.permissionKey)
      );
    } catch {
      if (editPermissionRequestRef.current !== requestId) return;
      Alert.alert("Permissões", "Não foi possível carregar as permissões desta pessoa.");
    } finally {
      if (editPermissionRequestRef.current === requestId) {
        setPermissionLoading(false);
      }
    }
  };

  const openMessage = (member: OrgMember) => {
    setModalMember(member);
    setModalMode("message");
  };

  const submitInvite = async () => {
    if (inviteRole === "student") {
      router.push("/coord/students" as never);
      setModalMode(null);
      return;
    }
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      Alert.alert("Convidar pessoa", "Informe um e-mail válido.");
      return;
    }
    setInviteBusy(true);
    try {
      const result = await createTrainerInvite({
        organizationId,
        role: inviteRole,
        invitedTo: email,
        permissionKeys: inviteRole === "moderator" ? [] : invitePermissionKeys,
      });
      setInviteResult(result.signup_link);
      setInviteEmailSent(result.email_sent);
      await Clipboard.setStringAsync(result.signup_link);
      onRefresh();
      Alert.alert(
        result.email_sent ? "Convite enviado" : "Convite criado",
        result.email_sent
          ? "O convite foi enviado por e-mail e o link também foi copiado."
          : "O e-mail não pôde ser enviado. O link foi copiado para você compartilhar."
      );
    } catch (error) {
      Alert.alert(
        "Não foi possível convidar",
        error instanceof Error ? error.message : "Tente novamente em instantes."
      );
    } finally {
      setInviteBusy(false);
    }
  };

  const submitEdit = async () => {
    if (!modalMember) return;
    setEditBusy(true);
    try {
      if (modalMember.roleLevel < 50 || editRole === 50) {
        await adminUpdateMemberRole(organizationId, modalMember.userId, editRole);
      }
      await adminSetMemberClassHeads(organizationId, modalMember.userId, editClassIds);
      await Promise.all(
        MEMBER_PERMISSION_OPTIONS.map((option) =>
          adminSetMemberPermission(
            organizationId,
            modalMember.userId,
            option.key,
            editPermissionKeys.includes(option.key)
          )
        )
      );
      setModalMode(null);
      onRefresh();
      Alert.alert("Alterações salvas", "Função, turmas e permissões foram atualizadas.");
    } catch (error) {
      Alert.alert(
        "Não foi possível salvar",
        error instanceof Error ? error.message : "Tente novamente."
      );
    } finally {
      setEditBusy(false);
    }
  };

  const messageText = modalMember
    ? `Olá, ${modalMember.displayName.split(" ")[0]}. ${
        selectedAttendance.length
          ? `Há ${selectedAttendance.length} chamada(s) pendente(s) nas suas turmas.`
          : "Sua operação está em dia."
      } Acesse o GoAtleta para conferir os detalhes.`
    : "";

  const uniqueClasses = new Set(memberClassHeads.map((item) => item.classId)).size;
  const moduleMeta: Record<SecondaryModuleKey, { label: string; value: string | number }> = {
    attendance: { label: "Chamadas pendentes", value: pendingAttendance.length },
    classes: { label: "Turmas monitoradas", value: uniqueClasses },
    access: { label: "Convites e solicitações de acesso", value: pendingInvites.length },
    reports: { label: "Relatórios pendentes", value: pendingReports.length },
    sync: { label: "Suporte e sincronização", value: syncHealthy ? "Tudo certo" : "Atenção" },
  };

  const roleOptions: Array<{ value: RoleFilter; label: string }> = [
    { value: "all", label: "Todas as funções" },
    { value: "coordination", label: "Coordenação" },
    { value: "professor", label: "Professores" },
    { value: "intern", label: "Estagiários" },
  ];
  const statusOptions: Array<{ value: StatusFilter; label: string }> = [
    { value: "all", label: "Todos os status" },
    { value: "active", label: "Ativos" },
    { value: "pending", label: "Pendentes" },
  ];
  const border = colors.border;
  const panel = colors.card;
  const inner = colors.secondaryBg;
  const listMaxHeight = Math.max(180, Math.min(310, height * 0.36));

  const renderModuleContent = (key: SecondaryModuleKey) => {
    if (key === "attendance") {
      return (
        <ScrollView style={{ maxHeight: listMaxHeight }} showsVerticalScrollIndicator>
          {pendingAttendance.map((item) => (
            <Pressable
              key={`${item.classId}:${item.targetDate}`}
              onPress={() => onOpenAttendance(item)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 11,
                borderBottomWidth: 1,
                borderBottomColor: border,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              <GoAtletaIcon name="attendance" size={17} color={colors.muted} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "700" }}>{item.className}</Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  {item.unit} • {new Date(`${item.targetDate}T12:00:00`).toLocaleDateString("pt-BR")}
                </Text>
              </View>
              <Text style={{ color: colors.warningText, fontSize: 11 }}>1 pendente</Text>
            </Pressable>
          ))}
        </ScrollView>
      );
    }
    if (key === "classes") {
      return (
        <ScrollView style={{ maxHeight: listMaxHeight }} showsVerticalScrollIndicator>
          {organizationClasses.map((item) => (
            <View
              key={item.id}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 11,
                borderBottomWidth: 1,
                borderBottomColor: border,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700" }}>{item.name}</Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>{item.unit}</Text>
            </View>
          ))}
        </ScrollView>
      );
    }
    if (key === "access") {
      return (
        <ScrollView style={{ maxHeight: listMaxHeight }} showsVerticalScrollIndicator>
          {pendingInvites.map((invite) => (
            <View
              key={invite.id}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 11,
                borderBottomWidth: 1,
                borderBottomColor: border,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700" }}>
                {invite.invited_to ?? "Convite sem e-mail"}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>Aguardando aceite</Text>
            </View>
          ))}
        </ScrollView>
      );
    }
    if (key === "reports") {
      return (
        <ScrollView style={{ maxHeight: listMaxHeight }} showsVerticalScrollIndicator>
          {pendingReports.map((report, index) => (
            <View
              key={`${report.classId}:${index}`}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 11,
                borderBottomWidth: 1,
                borderBottomColor: border,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700" }}>{report.className}</Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>Relatório pendente</Text>
            </View>
          ))}
        </ScrollView>
      );
    }
    return (
      <Text style={{ color: colors.muted, fontSize: 12, padding: 16 }}>
        {syncHealthy ? "Tudo sincronizado. Nenhuma ação necessária." : "Há itens que precisam de intervenção."}
      </Text>
    );
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
          <Pressable
            onPress={() => router.push("/coord/dashboard")}
            style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" }}
          >
            <GoAtletaIcon name="chevronBack" size={18} color={colors.text} />
            <Text style={{ color: colors.text, fontSize: compact ? 24 : 27, fontWeight: "800" }}>
              Coordenação
            </Text>
          </Pressable>
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 3, marginLeft: 22 }}>
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
            width: desktop ? "46%" : undefined,
            minWidth: 0,
          }}
        >
          <View
            style={{
              flex: 1,
              borderRadius: radius.internal,
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
              placeholder="Buscar pessoas e responsabilidades..."
              placeholderTextColor={colors.placeholder}
              style={{ color: colors.inputText, flex: 1, paddingVertical: 11 }}
            />
            <GoAtletaIcon name="search" size={17} color={colors.muted} />
          </View>
          <Pressable
            onPress={openInvite}
            style={{
              borderRadius: radius.internal,
              borderWidth: 1,
              borderColor: border,
              paddingHorizontal: compact ? 13 : 18,
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
          borderRadius: radius.internal,
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
        <View style={{ width: desktop ? "61%" : "100%", minWidth: 0, gap: 7 }}>
          <View
            style={{
              borderRadius: radius.internal,
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
                <View
                  style={{
                    paddingHorizontal: 14,
                    paddingBottom: 12,
                    flexDirection: "row",
                    gap: 10,
                  }}
                >
                  <DropdownButton
                    value={roleFilter}
                    options={roleOptions}
                    onChange={setRoleFilter}
                    compact={compact}
                  />
                  <DropdownButton
                    value={statusFilter}
                    options={statusOptions}
                    onChange={setStatusFilter}
                    compact={compact}
                  />
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
                      <Text
                        key={String(label)}
                        style={{ color: colors.muted, fontSize: 11, flex: Number(flex) }}
                      >
                        {label}
                      </Text>
                    ))}
                    <View style={{ width: 30 }} />
                  </View>
                ) : null}

                <ScrollView
                  style={{ maxHeight: listMaxHeight }}
                  showsVerticalScrollIndicator
                  nestedScrollEnabled
                >
                  {filteredMembers.map((member) => {
                    const assigned = classesByUser.get(member.userId) ?? [];
                    const attendanceCount = assigned.filter((item) =>
                      attendanceByClass.has(item.classId)
                    ).length;
                    const selected = member.userId === selectedMember?.userId;
                    return (
                      <Pressable
                        key={member.userId}
                        onPress={() => setSelectedMemberId(member.userId)}
                        style={{
                          marginHorizontal: 12,
                          marginBottom: 1,
                          borderRadius: radius.internal,
                          borderWidth: selected ? 1 : 0,
                          borderColor: selected ? colors.successBorder : "transparent",
                          backgroundColor: selected ? colors.successBg : panel,
                          paddingHorizontal: 10,
                          paddingVertical: 10,
                          flexDirection: "row",
                          alignItems: "center",
                        }}
                      >
                        <View
                          style={{
                            flex: compact ? 1 : 1.35,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
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
                            <Text
                              style={{
                                color: selected ? colors.primaryText : colors.text,
                                fontWeight: "800",
                                fontSize: 11,
                              }}
                            >
                              {initials(member.displayName)}
                            </Text>
                          </View>
                          <Text
                            numberOfLines={1}
                            style={{ color: colors.text, fontWeight: "700", flex: 1 }}
                          >
                            {member.displayName}
                          </Text>
                        </View>
                        {!compact ? (
                          <>
                            <Text style={{ color: colors.text, flex: 1, fontSize: 12 }}>
                              {roleLabel(member.roleLevel)}
                            </Text>
                            <Text style={{ color: colors.text, flex: 0.8, fontSize: 12 }}>
                              {assigned.length ? `${assigned.length} turmas` : "—"}
                            </Text>
                            <Text
                              style={{
                                color: attendanceCount ? colors.warningText : colors.muted,
                                flex: 1.05,
                                fontSize: 12,
                              }}
                            >
                              {attendanceCount ? `${attendanceCount} chamadas` : "—"}
                            </Text>
                            <View
                              style={{
                                flex: 0.7,
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              <GoAtletaIcon name="circle" size={7} color={colors.successText} />
                              <Text style={{ color: colors.text, fontSize: 12 }}>
                                {attendanceCount ? "Ativo" : "Em dia"}
                              </Text>
                            </View>
                            <MemberActionMenu
                              member={member}
                              onEdit={(value) => void openEdit(value)}
                              onMessage={openMessage}
                            />
                          </>
                        ) : (
                          <MemberActionMenu
                            member={member}
                            onEdit={(value) => void openEdit(value)}
                            onMessage={openMessage}
                          />
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
                      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <View
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: inner,
                          }}
                        >
                          <GoAtletaIcon name="communications" size={15} color={colors.warningText} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "700" }}>
                            {invite.invited_to ?? "Convite pendente"}
                          </Text>
                          <Text style={{ color: colors.muted, fontSize: 10 }}>Aguardando aceite</Text>
                        </View>
                      </View>
                      <Text style={{ color: colors.warningText, fontSize: 11 }}>Pendente</Text>
                    </View>
                  ))}
                </ScrollView>
                <Text
                  style={{
                    color: colors.muted,
                    fontSize: 11,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                  }}
                >
                  {filteredMembers.length + filteredInvites.length} pessoas
                </Text>
              </>
            ) : null}
          </View>

          {moduleOrder.map((key, index) => {
            const expanded = Boolean(expandedModules[key]);
            const metadata = moduleMeta[key];
            return (
              <View
                key={key}
                style={{
                  borderRadius: radius.internal,
                  borderWidth: 1,
                  borderColor: border,
                  backgroundColor: panel,
                  overflow: "hidden",
                }}
              >
                <Pressable
                  onPress={() =>
                    setExpandedModules((current) => ({ ...current, [key]: !current[key] }))
                  }
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 11,
                  }}
                >
                  <GoAtletaIcon name="align" size={16} color={colors.muted} />
                  <GoAtletaIcon name={moduleIcon[key]} size={18} color={colors.text} />
                  <Text style={{ color: colors.text, fontWeight: "700", flex: 1 }}>
                    {metadata.label}
                  </Text>
                  <Text
                    style={{
                      color: key === "sync" && syncHealthy ? colors.successText : colors.text,
                      fontWeight: "700",
                    }}
                  >
                    {metadata.value}
                  </Text>
                  {organizing ? (
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      <Pressable
                        disabled={index === 0}
                        onPress={() => moveModule(key, -1)}
                        style={{ opacity: index === 0 ? 0.3 : 1 }}
                      >
                        <GoAtletaIcon name="arrowUp" size={17} color={colors.text} />
                      </Pressable>
                      <Pressable
                        disabled={index === moduleOrder.length - 1}
                        onPress={() => moveModule(key, 1)}
                        style={{ opacity: index === moduleOrder.length - 1 ? 0.3 : 1 }}
                      >
                        <GoAtletaIcon name="chevronDown" size={17} color={colors.text} />
                      </Pressable>
                    </View>
                  ) : (
                    <GoAtletaIcon
                      name={expanded ? "chevronDown" : "chevronRight"}
                      size={17}
                      color={colors.text}
                    />
                  )}
                </Pressable>
                {expanded ? (
                  <View style={{ borderTopWidth: 1, borderTopColor: border }}>
                    {renderModuleContent(key)}
                  </View>
                ) : null}
              </View>
            );
          })}

          <View style={{ alignItems: "center", paddingTop: 12 }}>
            <Pressable
              onPress={() => setOrganizing((current) => !current)}
              style={{
                borderRadius: radius.internal,
                borderWidth: 1,
                borderColor: border,
                paddingHorizontal: 18,
                paddingVertical: 9,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <GoAtletaIcon name="options" size={17} color={colors.text} />
              <Text style={{ color: colors.text, fontWeight: "700" }}>
                {organizing ? "Concluir organização" : "Organizar painel"}
              </Text>
            </Pressable>
          </View>
        </View>

        <View
          style={{
            width: desktop ? "39%" : "100%",
            minWidth: 0,
            borderRadius: radius.internal,
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
                <View
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: 29,
                    backgroundColor: colors.primaryBg,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: colors.primaryText, fontSize: 18, fontWeight: "800" }}>
                    {initials(selectedMember.displayName)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 20, fontWeight: "800" }}>
                    {selectedMember.displayName}
                  </Text>
                  <Text style={{ color: colors.muted }}>{roleLabel(selectedMember.roleLevel)} • Ativo</Text>
                </View>
                <Pressable
                  onPress={() => void openEdit(selectedMember)}
                  style={{
                    borderRadius: radius.internal,
                    borderWidth: 1,
                    borderColor: border,
                    paddingHorizontal: 12,
                    paddingVertical: 9,
                    flexDirection: "row",
                    gap: 7,
                  }}
                >
                  <GoAtletaIcon name="edit" size={15} color={colors.text} />
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 11 }}>
                    Editar perfil e permissões
                  </Text>
                </Pressable>
              </View>

              <View style={{ borderTopWidth: 1, borderTopColor: border, paddingTop: 18, gap: 18 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Text style={{ color: colors.muted, width: 110 }}>Função</Text>
                  <Text style={{ color: colors.text }}>{roleLabel(selectedMember.roleLevel)}</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Text style={{ color: colors.muted, width: 110 }}>Turmas atribuídas</Text>
                  <View style={{ flex: 1 }}>
                    <OverflowSummary labels={selectedClasses.map((item) => item.className)} />
                  </View>
                  <Pressable onPress={() => void openEdit(selectedMember)}>
                    <Text style={{ color: colors.infoText, fontSize: 12 }}>Ver todas</Text>
                  </Pressable>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Text style={{ color: colors.muted, width: 110 }}>Permissões</Text>
                  <View style={{ flex: 1 }}>
                    {selectedPermissionsLoading ? (
                      <Text style={{ color: colors.muted, fontSize: 12 }}>
                        Carregando permissões...
                      </Text>
                    ) : (
                      <OverflowSummary
                        labels={MEMBER_PERMISSION_OPTIONS.filter((option) =>
                          selectedPermissionKeys.includes(option.key)
                        ).map((option) => option.label)}
                        icon="shield"
                        limit={3}
                      />
                    )}
                  </View>
                  <Pressable onPress={() => void openEdit(selectedMember)}>
                    <Text style={{ color: colors.infoText, fontSize: 12 }}>Ver todas</Text>
                  </Pressable>
                </View>
                {selectedMember.roleLevel >= 50 ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <GoAtletaIcon name="shield" size={17} color={colors.text} />
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      O acesso administrativo próprio não pode ser removido.
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={{ borderTopWidth: 1, borderTopColor: border, paddingTop: 18, gap: 14 }}>
                <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800" }}>
                  Chamadas para cobrar {selectedAttendance.length}
                </Text>
                {selectedAttendance.length ? (
                  <View
                    style={{
                      borderRadius: radius.internal,
                      borderWidth: 1,
                      borderColor: border,
                      backgroundColor: inner,
                      padding: 13,
                      flexDirection: compact ? "column" : "row",
                      alignItems: compact ? "stretch" : "center",
                      gap: 12,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: "800" }}>
                        {selectedAttendance[0].className}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                        {selectedAttendance[0].unit}
                      </Text>
                      <Text style={{ color: colors.warningText, fontSize: 12, marginTop: 6 }}>
                        1 chamada pendente
                      </Text>
                    </View>
                    <View style={{ width: compact ? "100%" : 155, gap: 7 }}>
                      <Pressable
                        disabled={notifySending}
                        onPress={() => onNotifyAttendance(selectedAttendance[0], selectedMember)}
                        style={{
                          borderRadius: radius.internal,
                          backgroundColor: colors.primaryBg,
                          paddingVertical: 10,
                          alignItems: "center",
                          opacity: notifySending ? 0.65 : 1,
                        }}
                      >
                        <Text style={{ color: colors.primaryText, fontWeight: "800" }}>
                          {notifySending ? "Enviando..." : "Cobrar chamada"}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => onOpenAttendance(selectedAttendance[0])}
                        style={{
                          borderRadius: radius.internal,
                          borderWidth: 1,
                          borderColor: border,
                          paddingVertical: 9,
                          alignItems: "center",
                        }}
                      >
                        <Text style={{ color: colors.text, fontWeight: "700" }}>Abrir chamada</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    Nenhuma chamada pendente para esta pessoa.
                  </Text>
                )}
              </View>

              <View style={{ borderTopWidth: 1, borderTopColor: border, paddingTop: 18, gap: 12 }}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>Comunicação</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Text style={{ color: colors.muted, fontSize: 12, flex: 1 }}>
                    Gere e copie uma mensagem para enviar no WhatsApp.
                  </Text>
                  <Pressable
                    onPress={() => openMessage(selectedMember)}
                    style={{
                      borderRadius: radius.internal,
                      borderWidth: 1,
                      borderColor: border,
                      paddingHorizontal: 15,
                      paddingVertical: 9,
                    }}
                  >
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
                      Gerar mensagem
                    </Text>
                  </Pressable>
                </View>
              </View>
            </>
          ) : (
            <Text style={{ color: colors.muted }}>Nenhum membro selecionado.</Text>
          )}
        </View>
      </View>

      <ModalSheet
        visible={modalMode === "invite"}
        onClose={() => setModalMode(null)}
        position="center"
        cardStyle={{
          width: compact ? "100%" : 650,
          maxWidth: "100%",
          maxHeight: "88%",
          padding: 0,
          overflow: "hidden",
        }}
      >
        <View style={{ padding: 18, borderBottomWidth: 1, borderBottomColor: border, flexDirection: "row" }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: "800" }}>Convidar pessoa</Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>
              Defina o acesso inicial. Turmas específicas podem ser atribuídas após o aceite.
            </Text>
          </View>
          <Pressable onPress={() => setModalMode(null)}>
            <GoAtletaIcon name="close" size={22} color={colors.text} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 18, gap: 16 }}>
          <View style={{ flexDirection: compact ? "column" : "row", gap: 18 }}>
            <View style={{ flex: 1, gap: 14 }}>
              {inviteRole !== "student" ? (
                <View style={{ gap: 7 }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>E-mail</Text>
                  <TextInput
                    value={inviteEmail}
                    onChangeText={setInviteEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder="nome@exemplo.com"
                    placeholderTextColor={colors.placeholder}
                    style={{
                      borderRadius: radius.internal,
                      borderWidth: 1,
                      borderColor: border,
                      backgroundColor: colors.inputBg,
                      color: colors.inputText,
                      paddingHorizontal: 12,
                      paddingVertical: 11,
                    }}
                  />
                </View>
              ) : null}
              <View style={{ gap: 7 }}>
                <Text style={{ color: colors.text, fontWeight: "700" }}>Função</Text>
                <DropdownButton
                  value={inviteRole}
                  onChange={setInviteRole}
                  compact
                  options={[
                    { value: "professor", label: "Professor" },
                    { value: "intern", label: "Estagiário" },
                    { value: "moderator", label: "Coordenação" },
                    { value: "student", label: "Aluno" },
                  ]}
                />
              </View>
              <View style={{ gap: 7 }}>
                <Text style={{ color: colors.text, fontWeight: "700" }}>Turmas</Text>
                <View
                  style={{
                    borderRadius: radius.internal,
                    borderWidth: 1,
                    borderColor: border,
                    backgroundColor: inner,
                    padding: 12,
                  }}
                >
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {inviteRole === "student"
                      ? "O convite de aluno precisa ser vinculado a um aluno já cadastrado."
                      : "As turmas serão atribuídas depois que a pessoa aceitar o convite."}
                  </Text>
                </View>
              </View>
            </View>
            <View
              style={{
                flex: 1,
                borderLeftWidth: compact ? 0 : 1,
                borderTopWidth: compact ? 1 : 0,
                borderColor: border,
                paddingLeft: compact ? 0 : 18,
                paddingTop: compact ? 16 : 0,
                gap: 14,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "800" }}>Acesso que será concedido</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <GoAtletaIcon name="circle" size={8} color={colors.successText} />
                <Text style={{ color: colors.text }}>
                  {inviteRole === "moderator"
                    ? "Coordenação"
                    : inviteRole === "intern"
                      ? "Estagiário"
                      : inviteRole === "student"
                        ? "Aluno"
                        : "Professor"}
                </Text>
              </View>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {inviteRole === "moderator"
                  ? "Acesso administrativo completo à organização."
                  : inviteRole === "student"
                    ? "Selecione o aluno cadastrado para gerar um convite vinculado à matrícula correta."
                    : "Escolha abaixo exatamente quais áreas ficarão disponíveis após o aceite."}
              </Text>
              {inviteRole === "student" ? (
                <Pressable
                  onPress={() => {
                    setModalMode(null);
                    router.push("/coord/students" as never);
                  }}
                  style={{
                    borderRadius: radius.internal,
                    borderWidth: 1,
                    borderColor: border,
                    padding: 12,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "800" }}>
                    Selecionar aluno cadastrado
                  </Text>
                </Pressable>
              ) : inviteRole === "moderator" ? (
                <OverflowSummary
                  labels={MEMBER_PERMISSION_OPTIONS.map((option) => option.label)}
                  icon="shield"
                  limit={3}
                />
              ) : (
                <ScrollView
                  style={{
                    maxHeight: 250,
                    borderWidth: 1,
                    borderColor: border,
                    borderRadius: radius.internal,
                  }}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                >
                  {MEMBER_PERMISSION_OPTIONS.filter((option) => option.key !== "org_members").map(
                    (option) => {
                      const checked = invitePermissionKeys.includes(option.key);
                      return (
                        <Pressable
                          key={option.key}
                          onPress={() =>
                            setInvitePermissionKeys((current) =>
                              checked
                                ? current.filter((key) => key !== option.key)
                                : [...current, option.key]
                            )
                          }
                          style={{
                            padding: 10,
                            borderBottomWidth: 1,
                            borderBottomColor: border,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 9,
                          }}
                        >
                          <GoAtletaIcon
                            name={checked ? "checkbox" : "square"}
                            size={18}
                            color={checked ? colors.successText : colors.muted}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: colors.text, fontWeight: "700" }}>
                              {option.label}
                            </Text>
                            <Text style={{ color: colors.muted, fontSize: 11 }}>
                              {option.description}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    }
                  )}
                </ScrollView>
              )}
            </View>
          </View>
          {inviteResult ? (
            <View
              style={{
                borderRadius: radius.internal,
                borderWidth: 1,
                borderColor: colors.successBorder,
                backgroundColor: colors.successBg,
                padding: 12,
                gap: 8,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700" }}>
                {inviteEmailSent ? "Convite enviado por e-mail" : "Convite pronto e copiado"}
              </Text>
              <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 11 }}>
                {inviteResult}
              </Text>
            </View>
          ) : null}
        </ScrollView>
        <View
          style={{
            padding: 16,
            borderTopWidth: 1,
            borderTopColor: border,
            flexDirection: "row",
            justifyContent: "flex-end",
            gap: 10,
          }}
        >
          <Pressable
            onPress={() => setModalMode(null)}
            style={{
              borderRadius: radius.internal,
              borderWidth: 1,
              borderColor: border,
              paddingHorizontal: 18,
              paddingVertical: 10,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>Cancelar</Text>
          </Pressable>
          <Pressable
            disabled={inviteBusy}
            onPress={() => void submitInvite()}
            style={{
              borderRadius: radius.internal,
              backgroundColor: colors.primaryBg,
              paddingHorizontal: 20,
              paddingVertical: 10,
              opacity: inviteBusy ? 0.65 : 1,
            }}
          >
            <Text style={{ color: colors.primaryText, fontWeight: "800" }}>
              {inviteBusy
                ? "Enviando..."
                : inviteRole === "student"
                  ? "Selecionar aluno"
                  : "Enviar convite por e-mail"}
            </Text>
          </Pressable>
        </View>
      </ModalSheet>

      <ModalSheet
        visible={modalMode === "edit" && Boolean(modalMember)}
        onClose={() => setModalMode(null)}
        position="center"
        cardStyle={{
          width: compact ? "100%" : 760,
          maxWidth: "100%",
          maxHeight: "90%",
          padding: 0,
          overflow: "hidden",
        }}
      >
        <View style={{ padding: 18, borderBottomWidth: 1, borderBottomColor: border, flexDirection: "row" }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: "800" }}>
              Editar perfil e permissões
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>
              {modalMember?.displayName}
            </Text>
          </View>
          <Pressable onPress={() => setModalMode(null)}>
            <GoAtletaIcon name="close" size={22} color={colors.text} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 18, gap: 18 }}>
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.text, fontWeight: "800" }}>Função</Text>
            <DropdownButton
              value={editRole}
              onChange={setEditRole}
              compact
              options={[
                { value: 5, label: "Estagiário" },
                { value: 10, label: "Professor" },
                { value: 50, label: "Coordenação" },
              ]}
            />
            {modalMember?.roleLevel && modalMember.roleLevel >= 50 ? (
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                O acesso administrativo existente não será reduzido por este formulário.
              </Text>
            ) : null}
          </View>
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.text, fontWeight: "800" }}>
              Turmas atribuídas ({editClassIds.length})
            </Text>
            <ScrollView
              style={{ maxHeight: 220, borderWidth: 1, borderColor: border, borderRadius: radius.internal }}
              showsVerticalScrollIndicator
              nestedScrollEnabled
            >
              {organizationClasses.map((item) => {
                const checked = editClassIds.includes(item.id);
                return (
                  <Pressable
                    key={item.id}
                    onPress={() =>
                      setEditClassIds((current) =>
                        checked ? current.filter((id) => id !== item.id) : [...current, item.id]
                      )
                    }
                    style={{
                      padding: 11,
                      borderBottomWidth: 1,
                      borderBottomColor: border,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <GoAtletaIcon
                      name={checked ? "checkbox" : "square"}
                      size={19}
                      color={checked ? colors.successText : colors.muted}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: "700" }}>{item.name}</Text>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>{item.unit}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.text, fontWeight: "800" }}>
              Permissões ({editPermissionKeys.length})
            </Text>
            {permissionLoading ? (
              <Text style={{ color: colors.muted }}>Carregando permissões...</Text>
            ) : (
              <ScrollView
                style={{ maxHeight: 240, borderWidth: 1, borderColor: border, borderRadius: radius.internal }}
                showsVerticalScrollIndicator
                nestedScrollEnabled
              >
                {MEMBER_PERMISSION_OPTIONS.map((option) => {
                  const checked = editPermissionKeys.includes(option.key);
                  return (
                    <Pressable
                      key={option.key}
                      onPress={() =>
                        setEditPermissionKeys((current) =>
                          checked
                            ? current.filter((key) => key !== option.key)
                            : [...current, option.key]
                        )
                      }
                      style={{
                        padding: 11,
                        borderBottomWidth: 1,
                        borderBottomColor: border,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <GoAtletaIcon
                        name={checked ? "checkbox" : "square"}
                        size={19}
                        color={checked ? colors.successText : colors.muted}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontWeight: "700" }}>{option.label}</Text>
                        <Text style={{ color: colors.muted, fontSize: 11 }}>{option.description}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </ScrollView>
        <View
          style={{
            padding: 16,
            borderTopWidth: 1,
            borderTopColor: border,
            flexDirection: "row",
            justifyContent: "flex-end",
            gap: 10,
          }}
        >
          <Pressable
            onPress={() => setModalMode(null)}
            style={{
              borderRadius: radius.internal,
              borderWidth: 1,
              borderColor: border,
              paddingHorizontal: 18,
              paddingVertical: 10,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>Cancelar</Text>
          </Pressable>
          <Pressable
            disabled={editBusy || permissionLoading}
            onPress={() => void submitEdit()}
            style={{
              borderRadius: radius.internal,
              backgroundColor: colors.primaryBg,
              paddingHorizontal: 20,
              paddingVertical: 10,
              opacity: editBusy || permissionLoading ? 0.65 : 1,
            }}
          >
            <Text style={{ color: colors.primaryText, fontWeight: "800" }}>
              {editBusy ? "Salvando..." : "Salvar alterações"}
            </Text>
          </Pressable>
        </View>
      </ModalSheet>

      <ModalSheet
        visible={modalMode === "message" && Boolean(modalMember)}
        onClose={() => setModalMode(null)}
        position="center"
        cardStyle={{ width: compact ? "100%" : 520, maxWidth: "100%", padding: 18, gap: 16 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: "800", flex: 1 }}>
            Mensagem para {modalMember?.displayName.split(" ")[0]}
          </Text>
          <Pressable onPress={() => setModalMode(null)}>
            <GoAtletaIcon name="close" size={22} color={colors.text} />
          </Pressable>
        </View>
        <View
          style={{
            borderRadius: radius.internal,
            borderWidth: 1,
            borderColor: border,
            backgroundColor: inner,
            padding: 14,
          }}
        >
          <Text style={{ color: colors.text, lineHeight: 21 }}>{messageText}</Text>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10 }}>
          <Pressable
            onPress={() => setModalMode(null)}
            style={{
              borderRadius: radius.internal,
              borderWidth: 1,
              borderColor: border,
              paddingHorizontal: 18,
              paddingVertical: 10,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>Fechar</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              void Clipboard.setStringAsync(messageText);
              Alert.alert("Mensagem copiada", "Agora você pode enviar pelo WhatsApp.");
            }}
            style={{
              borderRadius: radius.internal,
              backgroundColor: colors.primaryBg,
              paddingHorizontal: 18,
              paddingVertical: 10,
              flexDirection: "row",
              gap: 8,
            }}
          >
            <GoAtletaIcon name="copy" size={16} color={colors.primaryText} />
            <Text style={{ color: colors.primaryText, fontWeight: "800" }}>Copiar mensagem</Text>
          </Pressable>
        </View>
      </ModalSheet>
    </View>
  );
}
