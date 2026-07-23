import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
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
  revokeTrainerInvite,
  type TrainerInviteItem,
  type TrainerInviteRole,
} from "../../api/trainer-invite";
import { radius } from "../../theme/tokens";
import { AnchoredDropdown } from "../../ui/AnchoredDropdown";
import { AnchoredDropdownOption } from "../../ui/AnchoredDropdownOption";
import { useAppTheme } from "../../ui/app-theme";
import { ConfirmCloseOverlay } from "../../ui/ConfirmCloseOverlay";
import { useConfirmUndo } from "../../ui/confirm-undo";
import { GoAtletaIcon, type GoAtletaIconName } from "../../ui/icon-registry";
import { ModalSheet } from "../../ui/ModalSheet";
import { Pressable } from "../../ui/Pressable";
import { useUndoableListDelete } from "../../ui/useUndoableListDelete";
import { useResponsiveLayout } from "../../ui/use-responsive-layout";
import { resolveAccessModalLayout } from "./application/access-modal-layout";
import { formatClassAssignmentMeta } from "./application/class-assignment-meta";
import {
  areInviteFormSnapshotsEqual,
  createInviteFormSnapshot,
  DEFAULT_INVITE_PERMISSION_KEYS,
  type InviteFormSnapshot,
} from "./application/invite-form";
import {
  areMemberAccessFormSnapshotsEqual,
  createMemberAccessFormSnapshot,
  type MemberAccessFormSnapshot,
} from "./application/member-access-form";
import { formatMemberLastAccess } from "./application/member-last-access";

type SecondaryModuleKey = "attendance" | "access" | "reports" | "sync";
type RoleFilter = "all" | "coordination" | "professor" | "intern";
type StatusFilter = "all" | "active" | "pending";
type ModalMode = "invite" | "edit" | "message" | null;
type Layout = { x: number; y: number; width: number; height: number };
type InviteAudience = Exclude<TrainerInviteRole, "collaborator"> | "student";
type InviteNotice = {
  tone: "success" | "warning" | "error";
  title: string;
  message: string;
};

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
  "access",
  "reports",
  "sync",
];

const moduleIcon: Record<SecondaryModuleKey, GoAtletaIconName> = {
  attendance: "attendance",
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

function InviteActionMenu({
  invite,
  onCancel,
}: {
  invite: TrainerInviteItem;
  onCancel: (invite: TrainerInviteItem) => void;
}) {
  const { colors } = useAppTheme();
  const triggerRef = useRef<ViewType | null>(null);
  const [open, setOpen] = useState(false);
  const [layout, setLayout] = useState<Layout | null>(null);
  const inviteLabel = invite.invited_to ?? "pendente";

  return (
    <>
      <View ref={triggerRef}>
        <Pressable
          accessibilityLabel={`Ações do convite ${inviteLabel}`}
          onPress={() => {
            if (open) {
              setOpen(false);
              return;
            }
            triggerRef.current?.measureInWindow((x, y, width, height) => {
              setLayout({ x: x - 200 + width, y, width: 200, height });
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
        maxHeight={120}
        nestedScrollEnabled
        onRequestClose={() => setOpen(false)}
        interactiveRefs={[triggerRef]}
      >
        <AnchoredDropdownOption
          active={false}
          onPress={() => {
            setOpen(false);
            onCancel(invite);
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
            <GoAtletaIcon name="trash" size={16} color={colors.dangerText} />
            <Text style={{ color: colors.dangerText, fontWeight: "700" }}>
              Cancelar convite
            </Text>
          </View>
        </AnchoredDropdownOption>
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
  const { confirm: confirmUndo } = useConfirmUndo();
  const { height, width } = useWindowDimensions();
  const responsiveLayout = useResponsiveLayout("dashboard");
  const supportsSplitLayout = responsiveLayout.supportsSplitView;
  const compact = responsiveLayout.isMobile;
  const splitAccessModal = resolveAccessModalLayout(width) === "split";
  const stackedAccessModalHeight = Math.max(320, Math.min(760, height - 96));
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
  const [invitePermissionKeys, setInvitePermissionKeys] = useState<MemberPermissionKey[]>(() => [
    ...DEFAULT_INVITE_PERMISSION_KEYS,
  ]);
  const [inviteInitialSnapshot, setInviteInitialSnapshot] =
    useState<InviteFormSnapshot | null>(null);
  const [showInviteCloseConfirm, setShowInviteCloseConfirm] = useState(false);
  const [inviteBusyChannel, setInviteBusyChannel] = useState<"email" | "link" | null>(
    null
  );
  const [inviteResult, setInviteResult] = useState<string | null>(null);
  const [inviteResultChannel, setInviteResultChannel] = useState<"email" | "link" | null>(null);
  const [inviteEmailError, setInviteEmailError] = useState<"missing" | "invalid" | null>(null);
  const [inviteNotice, setInviteNotice] = useState<InviteNotice | null>(null);
  const inviteEmailInputRef = useRef<TextInput | null>(null);
  const inviteEmailShakeAnim = useRef(new Animated.Value(0)).current;
  const [editBusy, setEditBusy] = useState(false);
  const [editRole, setEditRole] = useState<5 | 10 | 50>(10);
  const [editClassIds, setEditClassIds] = useState<string[]>([]);
  const [editPermissionKeys, setEditPermissionKeys] = useState<MemberPermissionKey[]>([]);
  const [editInitialSnapshot, setEditInitialSnapshot] =
    useState<MemberAccessFormSnapshot | null>(null);
  const [showEditCloseConfirm, setShowEditCloseConfirm] = useState(false);
  const [permissionLoading, setPermissionLoading] = useState(false);
  const [selectedPermissionKeys, setSelectedPermissionKeys] = useState<MemberPermissionKey[]>([]);
  const [selectedPermissionsLoading, setSelectedPermissionsLoading] = useState(false);
  const [visiblePendingInvites, setVisiblePendingInvites] = useState(pendingInvites);
  const selectedPermissionRequestRef = useRef(0);
  const editPermissionRequestRef = useRef(0);
  const getPendingInviteId = useCallback((invite: TrainerInviteItem) => invite.id, []);

  const undoableInviteCancel = useUndoableListDelete({
    items: visiblePendingInvites,
    setItems: setVisiblePendingInvites,
    getId: getPendingInviteId,
    confirm: confirmUndo,
    title: "Cancelar convite?",
    message: "O link deixará de funcionar e o convite será removido desta lista.",
    confirmLabel: "Cancelar convite",
    cancelLabel: "Manter convite",
    undoLabel: "Desfazer",
    undoMessage: "Convite removido. Deseja desfazer?",
    delayMs: 4500,
    deleteItems: async (ids) => {
      await Promise.all(ids.map((inviteId) => revokeTrainerInvite(inviteId, organizationId)));
    },
  });

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
    setVisiblePendingInvites(pendingInvites);
  }, [pendingInvites]);

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
    return visiblePendingInvites.filter(
      (invite) =>
        !query || (invite.invited_to ?? "convite pendente").toLowerCase().includes(query)
    );
  }, [roleFilter, search, statusFilter, visiblePendingInvites]);

  const selectedMember =
    members.find((member) => member.userId === selectedMemberId) ?? members[0] ?? null;
  const selectedClasses = selectedMember
    ? classesByUser.get(selectedMember.userId) ?? []
    : [];
  const selectedAttendance = selectedClasses
    .map((head) => attendanceByClass.get(head.classId))
    .filter((item): item is AdminPendingAttendance => Boolean(item));
  const currentInviteSnapshot = useMemo(
    () =>
      createInviteFormSnapshot({
        email: inviteEmail,
        role: inviteRole,
        permissionKeys: invitePermissionKeys,
      }),
    [inviteEmail, invitePermissionKeys, inviteRole]
  );
  const isInviteDirty = Boolean(
    inviteInitialSnapshot &&
      !areInviteFormSnapshotsEqual(inviteInitialSnapshot, currentInviteSnapshot)
  );
  const currentEditSnapshot = useMemo(
    () =>
      createMemberAccessFormSnapshot({
        role: editRole,
        classIds: editClassIds,
        permissionKeys: editPermissionKeys,
      }),
    [editClassIds, editPermissionKeys, editRole]
  );
  const isEditDirty = Boolean(
    editInitialSnapshot &&
      !areMemberAccessFormSnapshotsEqual(editInitialSnapshot, currentEditSnapshot)
  );
  const editSaveDisabled = editBusy || permissionLoading || !isEditDirty;

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
    const permissionKeys = [...DEFAULT_INVITE_PERMISSION_KEYS];
    setInviteEmail("");
    setInviteRole("professor");
    setInvitePermissionKeys(permissionKeys);
    setInviteInitialSnapshot(
      createInviteFormSnapshot({ email: "", role: "professor", permissionKeys })
    );
    setShowInviteCloseConfirm(false);
    setInviteResult(null);
    setInviteResultChannel(null);
    setInviteEmailError(null);
    setInviteNotice(null);
    setModalMember(null);
    setModalMode("invite");
  };

  const clearInviteOutcome = () => {
    setInviteResult(null);
    setInviteResultChannel(null);
    setInviteNotice(null);
  };

  const closeInviteModal = useCallback(() => {
    setShowInviteCloseConfirm(false);
    setInviteInitialSnapshot(null);
    setModalMode(null);
  }, []);

  const requestCloseInviteModal = useCallback(() => {
    if (inviteBusyChannel !== null) return;
    if (isInviteDirty) {
      setShowInviteCloseConfirm(true);
      return;
    }
    closeInviteModal();
  }, [closeInviteModal, inviteBusyChannel, isInviteDirty]);

  const shakeInviteEmail = () => {
    const useNativeDriver = Platform.OS !== "web";
    inviteEmailShakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(inviteEmailShakeAnim, {
        toValue: 8,
        duration: 50,
        useNativeDriver,
      }),
      Animated.timing(inviteEmailShakeAnim, {
        toValue: -8,
        duration: 50,
        useNativeDriver,
      }),
      Animated.timing(inviteEmailShakeAnim, {
        toValue: 6,
        duration: 50,
        useNativeDriver,
      }),
      Animated.timing(inviteEmailShakeAnim, {
        toValue: -6,
        duration: 50,
        useNativeDriver,
      }),
      Animated.timing(inviteEmailShakeAnim, {
        toValue: 0,
        duration: 50,
        useNativeDriver,
      }),
    ]).start();
  };

  const openEdit = async (member: OrgMember) => {
    const requestId = editPermissionRequestRef.current + 1;
    editPermissionRequestRef.current = requestId;
    const initialRole = member.roleLevel >= 50 ? 50 : member.roleLevel >= 10 ? 10 : 5;
    const initialClassIds = (classesByUser.get(member.userId) ?? []).map(
      (item) => item.classId
    );
    setModalMember(member);
    setEditRole(initialRole);
    setEditClassIds(initialClassIds);
    setEditPermissionKeys([]);
    setEditInitialSnapshot(null);
    setShowEditCloseConfirm(false);
    setPermissionLoading(true);
    setModalMode("edit");
    try {
      const permissions = await adminListMemberPermissions(organizationId, member.userId);
      if (editPermissionRequestRef.current !== requestId) return;
      const initialPermissionKeys = permissions
        .filter((permission) => permission.isAllowed)
        .map((permission) => permission.permissionKey);
      setEditPermissionKeys(initialPermissionKeys);
      setEditInitialSnapshot(
        createMemberAccessFormSnapshot({
          role: initialRole,
          classIds: initialClassIds,
          permissionKeys: initialPermissionKeys,
        })
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

  const closeEditModal = useCallback(() => {
    editPermissionRequestRef.current += 1;
    setShowEditCloseConfirm(false);
    setEditInitialSnapshot(null);
    setModalMember(null);
    setModalMode(null);
  }, []);

  const requestCloseEditModal = useCallback(() => {
    if (editBusy) return;
    if (isEditDirty) {
      setShowEditCloseConfirm(true);
      return;
    }
    closeEditModal();
  }, [closeEditModal, editBusy, isEditDirty]);

  const openMessage = (member: OrgMember) => {
    setModalMember(member);
    setModalMode("message");
  };

  const submitInvite = async (channel: "email" | "link") => {
    if (inviteRole === "student") {
      router.push("/coord/students" as never);
      closeInviteModal();
      return;
    }
    const email = inviteEmail.trim().toLowerCase();
    if (channel === "email" && (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      setInviteEmailError(email ? "invalid" : "missing");
      setInviteNotice(null);
      shakeInviteEmail();
      inviteEmailInputRef.current?.focus();
      return;
    }
    setInviteEmailError(null);
    const roleText =
      inviteRole === "moderator"
        ? "coordenação"
        : inviteRole === "intern"
          ? "estagiário"
          : "professor";
    const buildWhatsAppMessage = (link: string) =>
      `Você recebeu um convite para acessar ${organizationName} no GoAtleta como ${roleText}.\n\nAbra o link para aceitar:\n${link}`;

    setInviteBusyChannel(channel);
    try {
      if (channel === "link" && inviteResult && inviteResultChannel === "link") {
        try {
          await Clipboard.setStringAsync(buildWhatsAppMessage(inviteResult));
          setInviteNotice({
            tone: "success",
            title: "Mensagem copiada",
            message: "Agora é só colar a mensagem com o link no WhatsApp.",
          });
        } catch {
          setInviteNotice({
            tone: "error",
            title: "Não foi possível copiar",
            message: "O link continua disponível abaixo para você copiar manualmente.",
          });
        }
        return;
      }

      const result = await createTrainerInvite({
        organizationId,
        role: inviteRole,
        invitedTo: channel === "email" ? email : undefined,
        invitedVia: channel,
        permissionKeys: inviteRole === "moderator" ? [] : invitePermissionKeys,
      });
      setInviteResult(result.signup_link);
      setInviteResultChannel(channel);
      setInviteInitialSnapshot(currentInviteSnapshot);

      let copied = false;
      try {
        await Clipboard.setStringAsync(
          channel === "link" ? buildWhatsAppMessage(result.signup_link) : result.signup_link
        );
        copied = true;
      } catch {
        // O convite continua válido e visível para cópia manual.
      }
      onRefresh();
      if (channel === "link") {
        setInviteNotice({
          tone: "success",
          title: copied ? "Link gerado e copiado" : "Link gerado",
          message: copied
            ? "A mensagem está pronta para colar no WhatsApp."
            : "Copie o link abaixo para enviar no WhatsApp.",
        });
      } else {
        setInviteNotice({
          tone: result.email_sent ? "success" : "warning",
          title: result.email_sent ? "Convite enviado por e-mail" : "Convite criado sem envio",
          message: result.email_sent
            ? copied
              ? "O envio foi confirmado e o link também foi copiado."
              : "O envio por e-mail foi confirmado."
            : copied
              ? "O provedor não enviou o e-mail; o link foi copiado para compartilhamento manual."
              : "O provedor não enviou o e-mail; copie o link abaixo para compartilhar.",
        });
      }
    } catch (error) {
      setInviteNotice({
        tone: "error",
        title: "Não foi possível criar o convite",
        message: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    } finally {
      setInviteBusyChannel(null);
    }
  };

  const submitEdit = async () => {
    if (!modalMember || editSaveDisabled) return;
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
      closeEditModal();
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
  const inviteNoticePalette =
    inviteNotice?.tone === "success"
      ? {
          background: colors.successBg,
          border: colors.successBorder,
          text: colors.successText,
        }
      : inviteNotice?.tone === "warning"
        ? {
            background: colors.warningBg,
            border: colors.warningBorder,
            text: colors.warningText,
          }
        : {
            background: colors.dangerBg,
            border: colors.dangerBorder,
            text: colors.dangerText,
          };
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
        <View style={{ flexShrink: 0, width: supportsSplitLayout ? "48%" : undefined }}>
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
            width: supportsSplitLayout ? "46%" : undefined,
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

      <View style={{ flexDirection: supportsSplitLayout ? "row" : "column", alignItems: "flex-start", gap: 12 }}>
        <View style={{ width: supportsSplitLayout ? "61%" : "100%", minWidth: 0, gap: 7 }}>
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
                      ["Último acesso", 0.9],
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
                                flex: 0.9,
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              <GoAtletaIcon
                                name="time"
                                size={14}
                                color={member.lastAccessAt ? colors.secondaryText : colors.muted}
                              />
                              <Text
                                numberOfLines={1}
                                style={{
                                  color: member.lastAccessAt ? colors.text : colors.muted,
                                  fontSize: 12,
                                }}
                              >
                                {formatMemberLastAccess(member.lastAccessAt)}
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
                      <View
                        style={{
                          flex: 1,
                          minWidth: 0,
                          flexShrink: 1,
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
                            backgroundColor: inner,
                          }}
                        >
                          <GoAtletaIcon name="communications" size={15} color={colors.warningText} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "700" }}>
                            {invite.invited_to ?? "Convite pendente"}
                          </Text>
                          <Text style={{ color: colors.muted, fontSize: 10 }}>Aguardando aceite</Text>
                        </View>
                      </View>
                      <View
                        style={{
                          flexShrink: 0,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        {!compact ? (
                          <Text style={{ color: colors.warningText, fontSize: 11 }}>Pendente</Text>
                        ) : null}
                        <InviteActionMenu
                          invite={invite}
                          onCancel={(target) => undoableInviteCancel.deleteOne(target)}
                        />
                      </View>
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
            width: supportsSplitLayout ? "39%" : "100%",
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
                  <Text style={{ color: colors.muted }}>
                    {formatMemberLastAccess(selectedMember.lastAccessAt)}
                  </Text>
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
        onClose={requestCloseInviteModal}
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar convite"
            onPress={requestCloseInviteModal}
          >
            <GoAtletaIcon name="close" size={22} color={colors.text} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 18, gap: 16 }}>
          <View style={{ flexDirection: compact ? "column" : "row", gap: 18 }}>
            <View style={{ flex: 1, gap: 14 }}>
              {inviteRole !== "student" ? (
                <Animated.View
                  style={{ gap: 7, transform: [{ translateX: inviteEmailShakeAnim }] }}
                >
                  <View style={{ gap: 2 }}>
                    <Text style={{ color: colors.text, fontWeight: "700" }}>E-mail</Text>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>
                      Obrigatório somente para enviar o convite por e-mail.
                    </Text>
                  </View>
                  {inviteEmailError ? (
                    <View accessibilityRole="alert" style={{ position: "relative" }}>
                      <View
                        style={{
                          alignSelf: "flex-start",
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                          borderRadius: 8,
                          backgroundColor: colors.dangerSolidBg,
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                        }}
                      >
                        <GoAtletaIcon
                          name="warningCircle"
                          size={14}
                          color={colors.dangerSolidText}
                        />
                        <Text
                          style={{
                            color: colors.dangerSolidText,
                            fontSize: 12,
                            fontWeight: "700",
                          }}
                        >
                          {inviteEmailError === "missing"
                            ? "Digite o e-mail para enviar o convite"
                            : "Digite um e-mail válido"}
                        </Text>
                      </View>
                      <View
                        style={{
                          width: 0,
                          height: 0,
                          marginLeft: 16,
                          borderLeftWidth: 6,
                          borderRightWidth: 6,
                          borderTopWidth: 6,
                          borderLeftColor: "transparent",
                          borderRightColor: "transparent",
                          borderTopColor: colors.dangerSolidBg,
                        }}
                      />
                    </View>
                  ) : null}
                  <TextInput
                    ref={inviteEmailInputRef}
                    value={inviteEmail}
                    onChangeText={(value) => {
                      setInviteEmail(value);
                      if (inviteEmailError) setInviteEmailError(null);
                      clearInviteOutcome();
                    }}
                    accessibilityLabel="E-mail do convite"
                    accessibilityHint={
                      inviteEmailError
                        ? "Campo obrigatório apenas para enviar o convite por e-mail."
                        : "Opcional para o link do WhatsApp."
                    }
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder="nome@exemplo.com"
                    placeholderTextColor={colors.placeholder}
                    style={{
                      borderRadius: radius.internal,
                      borderWidth: inviteEmailError ? 2 : 1,
                      borderColor: inviteEmailError ? colors.dangerSolidBg : border,
                      backgroundColor: colors.inputBg,
                      color: colors.inputText,
                      paddingHorizontal: inviteEmailError ? 11 : 12,
                      paddingVertical: inviteEmailError ? 10 : 11,
                    }}
                  />
                </Animated.View>
              ) : null}
              <View style={{ gap: 7 }}>
                <Text style={{ color: colors.text, fontWeight: "700" }}>Função</Text>
                <DropdownButton
                  value={inviteRole}
                  onChange={(value) => {
                    setInviteRole(value);
                    clearInviteOutcome();
                  }}
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
                    closeInviteModal();
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
                          onPress={() => {
                            clearInviteOutcome();
                            setInvitePermissionKeys((current) =>
                              checked
                                ? current.filter((key) => key !== option.key)
                                : [...current, option.key]
                            );
                          }}
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
        </ScrollView>
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: border,
          }}
        >
          {inviteNotice ? (
            <View
              accessibilityRole="alert"
              style={{
                paddingHorizontal: 16,
                paddingVertical: 11,
                backgroundColor: inviteNoticePalette.background,
                borderBottomWidth: 1,
                borderBottomColor: inviteNoticePalette.border,
                gap: 3,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                <GoAtletaIcon
                  name={inviteNotice.tone === "error" ? "warningCircle" : "checkmarkCircle"}
                  size={17}
                  color={inviteNoticePalette.text}
                />
                <Text style={{ color: inviteNoticePalette.text, fontWeight: "800" }}>
                  {inviteNotice.title}
                </Text>
              </View>
              <Text style={{ color: inviteNoticePalette.text, fontSize: 12 }}>
                {inviteNotice.message}
              </Text>
              {inviteResult ? (
                <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11 }}>
                  {inviteResult}
                </Text>
              ) : null}
            </View>
          ) : null}

          <View
            style={{
              padding: 16,
              flexDirection: compact ? "column-reverse" : "row",
              justifyContent: "flex-end",
              gap: 10,
            }}
          >
            {inviteRole !== "student" ? (
              <Pressable
                disabled={inviteBusyChannel !== null}
                onPress={() => void submitInvite("link")}
                style={{
                  borderRadius: radius.internal,
                  borderWidth: 1,
                  borderColor: border,
                  paddingHorizontal: 18,
                  paddingVertical: 10,
                  opacity: inviteBusyChannel !== null ? 0.55 : 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <GoAtletaIcon name="whatsapp" size={17} color={colors.text} />
                <Text style={{ color: colors.text, fontWeight: "800" }}>
                  {inviteBusyChannel === "link"
                    ? inviteResult && inviteResultChannel === "link"
                      ? "Copiando..."
                      : "Gerando link..."
                    : inviteResult && inviteResultChannel === "link"
                      ? "Copiar para WhatsApp"
                      : "Gerar link para WhatsApp"}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              disabled={inviteBusyChannel !== null}
              onPress={() => void submitInvite("email")}
              style={{
                borderRadius: radius.internal,
                backgroundColor: colors.primaryBg,
                paddingHorizontal: 20,
                paddingVertical: 10,
                opacity: inviteBusyChannel !== null ? 0.65 : 1,
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.primaryText, fontWeight: "800" }}>
                {inviteBusyChannel === "email"
                  ? "Enviando..."
                  : inviteRole === "student"
                    ? "Selecionar aluno"
                    : "Enviar convite por e-mail"}
              </Text>
            </Pressable>
          </View>
        </View>
      </ModalSheet>

      <ConfirmCloseOverlay
        visible={showInviteCloseConfirm}
        title="Sair sem salvar?"
        message="Você tem alterações não salvas."
        confirmLabel="Sair sem salvar"
        cancelLabel="Continuar editando"
        onConfirm={closeInviteModal}
        onCancel={() => setShowInviteCloseConfirm(false)}
      />

      <ModalSheet
        visible={modalMode === "edit" && Boolean(modalMember)}
        onClose={requestCloseEditModal}
        position="center"
        cardStyle={{
          width: compact ? Math.max(0, width - 32) : splitAccessModal ? 980 : 760,
          maxWidth: "100%",
          height: splitAccessModal ? undefined : stackedAccessModalHeight,
          maxHeight: splitAccessModal ? "90%" : stackedAccessModalHeight,
          flexDirection: "column",
          padding: 0,
          overflow: "hidden",
        }}
      >
        <View style={{ padding: 18, borderBottomWidth: 1, borderBottomColor: border, flexDirection: "row" }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: "800" }}>
              Perfil e permissões
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>
              {modalMember?.displayName}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar perfil e permissões"
            onPress={requestCloseEditModal}
            style={{
              width: 36,
              height: 36,
              flexShrink: 0,
              marginLeft: 12,
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <GoAtletaIcon name="close" size={22} color={colors.text} />
          </Pressable>
        </View>
        <ScrollView
          style={splitAccessModal ? undefined : { flex: 1, minHeight: 0 }}
          contentContainerStyle={{ padding: 18, gap: 18 }}
        >
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
                O acesso administrativo atual será mantido.
              </Text>
            ) : null}
          </View>
          <View
            style={{
              flexDirection: splitAccessModal ? "row" : "column",
              alignItems: "stretch",
              gap: 16,
            }}
          >
            <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
              <Text style={{ color: colors.text, fontWeight: "800" }}>
                Turmas atribuídas ({editClassIds.length})
              </Text>
              <ScrollView
                style={{
                  height: splitAccessModal ? 330 : 220,
                  borderWidth: 1,
                  borderColor: border,
                  borderRadius: radius.internal,
                }}
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
                        <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11 }}>
                          {formatClassAssignmentMeta(item)}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
              <Text style={{ color: colors.text, fontWeight: "800" }}>
                Permissões ({editPermissionKeys.length})
              </Text>
              <View
                style={{
                  height: splitAccessModal ? 330 : 220,
                  borderWidth: 1,
                  borderColor: border,
                  borderRadius: radius.internal,
                  overflow: "hidden",
                }}
              >
                {permissionLoading ? (
                  <View style={{ padding: 14 }}>
                    <Text style={{ color: colors.muted }}>Carregando permissões...</Text>
                  </View>
                ) : (
                  <ScrollView showsVerticalScrollIndicator nestedScrollEnabled>
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
                          <Text style={{ color: colors.text, fontWeight: "700", flex: 1 }}>
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            </View>
          </View>
        </ScrollView>
        <View
          style={{
            flexShrink: 0,
            padding: 16,
            borderTopWidth: 1,
            borderTopColor: border,
            flexDirection: "row",
            justifyContent: "flex-end",
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: editSaveDisabled }}
            disabled={editSaveDisabled}
            onPress={() => void submitEdit()}
            style={{
              borderRadius: radius.internal,
              backgroundColor: colors.primaryBg,
              paddingHorizontal: 20,
              paddingVertical: 10,
              opacity: editSaveDisabled ? 0.45 : 1,
            }}
          >
            <Text style={{ color: colors.primaryText, fontWeight: "800" }}>
              {editBusy ? "Salvando..." : "Salvar alterações"}
            </Text>
          </Pressable>
        </View>
      </ModalSheet>

      <ConfirmCloseOverlay
        visible={showEditCloseConfirm}
        title="Sair sem salvar?"
        message="Você tem alterações não salvas."
        confirmLabel="Sair sem salvar"
        cancelLabel="Continuar editando"
        onConfirm={closeEditModal}
        onCancel={() => setShowEditCloseConfirm(false)}
      />

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
