import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    FlatList,
    LayoutAnimation,
    Platform,
    RefreshControl,
    ScrollView,
    Text,
    TextInput,
    UIManager,
    View,
    useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
    generateTrainerMessage,
    type TrainerMessageResult,
    type TrainerMessageTone,
} from "../../api/ai";
import {
    MEMBER_PERMISSION_OPTIONS,
    MemberClassHead,
    MemberPermission,
    MemberPermissionKey,
    OrgClass,
    OrgMember,
    adminListMemberPermissions,
    adminListOrgClasses,
    adminListOrgMemberClassHeads,
    adminListOrgMembers,
    adminRemoveOrgMember,
    adminSetMemberClassHeads,
    adminSetMemberPermission,
    adminUpdateMemberRole,
} from "../../api/members";
import { useAuth } from "../../auth/auth";
import { useEffectiveProfile } from "../../core/effective-profile";
import { useOrganization } from "../../providers/OrganizationProvider";
import { ModalSheet } from "../../ui/ModalSheet";
import { Pressable } from "../../ui/Pressable";
import { ShimmerBlock } from "../../ui/Shimmer";
import { useAppTheme } from "../../ui/app-theme";
import { useModalCardStyle } from "../../ui/use-modal-card-style";

type RoleLevel = 5 | 10 | 50;
type SectionKey = "role" | "classes" | "permissions";
type QuickInviteTarget = "collaborator" | "student" | "moderator";

const ROLE_OPTIONS: { label: string; value: RoleLevel; summary: string }[] = [
  { label: "Estagi\u00e1rio", value: 5, summary: "Acesso operacional b\u00e1sico" },
  { label: "Professor", value: 10, summary: "Acesso completo \u00e0s telas de trabalho" },
  { label: "Coordena\u00e7\u00e3o", value: 50, summary: "Acesso administrativo da organiza\u00e7\u00e3o" },
];

const trainerToneOptions: { value: TrainerMessageTone; label: string }[] = [
  { value: "friendly", label: "Amigável" },
  { value: "firm", label: "Firme" },
  { value: "formal", label: "Formal" },
  { value: "urgent", label: "Urgente" },
];

const roleLabel = (roleLevel: number) => {
  if (roleLevel >= 50) return "Coordena\u00e7\u00e3o";
  if (roleLevel >= 10) return "Professor";
  return "Estagi\u00e1rio";
};

const roleColor = (roleLevel: number, colors: ReturnType<typeof useAppTheme>["colors"]) => {
  if (roleLevel >= 50) {
    return { bg: colors.primaryBg, text: colors.primaryText };
  }
  if (roleLevel >= 10) {
    return { bg: colors.secondaryBg, text: colors.text };
  }
  return { bg: colors.warningBg, text: colors.text };
};

const formatJoinedAt = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const shortUuid = (value: string) => {
  if (!value) return value;
  if (value.length < 12) return value;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
};

const getInitials = (name: string) => {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return "US";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "US";
};

const asSortedUniqueIds = (values: string[]) => Array.from(new Set(values)).sort();

const hasSameIds = (left: string[], right: string[]) => {
  if (left.length !== right.length) return false;
  const leftSorted = asSortedUniqueIds(left);
  const rightSorted = asSortedUniqueIds(right);
  return leftSorted.every((value, index) => value === rightSorted[index]);
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

const toUiError = (err: unknown) => {
  const message = parseRpcErrorMessage(err);
  if (message.includes("Member has responsible classes")) {
    return "Este membro ainda \u00e9 respons\u00e1vel por turmas. Reatribua as turmas antes de continuar.";
  }
  if (message.includes("Invalid class assignment")) {
    return "Selecione apenas turmas desta organiza\u00e7\u00e3o para atribuir responsabilidade.";
  }
  if (message.includes("Member role not eligible for class responsibility")) {
    return "O cargo atual deste membro n\u00e3o permite responsabilidade de turmas.";
  }
  return humanizeRpcError(message);
};

const humanizeRpcError = (message: string) => {
  if (message.includes("Not authorized")) {
    return "Voc\u00ea n\u00e3o tem permiss\u00e3o para gerenciar membros desta organiza\u00e7\u00e3o.";
  }
  if (message.includes("Invalid role_level")) {
    return "Cargo inv\u00e1lido.";
  }
  if (message.includes("Invalid permission_key")) {
    return "Permiss\u00e3o inv\u00e1lida.";
  }
  if (message.includes("Member not found")) {
    return "Membro n\u00e3o encontrado.";
  }
  if (message.includes("Cannot demote last admin")) {
    return "N\u00e3o \u00e9 poss\u00edvel rebaixar o \u00faltimo admin da organiza\u00e7\u00e3o.";
  }
  if (message.includes("Cannot remove last admin")) {
    return "N\u00e3o \u00e9 poss\u00edvel remover o \u00faltimo admin da organiza\u00e7\u00e3o.";
  }
  if (message.includes("Cannot remove yourself")) {
    return "Voc\u00ea n\u00e3o pode remover a si mesmo.";
  }
  if (message.includes("Cannot disable own org_members permission")) {
    return "Voc\u00ea n\u00e3o pode remover sua pr\u00f3pria permiss\u00e3o de gest\u00e3o de membros.";
  }
  return message || "N\u00e3o foi poss\u00edvel concluir a a\u00e7\u00e3o.";
};

export function OrgMembersPanel({ embedded = false }: { embedded?: boolean } = {}) {
  const router = useRouter();
  const profile = useEffectiveProfile();
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const { session } = useAuth();
  const { activeOrganization, isLoading: organizationLoading } = useOrganization();
  const sheetCardStyle = useModalCardStyle({
    maxHeight: "88%",
    maxWidth: 760,
  });

  const isCompact = width < 900;
  const organizationId = activeOrganization?.id ?? null;
  const organizationName = activeOrganization?.name ?? "Organiza\u00e7\u00e3o";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<OrgMember | null>(null);
  const [showMemberSheet, setShowMemberSheet] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionBusyKey, setPermissionBusyKey] = useState<MemberPermissionKey | null>(null);
  const [permissions, setPermissions] = useState<Partial<Record<MemberPermissionKey, boolean>>>({});
  const [memberBusy, setMemberBusy] = useState(false);
  const [classHeadBusy, setClassHeadBusy] = useState(false);
  const [classHeadsLoading, setClassHeadsLoading] = useState(true);
  const [orgClasses, setOrgClasses] = useState<OrgClass[]>([]);
  const [memberClassHeads, setMemberClassHeads] = useState<MemberClassHead[]>([]);
  const [classHeadInitialIds, setClassHeadInitialIds] = useState<string[]>([]);
  const [classHeadDraftIds, setClassHeadDraftIds] = useState<string[]>([]);
  const [expandedSections, setExpandedSections] = useState<Record<SectionKey, boolean>>({
    role: true,
    classes: true,
    permissions: true,
  });
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [memberTrainerTone, setMemberTrainerTone] = useState<TrainerMessageTone>("formal");
  const [memberTrainerBusy, setMemberTrainerBusy] = useState(false);
  const [memberTrainerMessage, setMemberTrainerMessage] = useState<TrainerMessageResult | null>(null);
  const [memberTrainerFeedback, setMemberTrainerFeedback] = useState<string | null>(null);
  const [showInviteSheet, setShowInviteSheet] = useState(false);
  const [inviteTarget, setInviteTarget] = useState<QuickInviteTarget>("collaborator");
  const [inviteRecipient, setInviteRecipient] = useState("");
  const latestLoadRequestRef = useRef(0);

  const adminsCount = useMemo(
    () => members.filter((member) => member.roleLevel >= 50).length,
    [members]
  );

  const filteredMembers = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return members;
    return members.filter((member) => {
      const text = `${member.displayName} ${member.email ?? ""} ${member.userId}`.toLowerCase();
      return text.includes(normalized);
    });
  }, [members, search]);

  const classHeadsByUser = useMemo(() => {
    const map = new Map<string, MemberClassHead[]>();
    memberClassHeads.forEach((row) => {
      const current = map.get(row.userId) ?? [];
      current.push(row);
      map.set(row.userId, current);
    });
    map.forEach((rows) => rows.sort((left, right) => left.className.localeCompare(right.className)));
    return map;
  }, [memberClassHeads]);

  const classHeadByClassId = useMemo(() => {
    const map = new Map<string, MemberClassHead>();
    memberClassHeads.forEach((row) => {
      map.set(row.classId, row);
    });
    return map;
  }, [memberClassHeads]);

  const memberById = useMemo(() => {
    const map = new Map<string, OrgMember>();
    members.forEach((member) => map.set(member.userId, member));
    return map;
  }, [members]);

  const selectedMemberClassHeadIds = useMemo(() => {
    if (!selectedMember) return [];
    return (classHeadsByUser.get(selectedMember.userId) ?? []).map((row) => row.classId);
  }, [classHeadsByUser, selectedMember]);

  const classHeadSelectionDirty = useMemo(
    () => !hasSameIds(classHeadDraftIds, classHeadInitialIds),
    [classHeadDraftIds, classHeadInitialIds]
  );
  const showInitialShimmer = loading && members.length === 0;
  const enabledPermissionsCount = useMemo(
    () =>
      MEMBER_PERMISSION_OPTIONS.reduce(
        (count, option) => count + (permissions[option.key] !== false ? 1 : 0),
        0
      ),
    [permissions]
  );

  useEffect(() => {
    if (profile !== "admin") {
      router.replace("/");
    }
  }, [profile, router]);

  useEffect(() => {
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    const nextIds = asSortedUniqueIds(selectedMemberClassHeadIds);
    setClassHeadInitialIds(nextIds);
    setClassHeadDraftIds(nextIds);
  }, [selectedMemberClassHeadIds, selectedMember?.userId]);

  const loadMembers = useCallback(async (options?: { soft?: boolean }) => {
    const soft = options?.soft ?? false;
    const requestId = ++latestLoadRequestRef.current;

    if (!organizationId) {
      if (organizationLoading) {
        if (!soft) {
          setLoading(true);
        }
        return;
      }
      setLoading(false);
      setRefreshing(false);
      setClassHeadsLoading(false);
      setMembers([]);
      setOrgClasses([]);
      setMemberClassHeads([]);
      setSelectedMember(null);
      return;
    }

    if (soft) {
      setRefreshing(true);
    } else {
      setLoading(true);
      setClassHeadsLoading(true);
    }
    setError(null);
    try {
      const [rows, classes, heads] = await Promise.all([
        adminListOrgMembers(organizationId),
        adminListOrgClasses(organizationId),
        adminListOrgMemberClassHeads(organizationId),
      ]);
      if (requestId !== latestLoadRequestRef.current) return;
      setMembers(rows);
      setOrgClasses(classes);
      setMemberClassHeads(heads);
      setLastUpdatedAt(
        new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
      setSelectedMember((current) =>
        current ? rows.find((row) => row.userId === current.userId) ?? null : null
      );
    } catch (err) {
      if (requestId !== latestLoadRequestRef.current) return;
      setError(toUiError(err));
      if (!soft) {
        setMembers([]);
        setOrgClasses([]);
        setMemberClassHeads([]);
      }
    } finally {
      if (requestId !== latestLoadRequestRef.current) return;
      if (soft) {
        setRefreshing(false);
      } else {
        setLoading(false);
        setClassHeadsLoading(false);
      }
    }
  }, [organizationId, organizationLoading]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const loadMemberPermissions = useCallback(
    async (member: OrgMember) => {
      if (!organizationId) return;
      setPermissionsLoading(true);
      setError(null);
      try {
        const rows = await adminListMemberPermissions(organizationId, member.userId);
        const mapped: Partial<Record<MemberPermissionKey, boolean>> = {};
        rows.forEach((row: MemberPermission) => {
          mapped[row.permissionKey] = row.isAllowed;
        });
        setPermissions(mapped);
      } catch (err) {
        setError(toUiError(err));
        setPermissions({});
      } finally {
        setPermissionsLoading(false);
      }
    },
    [organizationId]
  );

  const openMemberDetails = (member: OrgMember) => {
    const nextIds = asSortedUniqueIds(
      (classHeadsByUser.get(member.userId) ?? []).map((row) => row.classId)
    );
    setSelectedMember(member);
    setShowRoleMenu(false);
    setPermissions({});
    setPermissionsLoading(true);
    setClassHeadInitialIds(nextIds);
    setClassHeadDraftIds(nextIds);
    setClassHeadBusy(false);
    setExpandedSections({
      role: true,
      classes: true,
      permissions: true,
    });
    setShowMemberSheet(true);
    void loadMemberPermissions(member);
  };

  const animateExpandCollapse = useCallback(() => {
    LayoutAnimation.configureNext({
      duration: 190,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });
  }, []);

  const toggleSection = (key: SectionKey) => {
    animateExpandCollapse();
    setExpandedSections((current) => ({ ...current, [key]: !current[key] }));
  };

  const currentMemberIsSelf = selectedMember?.userId === session?.user?.id;
  const currentMemberIsLastAdmin =
    Boolean(selectedMember) && selectedMember.roleLevel >= 50 && adminsCount <= 1;
  const selectedMemberCanManageClasses = Boolean(selectedMember) && selectedMember.roleLevel >= 10;
  const selectedMemberIsProfessor =
    Boolean(selectedMember) && selectedMember.roleLevel >= 10 && selectedMember.roleLevel < 50;

  const onGenerateProfessorMessage = useCallback(async () => {
    if (!selectedMember || !selectedMemberIsProfessor) return;

    setMemberTrainerBusy(true);
    setMemberTrainerFeedback(null);
    try {
      const assignedClasses = classHeadsByUser.get(selectedMember.userId) ?? [];
      const primaryClass = assignedClasses[0];
      const pendingItems =
        assignedClasses.length > 0
          ? assignedClasses.slice(0, 4).map((item) => `Turma responsável: ${item.className}`)
          : ["Atualizar status da turma da semana"];

      const generated = await generateTrainerMessage(
        {
          organizationName,
          unit: primaryClass?.unit ?? organizationName,
          className: primaryClass?.className ?? `Turmas de ${selectedMember.displayName}`,
          lastReportAt: null,
          daysWithoutReport: 0,
          pendingItems,
          expectedSla: "Atualização semanal da turma",
        },
        memberTrainerTone,
        {
          cache: {
            organizationId,
            periodLabel: "Coordenação - mensagens membros",
            scope: `${selectedMember.userId}:${memberTrainerTone}`,
            ttlMs: 120_000,
          },
        }
      );

      setMemberTrainerMessage(generated);
      await Clipboard.setStringAsync(generated.whatsapp || generated.oneLiner || generated.email || "");
      setMemberTrainerFeedback("Mensagem gerada e copiada para WhatsApp.");
    } catch (err) {
      setMemberTrainerFeedback(
        err instanceof Error ? `Falha ao gerar mensagem: ${err.message}` : "Falha ao gerar mensagem."
      );
    } finally {
      setMemberTrainerBusy(false);
    }
  }, [classHeadsByUser, memberTrainerTone, organizationId, organizationName, selectedMember, selectedMemberIsProfessor]);

  const onCopyProfessorWhatsapp = useCallback(async () => {
    const content =
      memberTrainerMessage?.whatsapp?.trim() ||
      memberTrainerMessage?.oneLiner?.trim() ||
      memberTrainerMessage?.email?.trim() ||
      "";

    if (!content) {
      setMemberTrainerFeedback("Gere uma mensagem primeiro.");
      return;
    }

    await Clipboard.setStringAsync(content);
    setMemberTrainerFeedback("Texto copiado para WhatsApp.");
  }, [memberTrainerMessage]);

  const onChangeRole = async (nextRole: RoleLevel) => {
    if (!organizationId || !selectedMember) return;

    const isDemotion = selectedMember.roleLevel >= 50 && nextRole < 50;
    if (isDemotion && currentMemberIsLastAdmin) {
      setError("N\u00e3o \u00e9 poss\u00edvel rebaixar o \u00faltimo admin da organiza\u00e7\u00e3o.");
      return;
    }

    setMemberBusy(true);
    setError(null);
    setShowRoleMenu(false);
    try {
      await adminUpdateMemberRole(organizationId, selectedMember.userId, nextRole);
      await loadMembers({ soft: true });
    } catch (err) {
      setError(toUiError(err));
    } finally {
      setMemberBusy(false);
    }
  };

  const onTogglePermission = async (permissionKey: MemberPermissionKey, isAllowed: boolean) => {
    if (!organizationId || !selectedMember) return;

    if (permissionKey === "org_members" && currentMemberIsSelf && !isAllowed) {
      setError("Voc\u00ea n\u00e3o pode remover sua pr\u00f3pria permiss\u00e3o de gest\u00e3o de membros.");
      return;
    }

    setPermissionBusyKey(permissionKey);
    setError(null);
    try {
      await adminSetMemberPermission(organizationId, selectedMember.userId, permissionKey, isAllowed);
      setPermissions((prev) => ({ ...prev, [permissionKey]: isAllowed }));
    } catch (err) {
      setError(toUiError(err));
    } finally {
      setPermissionBusyKey(null);
    }
  };

  const onRemoveMember = () => {
    if (!organizationId || !selectedMember) return;

    Alert.alert(
      "Remover membro",
      `Deseja remover ${selectedMember.displayName} da organiza\u00e7\u00e3o?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: async () => {
            setMemberBusy(true);
            setError(null);
            try {
              await adminRemoveOrgMember(organizationId, selectedMember.userId);
              closeMemberSheet();
              setSelectedMember(null);
              await loadMembers({ soft: true });
            } catch (err) {
              setError(toUiError(err));
            } finally {
              setMemberBusy(false);
            }
          },
        },
      ]
    );
  };

  const onToggleClassDraft = (classId: string) => {
    setClassHeadDraftIds((current) => {
      if (current.includes(classId)) {
        return current.filter((value) => value !== classId);
      }
      return asSortedUniqueIds([...current, classId]);
    });
  };

  const onSaveClassHeads = async () => {
    if (!organizationId || !selectedMember || selectedMember.roleLevel < 10) return;

    setClassHeadBusy(true);
    setError(null);
    try {
      const nextIds = asSortedUniqueIds(classHeadDraftIds);
      await adminSetMemberClassHeads(organizationId, selectedMember.userId, nextIds);
      setClassHeadInitialIds(nextIds);
      await loadMembers({ soft: true });
    } catch (err) {
      setError(toUiError(err));
    } finally {
      setClassHeadBusy(false);
    }
  };

  const getMemberClassSummary = (member: OrgMember) => {
    if (member.roleLevel < 10) {
      return "Sem elegibilidade para responsabilidade de turmas.";
    }

    const classes = classHeadsByUser.get(member.userId) ?? [];
    if (classes.length === 0) {
      return "Sem turmas respons\u00e1veis.";
    }

    const preview = classes.slice(0, 2).map((row) => row.className).join(", ");
    const remaining = classes.length - 2;
    if (remaining > 0) {
      return `${classes.length} turmas: ${preview} +${remaining}`;
    }
    return `${classes.length} turmas: ${preview}`;
  };

  const statItems: { key: string; label: string; value: number; icon: string; tint: string }[] = [
  {
    key: "admin",
    label: "Coordena\u00e7\u00e3o",
    value: members.filter((m) => m.roleLevel >= 50).length,
    icon: "shield-checkmark-outline",
    tint: colors.primaryBg,
  },
  {
    key: "teacher",
    label: "Professor",
    value: members.filter((m) => m.roleLevel >= 10 && m.roleLevel < 50).length,
    icon: "school-outline",
    tint: "rgba(125, 211, 252, 0.24)",
  },
  {
    key: "intern",
    label: "Estagi\u00e1rio",
    value: members.filter((m) => m.roleLevel < 10).length,
    icon: "sparkles-outline",
    tint: "rgba(196, 181, 253, 0.24)",
  },
  {
    key: "total",
    label: "Total",
    value: members.length,
    icon: "people-outline",
    tint: "rgba(250, 204, 21, 0.2)",
  },
];

  const closeMemberSheet = () => {
    setShowMemberSheet(false);
    setShowRoleMenu(false);
    const selectedIds = asSortedUniqueIds(selectedMemberClassHeadIds);
    setClassHeadDraftIds(selectedIds);
    setClassHeadInitialIds(selectedIds);
    setClassHeadBusy(false);
    setExpandedSections({
      role: true,
      classes: true,
      permissions: true,
    });
    setMemberTrainerBusy(false);
    setMemberTrainerMessage(null);
    setMemberTrainerFeedback(null);
    setMemberTrainerTone("formal");
  };

  const quickInviteOptions: {
    key: QuickInviteTarget;
    label: string;
    subtitle: string;
    icon: keyof typeof Ionicons.glyphMap;
  }[] = [
    {
      key: "collaborator",
      label: "Colaborador",
      subtitle: "Professor ou estagiário para apoiar as turmas.",
      icon: "people-outline",
    },
    {
      key: "student",
      label: "Aluno",
      subtitle: "Convidar para acesso ao plano e rotina de treino.",
      icon: "school-outline",
    },
    {
      key: "moderator",
      label: "Moderador",
      subtitle: "Perfil de coordenação para gestão da organização.",
      icon: "shield-checkmark-outline",
    },
  ];

  const inviteRoleLabel: Record<QuickInviteTarget, string> = {
    collaborator: "Colaborador",
    student: "Aluno",
    moderator: "Moderador",
  };

  const buildQuickInviteText = (target: QuickInviteTarget) => {
    const recipient = inviteRecipient.trim();
    const baseGreeting = recipient ? `Olá, ${recipient}!` : "Olá!";

    if (target === "student") {
      return `${baseGreeting}\n\nVocê foi convidado para participar da organização ${organizationName} no GoAtleta como aluno(a).\n\nA coordenação vai enviar seu link de acesso individual em seguida.`;
    }

    const roleHint =
      target === "moderator" ? "Moderador (coordenação)" : "Colaborador (professor/estagiário)";

    return `${baseGreeting}\n\nVocê foi convidado para a organização ${organizationName} no GoAtleta, com perfil ${roleHint}.\n\n1) Crie sua conta no app\n2) Entre com seu e-mail\n3) Avise a coordenação para liberar seu cargo na aba de membros`;
  };

  const onCopyQuickInvite = async () => {
    try {
      await Clipboard.setStringAsync(buildQuickInviteText(inviteTarget));
      Alert.alert("Convite pronto", "Mensagem copiada para compartilhar.");
    } catch {
      Alert.alert("Erro", "Não foi possível copiar a mensagem.");
    }
  };

  const onContinueQuickInvite = () => {
    if (inviteTarget === "student") {
      setShowInviteSheet(false);
      router.push("/students");
      return;
    }

    setShowInviteSheet(false);
    Alert.alert(
      "Próximo passo",
      "Depois do cadastro da pessoa no app, selecione o membro nesta tela para ajustar cargo e permissões."
    );
  };

  const Container = embedded ? View : SafeAreaView;

  return (
    <Container style={{ flex: 1, backgroundColor: colors.background }}>
    <FlatList
      data={loading && members.length === 0 ? [] : filteredMembers}
      keyExtractor={(item) => item.userId}
      renderItem={({ item: member }) => {
        const badge = roleColor(member.roleLevel, colors);
        const subtitle = member.email ?? "Sem e-mail cadastrado";
        const classSummary = getMemberClassSummary(member);
        const isClassEligible = member.roleLevel >= 10;
        return (
          <Pressable
            onPress={() => openMemberDetails(member)}
            style={{
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              padding: 12,
              gap: 10,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.secondaryBg,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>
                    {getInitials(member.displayName)}
                  </Text>
                </View>

                <View style={{ flex: 1, gap: 3 }}>
                  <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "800", fontSize: 16 }}>
                    {member.displayName}
                  </Text>
                  <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 13 }}>
                    {subtitle}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    Entrou em {formatJoinedAt(member.createdAt)}
                  </Text>
                </View>
              </View>

              <View style={{ alignItems: "flex-end", gap: 6 }}>
                <View
                  style={{
                    borderRadius: 999,
                    backgroundColor: badge.bg,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                  }}
                >
                  <Text style={{ color: badge.text, fontWeight: "700", fontSize: 11 }}>
                    {roleLabel(member.roleLevel)}
                  </Text>
                </View>
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.secondaryBg,
                  }}
                >
                  <Ionicons name="chevron-forward" size={14} color={colors.muted} />
                </View>
              </View>
            </View>

            <View style={{ gap: 4 }}>
              <Text
                style={{
                  color: isClassEligible ? colors.text : colors.muted,
                  fontSize: 12,
                  fontWeight: isClassEligible ? "600" : "500",
                }}
              >
                {classSummary}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {"Toque para editar cargo, turmas e permiss\u00f5es de telas."}
              </Text>
            </View>
          </Pressable>
        );
      }}
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      updateCellsBatchingPeriod={40}
      windowSize={8}
      removeClippedSubviews={Platform.OS !== "web"}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void loadMembers({ soft: true })}
          tintColor={colors.text}
          colors={[colors.text]}
        />
      }
      ListHeaderComponent={
        <View style={{ gap: 12, marginBottom: filteredMembers.length > 0 && !loading ? 10 : 0 }}>
          <View
            style={{
              borderRadius: 20,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              padding: isCompact ? 14 : 16,
              overflow: "hidden",
              gap: 6,
            }}
          >
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                width: 170,
                height: 170,
                borderRadius: 85,
                top: -96,
                right: -48,
                backgroundColor: colors.primaryBg,
                opacity: 0.16,
              }}
            />
            {showInitialShimmer ? (
              <View style={{ gap: 8 }}>
                <ShimmerBlock style={{ height: isCompact ? 36 : 40, width: "70%", borderRadius: 10 }} />
                <ShimmerBlock style={{ height: 18, width: "44%", borderRadius: 8 }} />
                <ShimmerBlock style={{ height: 14, width: "34%", borderRadius: 8 }} />
              </View>
            ) : (
              <>
                <Text
                  style={{
                    color: colors.text,
                    fontSize: isCompact ? 28 : 32,
                    fontWeight: "800",
                    lineHeight: isCompact ? 32 : 36,
                  }}
                >
                  {"Membros da organiza\u00e7\u00e3o"}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 14 }}>{organizationName}</Text>
                <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 0.3 }}>
                  {lastUpdatedAt ? `Atualizado \u00e0s ${lastUpdatedAt}` : "Painel administrativo"}
                </Text>
              </>
            )}
          </View>

          <View
            style={{
              borderRadius: 20,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              padding: 12,
              gap: 10,
            }}
          >
            {showInitialShimmer ? (
              <View style={{ gap: 10 }}>
                <ShimmerBlock style={{ height: 42, borderRadius: 12 }} />
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  {[0, 1, 2, 3].map((index) => (
                    <ShimmerBlock
                      key={`stats-shimmer-${index}`}
                      style={{
                        width: isCompact ? 118 : 126,
                        height: 74,
                        borderRadius: 14,
                      }}
                    />
                  ))}
                </View>
                <ShimmerBlock style={{ height: 38, width: 142, borderRadius: 999 }} />
              </View>
            ) : (
              <>
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 12,
                    backgroundColor: colors.inputBg,
                    paddingHorizontal: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Ionicons name="search" size={16} color={colors.muted} />
                  <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Buscar por nome, e-mail ou ID"
                    placeholderTextColor={colors.placeholder}
                    style={{
                      flex: 1,
                      color: colors.inputText,
                      paddingVertical: 10,
                      fontSize: 15,
                    }}
                  />
                </View>

                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  {statItems.map((item) => (
                    <View
                      key={item.key}
                      style={{
                        minWidth: 90,
                        flex: 1,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.secondaryBg,
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        gap: 5,
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <Text style={{ color: colors.text, fontWeight: "800", fontSize: 20, lineHeight: 22 }}>
                          {item.value}
                        </Text>
                        <View
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 12,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: item.tint,
                          }}
                        >
                          <Ionicons name={item.icon as any} size={13} color={colors.text} />
                        </View>
                      </View>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>{item.label}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>

          {error && !showInitialShimmer ? (
            <View
              style={{
                borderRadius: 18,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                padding: 12,
                gap: 6,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="alert-circle-outline" size={17} color={colors.warningBg} />
                <Text style={{ color: colors.text, fontWeight: "700" }}>Erro</Text>
              </View>
              <Text style={{ color: colors.muted }}>{error}</Text>
            </View>
          ) : null}

          {loading && members.length === 0 ? (
            <View style={{ gap: 8 }}>
              {[0, 1, 2, 3, 4].map((skeleton) => (
                <ShimmerBlock
                  key={`member-loading-${skeleton}`}
                  style={{ height: skeleton === 0 ? 112 : 98, borderRadius: 16 }}
                />
              ))}
            </View>
          ) : null}

          {!loading && filteredMembers.length === 0 ? (
            <View
              style={{
                borderRadius: 18,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                padding: 14,
              }}
            >
              <Text style={{ color: colors.muted }}>Nenhum membro encontrado.</Text>
            </View>
          ) : null}
        </View>
      }
      contentContainerStyle={{
        paddingHorizontal: isCompact ? 14 : 16,
        paddingTop: 12,
        paddingBottom: 120,
      }}
    />

      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          right: isCompact ? 14 : 18,
          bottom: embedded ? 16 : 24,
          alignItems: "flex-end",
        }}
      >
        <Pressable
          onPress={() => setShowInviteSheet(true)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            paddingVertical: 10,
            paddingLeft: 10,
            paddingRight: 14,
            shadowColor: "#000",
            shadowOpacity: 0.12,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: 6,
          }}
        >
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.primaryBg,
            }}
          >
            <Ionicons name="add" size={17} color={colors.primaryText} />
          </View>
          <View style={{ gap: 1 }}>
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 13 }}>Convidar</Text>
            <Text style={{ color: colors.muted, fontSize: 11 }}>Membros e alunos</Text>
          </View>
        </Pressable>
      </View>

      <ModalSheet
        visible={showInviteSheet}
        onClose={() => setShowInviteSheet(false)}
        cardStyle={sheetCardStyle}
        position="center"
      >
        <View style={{ gap: 12 }}>
          <View style={{ gap: 4 }}>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}>
              Convidar pessoas
            </Text>
            <Text style={{ color: colors.muted }}>
              Escolha o perfil e compartilhe uma mensagem de convite.
            </Text>
          </View>

          <View style={{ gap: 8 }}>
            {quickInviteOptions.map((option) => {
              const selected = inviteTarget === option.key;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setInviteTarget(option.key)}
                  style={{
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: selected ? colors.primaryBg : colors.border,
                    backgroundColor: selected ? colors.primaryBg : colors.card,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    flexDirection: "row",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: selected ? colors.card : colors.secondaryBg,
                    }}
                  >
                    <Ionicons
                      name={option.icon}
                      size={16}
                      color={selected ? colors.text : colors.muted}
                    />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text
                      style={{
                        color: selected ? colors.primaryText : colors.text,
                        fontWeight: "800",
                      }}
                    >
                      {option.label}
                    </Text>
                    <Text
                      style={{
                        color: selected ? colors.primaryText : colors.muted,
                        fontSize: 12,
                      }}
                    >
                      {option.subtitle}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.text, fontWeight: "700" }}>Nome (opcional)</Text>
            <TextInput
              value={inviteRecipient}
              onChangeText={setInviteRecipient}
              placeholder="Para personalizar a mensagem"
              placeholderTextColor={colors.placeholder}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                backgroundColor: colors.inputBg,
                color: colors.inputText,
                paddingHorizontal: 12,
                paddingVertical: 10,
              }}
            />
          </View>

          <View
            style={{
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.secondaryBg,
              padding: 10,
              gap: 4,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
              Perfil selecionado: {inviteRoleLabel[inviteTarget]}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {inviteTarget === "student"
                ? "Use a área de alunos para gerar o convite individual."
                : "Após o cadastro, ajuste cargo e permissões do membro nesta tela."}
            </Text>
          </View>

          <View style={{ flexDirection: isCompact ? "column" : "row", gap: 8 }}>
            <Pressable
              onPress={() => setShowInviteSheet(false)}
              style={{
                flex: 1,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.secondaryBg,
                alignItems: "center",
                paddingVertical: 11,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700" }}>Fechar</Text>
            </Pressable>

            <Pressable
              onPress={() => void onCopyQuickInvite()}
              style={{
                flex: 1,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                alignItems: "center",
                paddingVertical: 11,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "800" }}>Copiar mensagem</Text>
            </Pressable>

            <Pressable
              onPress={onContinueQuickInvite}
              style={{
                flex: 1,
                borderRadius: 12,
                backgroundColor: colors.primaryBg,
                alignItems: "center",
                paddingVertical: 11,
              }}
            >
              <Text style={{ color: colors.primaryText, fontWeight: "800" }}>
                {inviteTarget === "student" ? "Abrir Alunos" : "Continuar"}
              </Text>
            </Pressable>
          </View>
        </View>
      </ModalSheet>

      <ModalSheet
        visible={showMemberSheet && !!selectedMember}
        onClose={closeMemberSheet}
        cardStyle={[sheetCardStyle, { overflow: "hidden" }]}
        position="center"
      >
        {selectedMember ? (
          <ScrollView
            style={{ width: "100%" }}
            contentContainerStyle={{ gap: 12 }}
            showsVerticalScrollIndicator={false}
          >
            <View style={{ position: "relative" }}>
              {permissionsLoading ? (
                <View style={{ gap: 12 }}>
                  <View style={{ gap: 8 }}>
                    <ShimmerBlock style={{ height: 30, width: "62%", borderRadius: 10 }} />
                    <ShimmerBlock style={{ height: 20, width: "76%", borderRadius: 8 }} />
                    <ShimmerBlock style={{ height: 14, width: "52%", borderRadius: 8 }} />
                    <ShimmerBlock style={{ height: 14, width: "42%", borderRadius: 8 }} />
                  </View>

                  <View
                    style={{
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.secondaryBg,
                      padding: 10,
                      gap: 8,
                    }}
                  >
                    <ShimmerBlock style={{ height: 20, width: 80, borderRadius: 8 }} />
                    <ShimmerBlock style={{ height: 46, borderRadius: 12 }} />
                    <ShimmerBlock style={{ height: 12, width: "74%", borderRadius: 6 }} />
                  </View>

                  <View
                    style={{
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.secondaryBg,
                      padding: 10,
                      gap: 10,
                    }}
                  >
                    <ShimmerBlock style={{ height: 20, width: 160, borderRadius: 8 }} />
                    {[0, 1, 2, 3, 4].map((index) => (
                      <ShimmerBlock
                        key={`permission-skeleton-${index}`}
                        style={{ height: 64, borderRadius: 12 }}
                      />
                    ))}
                  </View>

                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                    <ShimmerBlock style={{ flex: 1, height: 44, borderRadius: 12 }} />
                    <ShimmerBlock style={{ flex: 1, height: 44, borderRadius: 12 }} />
                  </View>
                </View>
              ) : null}

              <View style={{ display: permissionsLoading ? "none" : "flex", gap: 12 }}>
                <View style={{ gap: 4 }}>
                  <Text style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}>
                    {selectedMember.displayName}
                  </Text>
                  <Text style={{ color: colors.muted }}>{selectedMember.email || "Sem e-mail cadastrado"}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    ID interno: {shortUuid(selectedMember.userId)}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    Entrou em {formatJoinedAt(selectedMember.createdAt)}
                  </Text>
                </View>

                <View
                  style={{
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.secondaryBg,
                    overflow: "hidden",
                  }}
                >
                  <Pressable
                    onPress={() => {
                      if (expandedSections.role) setShowRoleMenu(false);
                      toggleSection("role");
                    }}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 10,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <View style={{ gap: 2, flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: "700" }}>Cargo</Text>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>
                        Atual: {roleLabel(selectedMember.roleLevel)}
                      </Text>
                    </View>
                    <Ionicons
                      name={expandedSections.role ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={colors.muted}
                    />
                  </Pressable>

                  {expandedSections.role ? (
                    <View
                      style={{
                        borderTopWidth: 1,
                        borderTopColor: colors.border,
                        padding: 10,
                        gap: 8,
                      }}
                    >
                      <Pressable
                        disabled={memberBusy}
                        onPress={() => {
                          animateExpandCollapse();
                          setShowRoleMenu((value) => !value);
                        }}
                        style={{
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: colors.card,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <Text style={{ color: colors.text, fontWeight: "700" }}>
                          {roleLabel(selectedMember.roleLevel)}
                        </Text>
                        <Ionicons
                          name={showRoleMenu ? "chevron-up" : "chevron-down"}
                          size={16}
                          color={colors.muted}
                        />
                      </Pressable>

                      {showRoleMenu ? (
                        <View
                          style={{
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: colors.card,
                            overflow: "hidden",
                          }}
                        >
                          {ROLE_OPTIONS.map((option, index) => {
                            const isCurrent = selectedMember.roleLevel === option.value;
                            const disableDemotion =
                              selectedMember.roleLevel >= 50 && option.value < 50 && currentMemberIsLastAdmin;
                            const disabled = memberBusy || isCurrent || disableDemotion;

                            return (
                              <Pressable
                                key={option.value}
                                disabled={disabled}
                                onPress={() => void onChangeRole(option.value)}
                                style={{
                                  paddingHorizontal: 12,
                                  paddingVertical: 10,
                                  borderTopWidth: index === 0 ? 0 : 1,
                                  borderTopColor: colors.border,
                                  backgroundColor: isCurrent ? colors.primaryBg : colors.card,
                                  opacity: disabled ? 0.6 : 1,
                                  gap: 2,
                                }}
                              >
                                <Text
                                  style={{
                                    color: isCurrent ? colors.primaryText : colors.text,
                                    fontWeight: "700",
                                  }}
                                >
                                  {option.label}
                                </Text>
                                <Text
                                  style={{
                                    color: isCurrent ? colors.primaryText : colors.muted,
                                    fontSize: 12,
                                  }}
                                >
                                  {option.summary}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      ) : null}

                      {currentMemberIsLastAdmin ? (
                        <Text style={{ color: colors.muted, fontSize: 12 }}>
                          {"\u00daltimo admin da organiza\u00e7\u00e3o: n\u00e3o pode ser removido ou rebaixado."}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                </View>

                <View
                  style={{
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.secondaryBg,
                    overflow: "hidden",
                  }}
                >
                  <Pressable
                    onPress={() => toggleSection("classes")}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 10,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <View style={{ gap: 2, flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: "700" }}>
                        {"Turmas respons\u00e1veis"}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>
                        {classHeadDraftIds.length} selecionada(s)
                      </Text>
                    </View>
                    <Ionicons
                      name={expandedSections.classes ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={colors.muted}
                    />
                  </Pressable>

                  {expandedSections.classes ? (
                    <View
                      style={{
                        borderTopWidth: 1,
                        borderTopColor: colors.border,
                        padding: 10,
                        gap: 10,
                      }}
                    >
                      {classHeadsLoading ? (
                        <View style={{ gap: 8 }}>
                          {[0, 1, 2].map((index) => (
                            <ShimmerBlock key={`class-head-skeleton-${index}`} style={{ height: 60, borderRadius: 12 }} />
                          ))}
                        </View>
                      ) : !selectedMemberCanManageClasses ? (
                        <Text style={{ color: colors.muted, fontSize: 12 }}>
                          {"Este cargo n\u00e3o permite assumir turmas. Defina Professor ou Coordena\u00e7\u00e3o para editar."}
                        </Text>
                      ) : orgClasses.length === 0 ? (
                        <Text style={{ color: colors.muted, fontSize: 12 }}>
                          {"Nenhuma turma cadastrada nesta organiza\u00e7\u00e3o."}
                        </Text>
                      ) : (
                        <>
                          <Text style={{ color: colors.muted, fontSize: 12 }}>
                            {"Se a turma j\u00e1 tiver outro respons\u00e1vel, ela ser\u00e1 reatribu\u00edda ao salvar."}
                          </Text>

                          <ScrollView
                            style={{ maxHeight: 240 }}
                            contentContainerStyle={{ gap: 8 }}
                            nestedScrollEnabled
                            showsVerticalScrollIndicator={false}
                          >
                            {orgClasses.map((orgClass) => {
                              const checked = classHeadDraftIds.includes(orgClass.id);
                              const currentHead = classHeadByClassId.get(orgClass.id);
                              const currentHeadName = currentHead
                                ? memberById.get(currentHead.userId)?.displayName ?? shortUuid(currentHead.userId)
                                : null;
                              const assignedToSelected = currentHead?.userId === selectedMember.userId;
                              const willReassign = checked && !assignedToSelected && Boolean(currentHeadName);
                              const disabled = classHeadBusy || memberBusy;

                              return (
                                <Pressable
                                  key={orgClass.id}
                                  disabled={disabled}
                                  onPress={() => onToggleClassDraft(orgClass.id)}
                                  style={{
                                    borderRadius: 12,
                                    borderWidth: 1,
                                    borderColor: checked ? colors.primaryBg : colors.border,
                                    backgroundColor: colors.card,
                                    padding: 10,
                                    opacity: disabled ? 0.6 : 1,
                                    gap: 4,
                                  }}
                                >
                                  <View
                                    style={{
                                      flexDirection: "row",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                      gap: 10,
                                    }}
                                  >
                                    <View style={{ flex: 1, gap: 1 }}>
                                      <Text style={{ color: colors.text, fontWeight: "700" }}>
                                        {orgClass.name}
                                      </Text>
                                      <Text style={{ color: colors.muted, fontSize: 12 }}>
                                        {orgClass.unit}
                                      </Text>
                                    </View>

                                    <View
                                      style={{
                                        width: 22,
                                        height: 22,
                                        borderRadius: 999,
                                        borderWidth: 1,
                                        borderColor: checked ? colors.primaryBg : colors.border,
                                        backgroundColor: checked ? colors.primaryBg : colors.secondaryBg,
                                        alignItems: "center",
                                        justifyContent: "center",
                                      }}
                                    >
                                      {checked ? (
                                        <Ionicons name="checkmark" size={14} color={colors.primaryText} />
                                      ) : null}
                                    </View>
                                  </View>

                                  {willReassign ? (
                                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                                      {"Ao salvar, ser\u00e1 reatribu\u00edda de "}
                                      {currentHeadName}
                                      {" para este membro."}
                                    </Text>
                                  ) : !checked && currentHeadName ? (
                                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                                      Responsável atual: {currentHeadName}
                                    </Text>
                                  ) : null}
                                </Pressable>
                              );
                            })}
                          </ScrollView>

                          <Pressable
                            disabled={!classHeadSelectionDirty || classHeadBusy || memberBusy}
                            onPress={() => void onSaveClassHeads()}
                            style={{
                              borderRadius: 10,
                              borderWidth: 1,
                              borderColor: colors.border,
                              backgroundColor: colors.card,
                              alignItems: "center",
                              paddingVertical: 10,
                              opacity: !classHeadSelectionDirty || classHeadBusy || memberBusy ? 0.6 : 1,
                            }}
                          >
                            <Text style={{ color: colors.text, fontWeight: "700" }}>
                              {classHeadBusy ? "Salvando turmas..." : "Salvar turmas"}
                            </Text>
                          </Pressable>
                        </>
                      )}
                    </View>
                  ) : null}
                </View>

                <View
                  style={{
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.secondaryBg,
                    overflow: "hidden",
                  }}
                >
                  <Pressable
                    onPress={() => toggleSection("permissions")}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 10,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <View style={{ gap: 2, flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: "700" }}>
                        {"Permiss\u00f5es de telas"}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>
                        {enabledPermissionsCount}/{MEMBER_PERMISSION_OPTIONS.length} ativas
                      </Text>
                    </View>
                    <Ionicons
                      name={expandedSections.permissions ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={colors.muted}
                    />
                  </Pressable>

                  {expandedSections.permissions ? (
                    <View
                      style={{
                        borderTopWidth: 1,
                        borderTopColor: colors.border,
                        padding: 10,
                        gap: 10,
                      }}
                    >
                      {permissionsLoading ? (
                        <Text style={{ color: colors.muted }}>{"Carregando permiss\u00f5es..."}</Text>
                      ) : (
                        MEMBER_PERMISSION_OPTIONS.map((option) => {
                          const allowed = permissions[option.key] !== false;
                          const busy = permissionBusyKey === option.key;
                          const disableSelfMembers =
                            option.key === "org_members" && currentMemberIsSelf && allowed;
                          const disabled = busy || disableSelfMembers;
                          const switchTrackBg = allowed ? "rgba(34, 197, 94, 0.28)" : colors.inputBg;
                          const switchTrackBorder = allowed
                            ? "rgba(134, 239, 172, 0.45)"
                            : colors.border;
                          const switchThumbBg = allowed ? "rgba(38, 79, 89, 0.92)" : colors.thumbFallback;
                          const switchThumbBorder = allowed ? "rgba(255,255,255,0.08)" : colors.border;

                          return (
                            <Pressable
                              key={option.key}
                              disabled={disabled}
                              onPress={() => void onTogglePermission(option.key, !allowed)}
                              style={{
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: colors.border,
                                backgroundColor: colors.card,
                                padding: 10,
                                opacity: disabled ? 0.6 : 1,
                              }}
                            >
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: 10,
                                }}
                              >
                                <View style={{ flex: 1, gap: 2 }}>
                                  <Text style={{ color: colors.text, fontWeight: "700" }}>{option.label}</Text>
                                  <Text style={{ color: colors.muted, fontSize: 12 }}>{option.description}</Text>
                                </View>

                                <View
                                  style={{
                                    width: 52,
                                    height: 30,
                                    borderRadius: 999,
                                    borderWidth: 1,
                                    borderColor: switchTrackBorder,
                                    backgroundColor: switchTrackBg,
                                    paddingHorizontal: 3,
                                    alignItems: allowed ? "flex-end" : "flex-start",
                                    justifyContent: "center",
                                  }}
                                >
                                  <View
                                    style={{
                                      width: 22,
                                      height: 22,
                                      borderRadius: 999,
                                      borderWidth: 1,
                                      borderColor: switchThumbBorder,
                                      backgroundColor: switchThumbBg,
                                    }}
                                  />
                                </View>
                              </View>

                              {disableSelfMembers ? (
                                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>
                                  {"Voc\u00ea n\u00e3o pode desativar essa permiss\u00e3o para sua pr\u00f3pria conta."}
                                </Text>
                              ) : null}
                            </Pressable>
                          );
                        })
                      )}
                    </View>
                  ) : null}
                </View>

                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                  <Pressable
                    onPress={closeMemberSheet}
                    style={{
                      flex: 1,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.secondaryBg,
                      alignItems: "center",
                      paddingVertical: 11,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "700" }}>Fechar</Text>
                  </Pressable>

                  <Pressable
                    disabled={memberBusy || currentMemberIsLastAdmin || currentMemberIsSelf}
                    onPress={onRemoveMember}
                    style={{
                      flex: 1,
                      borderRadius: 12,
                      backgroundColor: colors.warningBg,
                      alignItems: "center",
                      paddingVertical: 11,
                      opacity: memberBusy || currentMemberIsLastAdmin || currentMemberIsSelf ? 0.6 : 1,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "800" }}>Remover membro</Text>
                  </Pressable>
                </View>

                {currentMemberIsSelf ? (
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {"Sua conta n\u00e3o pode ser removida por seguran\u00e7a."}
                  </Text>
                ) : null}

                {selectedMemberIsProfessor ? (
                  <View
                    style={{
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.secondaryBg,
                      padding: 10,
                      gap: 10,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "800" }}>
                      Comunicação com professor
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      Gere uma mensagem contextual para este professor.
                    </Text>

                    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                      {trainerToneOptions.map((tone) => {
                        const selected = memberTrainerTone === tone.value;
                        return (
                          <Pressable
                            key={tone.value}
                            onPress={() => setMemberTrainerTone(tone.value)}
                            disabled={memberTrainerBusy}
                            style={{
                              borderRadius: 999,
                              borderWidth: 1,
                              borderColor: colors.border,
                              backgroundColor: selected ? colors.primaryBg : colors.card,
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              opacity: memberTrainerBusy ? 0.7 : 1,
                            }}
                          >
                            <Text
                              style={{
                                color: selected ? colors.primaryText : colors.text,
                                fontWeight: "700",
                                fontSize: 11,
                              }}
                            >
                              {tone.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                      <Pressable
                        onPress={() => void onGenerateProfessorMessage()}
                        disabled={memberTrainerBusy}
                        style={{
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: memberTrainerBusy ? colors.secondaryBg : colors.primaryBg,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          opacity: memberTrainerBusy ? 0.75 : 1,
                        }}
                      >
                        <Text
                          style={{
                            color: memberTrainerBusy ? colors.muted : colors.primaryText,
                            fontWeight: "700",
                            fontSize: 12,
                          }}
                        >
                          {memberTrainerBusy ? "Gerando..." : "Gerar mensagem"}
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() => void onCopyProfessorWhatsapp()}
                        disabled={memberTrainerBusy || !memberTrainerMessage}
                        style={{
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: colors.card,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          opacity: memberTrainerBusy || !memberTrainerMessage ? 0.6 : 1,
                        }}
                      >
                        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                          Copiar WhatsApp
                        </Text>
                      </Pressable>
                    </View>

                    {memberTrainerMessage?.oneLiner ? (
                      <Text style={{ color: colors.muted, fontSize: 12 }}>
                        Prévia: {memberTrainerMessage.oneLiner}
                      </Text>
                    ) : null}

                    {memberTrainerFeedback ? (
                      <Text style={{ color: colors.muted, fontSize: 12 }}>{memberTrainerFeedback}</Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </View>
          </ScrollView>
        ) : null}
      </ModalSheet>
    </Container>
  );
}

export default OrgMembersPanel;
