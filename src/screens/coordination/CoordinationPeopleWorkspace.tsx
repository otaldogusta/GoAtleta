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
  adminApplyMemberAccessChange,
  adminListMemberPermissions,
  adminListOrgMemberClassAssignments,
  adminListOrgMemberClassHeads,
  adminRemoveOrgMember,
  MEMBER_PERMISSION_OPTIONS,
  type MemberClassHead,
  type MemberPermissionKey,
  type OrgClass,
  type OrgMember,
} from "../../api/members";
import type {
  AdminPendingAttendance,
  AdminPendingSessionLogs,
  AdminRecentActivity,
} from "../../api/reports";
import { useAuth } from "../../auth/auth";
import { ScreenPageHeader } from "../../components/ui/ScreenPageHeader";
import {
  createTrainerInvite,
  revokeTrainerInvite,
  type TrainerInviteItem,
  type TrainerInviteRole,
} from "../../api/trainer-invite";
import {
  adminReviewOrgAccessRequest,
  type OrganizationAccessRequest,
} from "../../api/organization-access-requests";
import { radius } from "../../theme/tokens";
import { AnchoredDropdown } from "../../ui/AnchoredDropdown";
import { AnchoredDropdownOption } from "../../ui/AnchoredDropdownOption";
import { AppRefreshControl } from "../../ui/AppRefreshControl";
import { useAppTheme } from "../../ui/app-theme";
import { ConfirmCloseOverlay } from "../../ui/ConfirmCloseOverlay";
import { useConfirmUndo } from "../../ui/confirm-undo";
import { GoAtletaIcon, type GoAtletaIconName } from "../../ui/icon-registry";
import { ModalSheet } from "../../ui/ModalSheet";
import { Pressable } from "../../ui/Pressable";
import { useSaveToast } from "../../ui/save-toast";
import { useUndoableListDelete } from "../../ui/useUndoableListDelete";
import { useResponsiveLayout } from "../../ui/use-responsive-layout";
import CoordinationFamilyAccessScreen from "../family/CoordinationFamilyAccessScreen";
import { resolveAccessModalLayout } from "./application/access-modal-layout";
import {
  getClassAssignmentScheduleLabels,
  groupClassAssignments,
} from "./application/class-assignment-meta";
import {
  areInviteFormSnapshotsEqual,
  createInviteFormSnapshot,
  DEFAULT_INVITE_PERMISSION_KEYS,
  type InviteFormSnapshot,
} from "./application/invite-form";
import {
  areMemberAccessFormSnapshotsEqual,
  createMemberAccessIdempotencyKey,
  createMemberAccessFormSnapshot,
  formatMemberAccessSuccessMessage,
  preserveOwnMemberManagementPermission,
  type MemberAccessFormSnapshot,
} from "./application/member-access-form";
import {
  formatMemberDeactivationError,
  getMemberDeactivationBlockReason,
} from "./application/member-deactivation";
import { formatMemberLastAccess } from "./application/member-last-access";
import { getMemberDisplayLabel } from "./application/member-display-label";
import {
  inviteNeedsAction,
  resolveInviteLifecycleStatus,
} from "./application/invite-lifecycle";

type SecondaryModuleKey = "attendance" | "access" | "reports" | "activity";
type PeopleSortKey = "name" | "role" | "classes" | "attendance" | "lastAccess";
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
  pageHorizontalGutter: number;
  loading: boolean;
  refreshing: boolean;
  healthScore: number | null;
  members: OrgMember[];
  memberClassHeads: MemberClassHead[];
  organizationClasses: OrgClass[];
  pendingInvites: TrainerInviteItem[];
  accessRequests: OrganizationAccessRequest[];
  pendingAttendance: AdminPendingAttendance[];
  pendingReports: AdminPendingSessionLogs[];
  recentActivity: AdminRecentActivity[];
  notifySending: boolean;
  onRefresh: () => void | Promise<void>;
  onOpenAttendance: (item: AdminPendingAttendance) => void;
  onOpenReport: (item: AdminPendingSessionLogs) => void;
  onNotifyAttendance: (item: AdminPendingAttendance, member: OrgMember) => void;
};

const DEFAULT_MODULE_ORDER: SecondaryModuleKey[] = [
  "attendance",
  "access",
  "reports",
  "activity",
];

const moduleIcon: Record<SecondaryModuleKey, GoAtletaIconName> = {
  attendance: "attendance",
  access: "communications",
  reports: "document",
  activity: "time",
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
  density = "default",
  disabled = false,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  compact?: boolean;
  density?: "default" | "compact";
  disabled?: boolean;
}) {
  const { colors } = useAppTheme();
  const triggerRef = useRef<ViewType | null>(null);
  const [open, setOpen] = useState(false);
  const [layout, setLayout] = useState<Layout | null>(null);
  const activeLabel = options.find((option) => option.value === value)?.label ?? value;
  const isDense = density === "compact";
  const dropdownHeight = isDense
    ? Math.min(180, options.length * 35 + Math.max(0, options.length - 1) * 4 + 12)
    : 220;

  const toggle = () => {
    if (disabled) return;
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
          disabled={disabled}
          onPress={toggle}
          style={{
            minWidth: compact ? 0 : 160,
            width: compact ? "100%" : 176,
            maxWidth: compact ? undefined : 210,
            flex: compact ? 1 : undefined,
            borderRadius: radius.internal,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.inputBg,
            paddingHorizontal: isDense ? 10 : 12,
            paddingVertical: isDense ? 7 : 10,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: isDense ? 8 : 10,
            opacity: disabled ? 0.62 : 1,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              color: colors.text,
              flex: 1,
              fontSize: isDense ? 14 : undefined,
              fontWeight: isDense ? "600" : undefined,
            }}
          >
            {activeLabel}
          </Text>
          <GoAtletaIcon
            name={open ? "chevronUp" : "chevronDown"}
            size={isDense ? 14 : 16}
            color={colors.text}
          />
        </Pressable>
      </View>
      <AnchoredDropdown
        visible={open && !disabled}
        layout={layout}
        container={null}
        animationStyle={{}}
        zIndex={4200}
        maxHeight={dropdownHeight}
        nestedScrollEnabled
        onRequestClose={() => setOpen(false)}
        interactiveRefs={[triggerRef]}
        density={density}
        showVerticalScrollIndicator={!isDense}
      >
        {options.map((option) => (
          <AnchoredDropdownOption
            key={option.value}
            active={option.value === value}
            density={density}
            onPress={() => {
              onChange(option.value);
              setOpen(false);
            }}
          >
            <Text
              style={{
                color: option.value === value ? colors.primaryText : colors.text,
                fontWeight: "700",
                fontSize: isDense ? 13 : undefined,
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

export function MemberActionMenu({
  member,
  viewportHeight,
  onEdit,
  onMessage,
  onDeactivate,
}: {
  member: OrgMember;
  viewportHeight: number;
  onEdit: (member: OrgMember) => void;
  onMessage: (member: OrgMember) => void;
  onDeactivate: (member: OrgMember) => void;
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
    { label: "Perfil e permissões", icon: "edit", onPress: () => onEdit(member) },
    { label: "Editar turmas", icon: "classes", onPress: () => onEdit(member) },
    { label: "Gerar mensagem", icon: "message", onPress: () => onMessage(member) },
    {
      label: "Desativar acesso",
      icon: "trash",
      destructive: true,
      onPress: () => onDeactivate(member),
    },
  ];
  const nativeMenuMaxHeight = Math.min(
    360,
    Math.max(160, viewportHeight - 96),
    Math.max(0, viewportHeight - 16)
  );

  const close = () => setOpen(false);
  const toggle = () => {
    if (open) {
      close();
      return;
    }
    if (Platform.OS !== "web") {
      setOpen(true);
      return;
    }
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setLayout({ x: x - 188 + width, y, width: 188, height });
      setOpen(true);
    });
  };

  return (
    <>
      <View ref={triggerRef}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ações de ${member.displayName}`}
          accessibilityState={{ expanded: open }}
          onPress={toggle}
          style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
        >
          <GoAtletaIcon name="ellipsisHorizontal" size={19} color={colors.text} />
        </Pressable>
      </View>
      {Platform.OS === "web" ? (
        <AnchoredDropdown
          visible={open}
          layout={layout}
          container={null}
          animationStyle={{}}
          zIndex={4300}
          maxHeight={166}
          nestedScrollEnabled
          density="compact"
          showVerticalScrollIndicator={false}
          onRequestClose={close}
          interactiveRefs={[triggerRef]}
        >
          {actions.map((action) => (
            <AnchoredDropdownOption
              key={action.label}
              active={false}
              density="compact"
              onPress={() => {
                close();
                action.onPress();
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <GoAtletaIcon
                  name={action.icon}
                  size={15}
                  color={action.destructive ? colors.dangerText : colors.text}
                />
                <Text
                  style={{
                    color: action.destructive ? colors.dangerText : colors.text,
                    fontSize: 13,
                    fontWeight: "600",
                  }}
                >
                  {action.label}
                </Text>
              </View>
            </AnchoredDropdownOption>
          ))}
        </AnchoredDropdown>
      ) : (
        <ModalSheet
          visible={open}
          onClose={close}
          position="bottom"
          cardStyle={{ width: "100%", maxHeight: nativeMenuMaxHeight, padding: 12, gap: 4 }}
        >
          <View
            style={{
              minHeight: 48,
              paddingLeft: 8,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Text
              accessibilityRole="header"
              numberOfLines={1}
              style={{ flex: 1, color: colors.text, fontSize: 16, fontWeight: "800" }}
            >
              Ações de {member.displayName.split(" ")[0]}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Fechar ações de ${member.displayName}`}
              onPress={close}
              style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
            >
              <GoAtletaIcon name="close" size={20} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView
            style={{ flexShrink: 1 }}
            contentContainerStyle={{ gap: 4, paddingBottom: 4 }}
            showsVerticalScrollIndicator={false}
          >
            {actions.map((action) => (
              <Pressable
                key={action.label}
                accessibilityRole="button"
                accessibilityLabel={`${action.label} de ${member.displayName}`}
                onPress={() => {
                  close();
                  action.onPress();
                }}
                style={{
                  minHeight: 48,
                  paddingHorizontal: 12,
                  borderRadius: radius.internal,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <GoAtletaIcon
                  name={action.icon}
                  size={18}
                  color={action.destructive ? colors.dangerText : colors.text}
                />
                <Text
                  style={{
                    color: action.destructive ? colors.dangerText : colors.text,
                    fontSize: 14,
                    fontWeight: "700",
                  }}
                >
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </ModalSheet>
      )}
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
              setLayout({ x: x - 188 + width, y, width: 188, height });
              setOpen(true);
            });
          }}
          style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
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
        maxHeight={48}
        nestedScrollEnabled
        density="compact"
        showVerticalScrollIndicator={false}
        onRequestClose={() => setOpen(false)}
        interactiveRefs={[triggerRef]}
      >
        <AnchoredDropdownOption
          active={false}
          density="compact"
          onPress={() => {
            setOpen(false);
            onCancel(invite);
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <GoAtletaIcon name="trash" size={15} color={colors.dangerText} />
            <Text style={{ color: colors.dangerText, fontSize: 13, fontWeight: "600" }}>
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
  pageHorizontalGutter,
  loading,
  refreshing,
  healthScore,
  members,
  memberClassHeads,
  organizationClasses,
  pendingInvites,
  accessRequests,
  pendingAttendance,
  pendingReports,
  recentActivity,
  notifySending,
  onRefresh,
  onOpenAttendance,
  onOpenReport,
  onNotifyAttendance,
}: CoordinationPeopleWorkspaceProps) {
  const { colors } = useAppTheme();
  const { session } = useAuth();
  const router = useRouter();
  const { confirm: confirmUndo } = useConfirmUndo();
  const { showSaveToast } = useSaveToast();
  const { height, width } = useWindowDimensions();
  const responsiveLayout = useResponsiveLayout("dashboard");
  const supportsSplitLayout = responsiveLayout.supportsSplitView;
  const compact = responsiveLayout.isMobile;
  const splitAccessModal = resolveAccessModalLayout(width) === "split";
  const groupedOrganizationClasses = useMemo(
    () => groupClassAssignments(organizationClasses),
    [organizationClasses]
  );
  const stackedAccessModalHeight = Math.max(320, Math.min(760, height - 96));
  const storageKey = `coordination_workspace_order_v2:${organizationId}`;

  const [search, setSearch] = useState("");
  const [peopleSortKey, setPeopleSortKey] = useState<PeopleSortKey | null>(null);
  const [peopleSortIndicator] = useState(() => new Animated.Value(0));
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [peopleExpanded, setPeopleExpanded] = useState(true);
  const [organizing, setOrganizing] = useState(false);
  const [moduleOrder, setModuleOrder] = useState(DEFAULT_MODULE_ORDER);
  const [expandedModules, setExpandedModules] = useState<
    Partial<Record<SecondaryModuleKey, boolean>>
  >({ attendance: true });
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [showFamilyAccess, setShowFamilyAccess] = useState(false);
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
  const [inviteEmailShakeAnim] = useState(() => new Animated.Value(0));
  const [editBusy, setEditBusy] = useState(false);
  const [editRole, setEditRole] = useState<5 | 10 | 50>(10);
  const [editClassIds, setEditClassIds] = useState<string[]>([]);
  const [editPermissionKeys, setEditPermissionKeys] = useState<MemberPermissionKey[]>([]);
  const [editInitialSnapshot, setEditInitialSnapshot] =
    useState<MemberAccessFormSnapshot | null>(null);
  const [showEditCloseConfirm, setShowEditCloseConfirm] = useState(false);
  const [deactivateMember, setDeactivateMember] = useState<OrgMember | null>(null);
  const [deactivateBusy, setDeactivateBusy] = useState(false);
  const [deactivateIssue, setDeactivateIssue] = useState<{
    message: string;
    blocking: boolean;
  } | null>(null);
  const [editAccessLoading, setEditAccessLoading] = useState(false);
  const [selectedPermissionKeys, setSelectedPermissionKeys] = useState<MemberPermissionKey[]>([]);
  const [selectedPermissionsLoading, setSelectedPermissionsLoading] = useState(false);
  const [visibleInvites, setVisibleInvites] = useState(pendingInvites);
  const [accessRequestRoles, setAccessRequestRoles] = useState<Record<string, 5 | 10 | 50>>({});
  const [accessRequestBusyId, setAccessRequestBusyId] = useState<string | null>(null);
  const selectedPermissionRequestRef = useRef(0);
  const editPermissionRequestRef = useRef(0);
  const editSubmissionRef = useRef<{ signature: string; idempotencyKey: string } | null>(
    null
  );
  const getPendingInviteId = useCallback((invite: TrainerInviteItem) => invite.id, []);

  const undoableInviteCancel = useUndoableListDelete({
    items: visibleInvites,
    setItems: setVisibleInvites,
    getId: getPendingInviteId,
    confirm: confirmUndo,
    title: "Cancelar convite?",
    message: "O link deixará de funcionar e ficará registrado como cancelado.",
    confirmLabel: "Cancelar convite",
    cancelLabel: "Manter convite",
    undoLabel: "Desfazer",
    undoMessage: "Cancelamento agendado. Deseja desfazer?",
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
    Promise.resolve().then(() => {
      setVisibleInvites(pendingInvites);
    });
  }, [pendingInvites]);

  useEffect(() => {
    if (selectedMemberId && members.some((member) => member.userId === selectedMemberId)) return;
    Promise.resolve().then(() => {
      setSelectedMemberId(members[0]?.userId ?? null);
    });
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
    const matchingMembers = members.filter((member) => {
      const assigned = classesByUser.get(member.userId) ?? [];
      const haystack = `${member.displayName} ${member.email ?? ""} ${roleLabel(
        member.roleLevel
      )} ${assigned.map((item) => `${item.className} ${item.unit}`).join(" ")}`.toLowerCase();
      return !query || haystack.includes(query);
    });

    if (!peopleSortKey) return matchingMembers;
    return [...matchingMembers].sort((leftMember, rightMember) => {
      const leftClasses = classesByUser.get(leftMember.userId) ?? [];
      const rightClasses = classesByUser.get(rightMember.userId) ?? [];
      if (peopleSortKey === "classes") return leftClasses.length - rightClasses.length;
      if (peopleSortKey === "attendance") {
        const leftPending = leftClasses.filter((item) => attendanceByClass.has(item.classId)).length;
        const rightPending = rightClasses.filter((item) => attendanceByClass.has(item.classId)).length;
        return leftPending - rightPending;
      }
      if (peopleSortKey === "lastAccess") {
        const leftAccess = leftMember.lastAccessAt ? Date.parse(leftMember.lastAccessAt) : 0;
        const rightAccess = rightMember.lastAccessAt ? Date.parse(rightMember.lastAccessAt) : 0;
        return leftAccess - rightAccess;
      }
      const leftValue =
        peopleSortKey === "role" ? roleLabel(leftMember.roleLevel) : leftMember.displayName;
      const rightValue =
        peopleSortKey === "role" ? roleLabel(rightMember.roleLevel) : rightMember.displayName;
      return leftValue.localeCompare(rightValue, "pt-BR", {
        numeric: true,
        sensitivity: "base",
      });
    });
  }, [attendanceByClass, classesByUser, members, peopleSortKey, search]);

  const filteredInvites = useMemo(() => {
    const query = search.trim().toLowerCase();
    return visibleInvites.filter((invite) => {
      return (
        inviteNeedsAction(invite) &&
        (!query || (invite.invited_to ?? "convite pendente").toLowerCase().includes(query))
      );
    });
  }, [search, visibleInvites]);

  const selectPeopleSort = useCallback(
    (key: PeopleSortKey) => {
      if (peopleSortKey === key) {
        setPeopleSortKey(null);
        return;
      }
      peopleSortIndicator.setValue(0);
      setPeopleSortKey(key);
      Animated.spring(peopleSortIndicator, {
        toValue: 1,
        friction: 6,
        tension: 180,
        useNativeDriver: true,
      }).start();
    },
    [peopleSortIndicator, peopleSortKey]
  );

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
        permissionKeys: preserveOwnMemberManagementPermission({
          actorUserId: session?.user?.id,
          targetUserId: modalMember?.userId,
          permissionKeys: editPermissionKeys,
        }),
      }),
    [editClassIds, editPermissionKeys, editRole, modalMember?.userId, session?.user?.id]
  );
  const isEditDirty = Boolean(
    editInitialSnapshot &&
      !areMemberAccessFormSnapshotsEqual(editInitialSnapshot, currentEditSnapshot)
  );
  const editSaveDisabled = editBusy || editAccessLoading || !isEditDirty;

  useEffect(() => {
    const requestId = selectedPermissionRequestRef.current + 1;
    selectedPermissionRequestRef.current = requestId;

    if (!selectedMember) {
      Promise.resolve().then(() => {
        setSelectedPermissionKeys([]);
      });
      Promise.resolve().then(() => {
        setSelectedPermissionsLoading(false);
      });
      return;
    }
    if (selectedMember.roleLevel >= 50) {
      Promise.resolve().then(() => {
        setSelectedPermissionKeys(MEMBER_PERMISSION_OPTIONS.map((option) => option.key));
      });
      Promise.resolve().then(() => {
        setSelectedPermissionsLoading(false);
      });
      return;
    }

    Promise.resolve().then(() => {
      setSelectedPermissionsLoading(true);
    });
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
    setModalMember(member);
    setEditRole(initialRole);
    setEditClassIds([]);
    setEditPermissionKeys([]);
    setEditInitialSnapshot(null);
    setShowEditCloseConfirm(false);
    setEditAccessLoading(true);
    setModalMode("edit");
    try {
      const [permissions, classHeads] = await Promise.all([
        adminListMemberPermissions(organizationId, member.userId),
        adminListOrgMemberClassAssignments(organizationId).catch(() =>
          adminListOrgMemberClassHeads(organizationId)
        ),
      ]);
      if (editPermissionRequestRef.current !== requestId) return;
      const initialClassIds = classHeads
        .filter((head) => head.userId === member.userId)
        .map((head) => head.classId);
      const initialPermissionKeys = preserveOwnMemberManagementPermission({
        actorUserId: session?.user?.id,
        targetUserId: member.userId,
        permissionKeys: permissions
          .filter((permission) => permission.isAllowed)
          .map((permission) => permission.permissionKey),
      });
      setEditClassIds(initialClassIds);
      setEditPermissionKeys(initialPermissionKeys);
      setEditInitialSnapshot(
        createMemberAccessFormSnapshot({
          role: initialRole,
          classIds: initialClassIds,
          permissionKeys: initialPermissionKeys,
        })
      );
    } catch (error) {
      if (editPermissionRequestRef.current !== requestId) return;
      showSaveToast({
        variant: "error",
        error,
      });
    } finally {
      if (editPermissionRequestRef.current === requestId) {
        setEditAccessLoading(false);
      }
    }
  };

  const closeEditModal = useCallback(() => {
    editPermissionRequestRef.current += 1;
    editSubmissionRef.current = null;
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

  const openDeactivateMember = (member: OrgMember) => {
    const assignedClassCount = (classesByUser.get(member.userId) ?? []).length;
    const blockReason = getMemberDeactivationBlockReason(
      member,
      members,
      assignedClassCount
    );
    setDeactivateIssue(
      blockReason ? { message: blockReason, blocking: true } : null
    );
    setDeactivateMember(member);
  };

  const closeDeactivateMember = () => {
    if (deactivateBusy) return;
    setDeactivateMember(null);
    setDeactivateIssue(null);
  };

  const submitDeactivateMember = async () => {
    if (!deactivateMember || deactivateBusy || deactivateIssue?.blocking) return;
    setDeactivateBusy(true);
    setDeactivateIssue(null);
    try {
      await adminRemoveOrgMember(organizationId, deactivateMember.userId);
      setDeactivateMember(null);
      setDeactivateIssue(null);
      await onRefresh();
    } catch (error) {
      setDeactivateIssue(formatMemberDeactivationError(error));
    } finally {
      setDeactivateBusy(false);
    }
  };

  const submitInvite = async (channel: "email" | "link") => {
    if (inviteRole === "student") {
      router.push("/coord/management/athletes" as never);
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
      `Você recebeu um convite para acessar ${organizationName} no Go Atleta como ${roleText}.\n\nAbra o link para aceitar:\n${link}`;

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
    const member = modalMember;
    const snapshot = currentEditSnapshot;
    const signature = JSON.stringify(snapshot);
    if (editSubmissionRef.current?.signature !== signature) {
      editSubmissionRef.current = {
        signature,
        idempotencyKey: createMemberAccessIdempotencyKey(),
      };
    }
    const idempotencyKey = editSubmissionRef.current.idempotencyKey;
    setEditBusy(true);
    try {
      const receipt = await adminApplyMemberAccessChange({
        organizationId,
        userId: member.userId,
        roleLevel: editRole,
        classIds: snapshot.classIds,
        permissionKeys: snapshot.permissionKeys as MemberPermissionKey[],
        idempotencyKey,
      });
      setEditInitialSnapshot(snapshot);
      closeEditModal();
      showSaveToast({
        variant: "success",
        message: formatMemberAccessSuccessMessage({
          displayName: member.displayName,
          classCount: receipt.classCount,
          permissionCount: receipt.permissionCount,
          notificationCreated: Boolean(receipt.notificationId),
        }),
      });
      try {
        await onRefresh();
      } catch {
        showSaveToast({
          variant: "warning",
          message:
            "As alterações foram salvas, mas a lista não pôde ser atualizada agora. Recarregue a tela.",
        });
      }
    } catch (error) {
      showSaveToast({ variant: "error", error });
    } finally {
      setEditBusy(false);
    }
  };

  const messageText = modalMember
    ? `Olá, ${modalMember.displayName.split(" ")[0]}. ${
        selectedAttendance.length
          ? `Há ${selectedAttendance.length} chamada(s) pendente(s) nas suas turmas.`
          : "Sua operação está em dia."
      } Acesse o Go Atleta para conferir os detalhes.`
    : "";

  const uniqueClasses = new Set(memberClassHeads.map((item) => item.classId)).size;
  const pendingAccessCount =
    visibleInvites.filter((invite) => inviteNeedsAction(invite)).length + accessRequests.length;
  const moduleMeta: Record<SecondaryModuleKey, { label: string; value: string | number }> = {
    attendance: { label: "Chamadas pendentes", value: pendingAttendance.length },
    access: { label: "Convites e solicitações", value: pendingAccessCount },
    reports: { label: "Relatórios pendentes", value: pendingReports.length },
    activity: { label: "Atividade recente", value: recentActivity.length },
  };

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
          {accessRequests.length ? (
            <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 }}>
              <Text style={{ color: colors.text, fontSize: 12, fontWeight: "800" }}>
                Solicitações para revisar
              </Text>
            </View>
          ) : null}
          {accessRequests.map((request) => {
            const requestRole = accessRequestRoles[request.id] ?? 10;
            const busy = accessRequestBusyId === request.id;
            const review = async (decision: "approved" | "rejected") => {
              if (accessRequestBusyId) return;
              setAccessRequestBusyId(request.id);
              try {
                await adminReviewOrgAccessRequest({
                  requestId: request.id,
                  decision,
                  roleLevel: requestRole,
                  idempotencyKey: createMemberAccessIdempotencyKey(),
                });
                showSaveToast({
                  variant: "success",
                  message:
                    decision === "approved"
                      ? `Acesso de ${request.requesterName.split(" ")[0]} aprovado.`
                      : "Solicitação recusada.",
                });
                await onRefresh();
              } catch (error) {
                showSaveToast({ variant: "error", error });
              } finally {
                setAccessRequestBusyId(null);
              }
            };
            return (
              <View
                key={request.id}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 11,
                  borderBottomWidth: 1,
                  borderBottomColor: border,
                  gap: 9,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "700" }}>
                      {request.requesterName}
                    </Text>
                    <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11 }}>
                      {request.requesterEmail}
                    </Text>
                  </View>
                  <DropdownButton
                    value={requestRole}
                    onChange={(role) =>
                      setAccessRequestRoles((current) => ({ ...current, [request.id]: role }))
                    }
                    disabled={busy}
                    density="compact"
                    compact
                    options={[
                      { value: 10, label: "Professor" },
                      { value: 5, label: "Estagiário" },
                      { value: 50, label: "Coordenação" },
                    ]}
                  />
                </View>
                <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
                  <Pressable
                    disabled={busy}
                    onPress={() => void review("rejected")}
                    style={{
                      borderRadius: radius.internal,
                      borderWidth: 1,
                      borderColor: border,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      opacity: busy ? 0.55 : 1,
                    }}
                  >
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
                      Recusar
                    </Text>
                  </Pressable>
                  <Pressable
                    disabled={busy}
                    onPress={() => void review("approved")}
                    style={{
                      borderRadius: radius.internal,
                      backgroundColor: colors.primaryBg,
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      opacity: busy ? 0.55 : 1,
                    }}
                  >
                    <Text style={{ color: colors.primaryText, fontSize: 12, fontWeight: "800" }}>
                      {busy ? "Salvando..." : "Aprovar acesso"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
          {visibleInvites.length ? (
            <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 }}>
              <Text style={{ color: colors.text, fontSize: 12, fontWeight: "800" }}>
                Convites enviados
              </Text>
            </View>
          ) : null}
          {visibleInvites.map((invite) => {
            const lifecycleStatus = resolveInviteLifecycleStatus(invite);
            const status =
              lifecycleStatus === "accepted"
                ? "Aceito automaticamente"
                : lifecycleStatus === "revoked"
                  ? "Cancelado"
                  : lifecycleStatus === "claim_failed"
                    ? "Falha no vínculo"
                    : lifecycleStatus === "delivery_failed"
                      ? "Falha no envio"
                      : lifecycleStatus === "expired"
                        ? "Expirado"
                        : "Convite enviado";
            const statusColor =
              lifecycleStatus === "accepted"
                ? colors.successText
                : lifecycleStatus !== "sent"
                  ? colors.dangerText
                  : colors.warningText;
            return (
              <View
                key={invite.id}
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
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "700" }}>
                    {invite.invited_to ?? "Convite por link"}
                  </Text>
                  <Text style={{ color: statusColor, fontSize: 11 }}>{status}</Text>
                </View>
                {inviteNeedsAction(invite) ? (
                  <InviteActionMenu
                    invite={invite}
                    onCancel={(target) => undoableInviteCancel.deleteOne(target)}
                  />
                ) : null}
              </View>
            );
          })}
          {!pendingAccessCount ? (
            <Text style={{ color: colors.muted, fontSize: 12, padding: 16 }}>
              Nenhum acesso aguardando ação.
            </Text>
          ) : null}
        </ScrollView>
      );
    }
    if (key === "reports") {
      return (
        <ScrollView style={{ maxHeight: listMaxHeight }} showsVerticalScrollIndicator>
          {pendingReports.map((report, index) => (
            <Pressable
              key={`${report.classId}:${index}`}
              onPress={() => onOpenReport(report)}
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
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "700" }}>{report.className}</Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  {report.daysWithoutReport} dias sem registro • {report.unit || "Sem unidade"}
                </Text>
              </View>
              <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>Registrar aula</Text>
              <GoAtletaIcon name="chevronRight" size={16} color={colors.muted} />
            </Pressable>
          ))}
          {!pendingReports.length ? (
            <Text style={{ color: colors.muted, fontSize: 12, padding: 16 }}>
              Todas as turmas têm registros recentes.
            </Text>
          ) : null}
        </ScrollView>
      );
    }
    if (key === "activity") {
      return (
        <ScrollView style={{ maxHeight: listMaxHeight }} showsVerticalScrollIndicator>
          {recentActivity.map((activity, index) => (
            <View
              key={`${activity.kind}:${activity.classId}:${activity.occurredAt}:${index}`}
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
              <GoAtletaIcon
                name={activity.kind === "attendance" ? "attendance" : "document"}
                size={17}
                color={colors.muted}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "700" }}>
                  {activity.kind === "attendance" ? "Chamada registrada" : "Registro de aula criado"}
                  {` • ${activity.className}`}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  {new Date(activity.occurredAt).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {activity.affectedRows > 0 ? ` • ${activity.affectedRows} registros` : ""}
                </Text>
              </View>
            </View>
          ))}
          {!recentActivity.length ? (
            <Text style={{ color: colors.muted, fontSize: 12, padding: 16 }}>
              Nenhuma execução registrada nos últimos 7 dias.
            </Text>
          ) : null}
        </ScrollView>
      );
    }
    return null;
  };

  return (
    <View style={{ flex: 1, minHeight: 0, backgroundColor: colors.background }}>
      <ScreenPageHeader
        title="Coordenação"
        subtitle={`${organizationName} • ${new Date().toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })}`}
        onBack={() => router.push("/coord/dashboard")}
        right={
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Gerenciar acessos familiares"
              onPress={() => setShowFamilyAccess(true)}
              style={{
                height: 44,
                width: compact ? 44 : undefined,
                paddingHorizontal: compact ? 0 : 12,
                borderRadius: radius.internal,
                borderWidth: 1,
                borderColor: border,
                backgroundColor: colors.secondaryBg,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
              }}
            >
              <GoAtletaIcon name="family" size={17} color={colors.text} />
              {!compact ? (
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: "800" }}>
                  Acessos familiares
                </Text>
              ) : null}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Abrir gestão de atletas"
              onPress={() => router.push("/coord/management/athletes" as never)}
              style={{
                height: 44,
                width: compact ? 44 : undefined,
                paddingHorizontal: compact ? 0 : 12,
                borderRadius: radius.internal,
                borderWidth: 1,
                borderColor: border,
                backgroundColor: colors.secondaryBg,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
              }}
            >
              <GoAtletaIcon name="students" size={17} color={colors.text} />
              {!compact ? (
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: "800" }}>
                  Atletas
                </Text>
              ) : null}
            </Pressable>
          </View>
        }
        horizontalBleed={pageHorizontalGutter}
        style={
          Platform.OS === "web" && compact
            ? {
                marginLeft: -pageHorizontalGutter,
                marginRight: -pageHorizontalGutter,
                paddingLeft: pageHorizontalGutter,
                paddingRight: pageHorizontalGutter,
              }
            : undefined
        }
        contentStyle={{ paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 }}
      />

      <ScrollView
        style={{ flex: 1, minHeight: 0, backgroundColor: colors.background }}
        contentContainerStyle={{ gap: 12, paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <AppRefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={colors.text}
            colors={[colors.text]}
          />
        }
      >
      <View
        style={{
          borderRadius: radius.internal,
          borderWidth: 1,
          borderColor: border,
          backgroundColor: panel,
          paddingVertical: compact ? 9 : 12,
          paddingHorizontal: compact ? 8 : 12,
          flexDirection: "row",
        }}
      >
        {[
          ["members", members.length, "membros"],
          ["communications", pendingAccessCount, "acessos pendentes"],
          ["attendance", pendingAttendance.length, "chamadas pendentes"],
          ["classes", uniqueClasses, "turmas"],
          ["reports", healthScore === null ? "..." : `${healthScore}%`, "operacional"],
        ].map(([icon, value, label], index) => (
          <View
            key={String(label)}
            accessible
            accessibilityLabel={`${loading ? "Carregando" : value} ${label}`}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: compact ? 72 : 78,
              justifyContent: "center",
              alignItems: "center",
              gap: compact ? 3 : 5,
              paddingHorizontal: compact ? 3 : 8,
              borderLeftWidth: index > 0 ? 1 : 0,
              borderLeftColor: border,
            }}
          >
            <GoAtletaIcon
              name={icon as GoAtletaIconName}
              size={compact ? 18 : 20}
              color={colors.muted}
            />
            <Text
              style={{
                color: colors.text,
                fontSize: compact ? 18 : 20,
                lineHeight: compact ? 21 : 24,
                fontWeight: "800",
                textAlign: "center",
              }}
            >
              {loading ? "..." : value}
            </Text>
            <Text
              numberOfLines={2}
              style={{
                color: colors.muted,
                fontSize: compact ? 9 : 11,
                lineHeight: compact ? 11 : 14,
                textAlign: "center",
              }}
            >
              {label}
            </Text>
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
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  <View
                    style={{
                      flex: 1,
                      minWidth: compact ? 0 : 220,
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
                      placeholder="Buscar pessoas..."
                      placeholderTextColor={colors.placeholder}
                      style={{ color: colors.inputText, flex: 1, paddingVertical: 10 }}
                    />
                    <GoAtletaIcon name="search" size={17} color={colors.muted} />
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Convidar pessoa"
                    onPress={openInvite}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: radius.internal,
                      borderWidth: 1,
                      borderColor: border,
                      backgroundColor: colors.secondaryBg,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <GoAtletaIcon name="addStudent" size={20} color={colors.text} />
                  </Pressable>
                </View>

                {!compact ? (
                  <View style={{ paddingHorizontal: 18, paddingVertical: 8, flexDirection: "row" }}>
                    {(
                      [
                        ["PESSOA", "name", 1.35],
                        ["FUNÇÃO", "role", 1],
                        ["TURMAS", "classes", 0.8],
                        ["CHAMADAS PENDENTES", "attendance", 1.05],
                        ["ÚLTIMO ACESSO", "lastAccess", 0.9],
                      ] as const
                    ).map(([label, key, flex]) => (
                      <Pressable
                        key={key}
                        accessibilityRole="button"
                        accessibilityLabel={`Ordenar por ${label}`}
                        suppressWebHoverFeedback
                        disableWebPressScale
                        onPress={() => selectPeopleSort(key)}
                        style={{
                          flex,
                          minHeight: 30,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Text
                          style={{
                            color: peopleSortKey === key ? colors.text : colors.muted,
                            fontSize: 10,
                            fontWeight: "700",
                          }}
                        >
                          {label}
                        </Text>
                        {peopleSortKey === key ? (
                          <Animated.View
                            style={{
                              opacity: peopleSortIndicator,
                              transform: [
                                {
                                  scale: peopleSortIndicator.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0.78, 1],
                                  }),
                                },
                                {
                                  translateY: peopleSortIndicator.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [-3, 0],
                                  }),
                                },
                              ],
                            }}
                          >
                            <GoAtletaIcon name="swapVertical" size={13} color={colors.text} />
                          </Animated.View>
                        ) : (
                          <GoAtletaIcon name="swapVertical" size={13} color={colors.muted} />
                        )}
                      </Pressable>
                    ))}
                    <View style={{ width: 44 }} />
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
                    const displayLabel = getMemberDisplayLabel(member, session?.user.id);
                    return (
                      <View
                        key={member.userId}
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
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Selecionar ${displayLabel}`}
                          accessibilityState={{ selected }}
                          onPress={() => setSelectedMemberId(member.userId)}
                          style={{
                            flex: 1,
                            minWidth: 0,
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
                            <View style={{ flex: 1, minWidth: 0, gap: compact ? 3 : 0 }}>
                              <Text
                                numberOfLines={1}
                                style={{ color: colors.text, fontWeight: "700" }}
                              >
                                {displayLabel}
                              </Text>
                              {compact ? (
                                <View
                                  style={{
                                    flexDirection: "row",
                                    flexWrap: "wrap",
                                    alignItems: "center",
                                    columnGap: 6,
                                    rowGap: 2,
                                  }}
                                >
                                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                                    {roleLabel(member.roleLevel)}
                                  </Text>
                                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                                    {assigned.length
                                      ? `${assigned.length} ${assigned.length === 1 ? "turma" : "turmas"}`
                                      : "Sem turma"}
                                  </Text>
                                  {attendanceCount ? (
                                    <Text style={{ color: colors.warningText, fontSize: 11 }}>
                                      {attendanceCount} {attendanceCount === 1 ? "chamada" : "chamadas"}
                                    </Text>
                                  ) : null}
                                </View>
                              ) : null}
                            </View>
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
                            </>
                          ) : null}
                        </Pressable>
                        <MemberActionMenu
                          member={member}
                          viewportHeight={height}
                          onEdit={(value) => void openEdit(value)}
                          onMessage={openMessage}
                          onDeactivate={openDeactivateMember}
                        />
                      </View>
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
                      color: colors.text,
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
                    {getMemberDisplayLabel(selectedMember, session?.user.id)}
                  </Text>
                  <Text style={{ color: colors.muted }}>
                    {formatMemberLastAccess(selectedMember.lastAccessAt)}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Editar perfil e permissões de ${selectedMember.displayName}`}
                  onPress={() => void openEdit(selectedMember)}
                  style={{
                    minHeight: 44,
                    borderRadius: radius.internal,
                    borderWidth: 1,
                    borderColor: border,
                    paddingHorizontal: 12,
                    paddingVertical: 9,
                    flexDirection: "row",
                    alignItems: "center",
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
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Ver todas as turmas de ${selectedMember.displayName}`}
                    onPress={() => void openEdit(selectedMember)}
                  >
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
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Ver todas as permissões de ${selectedMember.displayName}`}
                    onPress={() => void openEdit(selectedMember)}
                  >
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
      </ScrollView>

      <ModalSheet
        visible={showFamilyAccess}
        onClose={() => setShowFamilyAccess(false)}
        position="center"
        cardStyle={{
          width: compact ? Math.max(0, width - 32) : 1120,
          maxWidth: "100%",
          height: compact ? "94%" : "88%",
          maxHeight: "94%",
          borderRadius: radius.container,
          borderWidth: 1,
          borderColor: border,
          backgroundColor: colors.card,
          overflow: "hidden",
          padding: 0,
        }}
      >
        <CoordinationFamilyAccessScreen embedded onClose={() => setShowFamilyAccess(false)} />
      </ModalSheet>

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
            style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
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
                    router.push("/coord/management/athletes" as never);
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
              width: 44,
              height: 44,
              flexShrink: 0,
              marginLeft: 12,
              borderRadius: 22,
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
              disabled={editAccessLoading || (modalMember?.roleLevel ?? 0) >= 50}
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
              <View
                style={{
                  minHeight: 22,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "800" }}>
                  Turmas atribuídas
                </Text>
                <View
                  style={{
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: border,
                    backgroundColor: inner,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                  }}
                >
                  <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>
                    {editClassIds.length} de {organizationClasses.length}
                  </Text>
                </View>
              </View>
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
                {editAccessLoading ? (
                  <View style={{ padding: 14 }}>
                    <Text style={{ color: colors.muted }}>Carregando turmas atribuídas...</Text>
                  </View>
                ) : (
                  groupedOrganizationClasses.map((group) => (
                    <View key={group.unit}>
                      <View
                        style={{
                          minHeight: 36,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderBottomWidth: 1,
                          borderBottomColor: border,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                          backgroundColor: inner,
                        }}
                      >
                        <GoAtletaIcon
                          name="organization"
                          size={15}
                          color={colors.muted}
                        />
                        <Text
                          numberOfLines={1}
                          style={{
                            color: colors.text,
                            flex: 1,
                            fontSize: 12,
                            fontWeight: "800",
                          }}
                        >
                          {group.unit}
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 11 }}>
                          {group.classes.length}{" "}
                          {group.classes.length === 1 ? "turma" : "turmas"}
                        </Text>
                      </View>
                      {group.classes.map((item) => {
                        const checked = editClassIds.includes(item.id);
                        const { daysLabel, timeLabel } =
                          getClassAssignmentScheduleLabels(item);
                        return (
                          <Pressable
                            key={item.id}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked }}
                            accessibilityLabel={`${item.name}, ${group.unit}, ${daysLabel}, ${timeLabel}`}
                            onPress={() =>
                              setEditClassIds((current) =>
                                checked
                                  ? current.filter((id) => id !== item.id)
                                  : [...current, item.id]
                              )
                            }
                            style={{
                              minHeight: 58,
                              paddingHorizontal: 12,
                              paddingVertical: 9,
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
                            <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
                              <Text
                                numberOfLines={1}
                                style={{ color: colors.text, fontWeight: "700" }}
                              >
                                {item.name}
                              </Text>
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  flexWrap: "wrap",
                                  columnGap: 14,
                                  rowGap: 4,
                                }}
                              >
                                <View
                                  style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 5,
                                  }}
                                >
                                  <GoAtletaIcon
                                    name="calendar"
                                    size={13}
                                    color={colors.muted}
                                  />
                                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                                    {daysLabel}
                                  </Text>
                                </View>
                                <View
                                  style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 5,
                                  }}
                                >
                                  <GoAtletaIcon
                                    name="time"
                                    size={13}
                                    color={colors.muted}
                                  />
                                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                                    {timeLabel}
                                  </Text>
                                </View>
                              </View>
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  ))
                )}
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
                {editAccessLoading ? (
                  <View style={{ padding: 14 }}>
                    <Text style={{ color: colors.muted }}>Carregando permissões...</Text>
                  </View>
                ) : (
                  <ScrollView showsVerticalScrollIndicator nestedScrollEnabled>
                    {MEMBER_PERMISSION_OPTIONS.map((option) => {
                      const protectsOwnMemberManagement =
                        option.key === "org_members" &&
                        Boolean(session?.user?.id) &&
                        modalMember?.userId === session?.user?.id;
                      const checked =
                        protectsOwnMemberManagement ||
                        editPermissionKeys.includes(option.key);
                      return (
                        <Pressable
                          key={option.key}
                          accessibilityRole="checkbox"
                          accessibilityState={{
                            checked,
                            disabled: protectsOwnMemberManagement,
                          }}
                          accessibilityHint={
                            protectsOwnMemberManagement
                              ? "Mantida para preservar seu acesso à gestão."
                              : undefined
                          }
                          disabled={protectsOwnMemberManagement}
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
                            opacity: protectsOwnMemberManagement ? 0.72 : 1,
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
                          {protectsOwnMemberManagement ? (
                            <Text style={{ color: colors.muted, fontSize: 11 }}>
                              Seu acesso
                            </Text>
                          ) : null}
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
        message="As alterações feitas serão perdidas."
        confirmLabel="Sair sem salvar"
        cancelLabel="Continuar editando"
        onConfirm={closeEditModal}
        onCancel={() => setShowEditCloseConfirm(false)}
      />

      <ModalSheet
        visible={Boolean(deactivateMember)}
        onClose={closeDeactivateMember}
        position="center"
        overlayZIndex={30000}
        backdropOpacity={0.7}
        cardStyle={{
          width: compact ? "100%" : 440,
          maxWidth: "100%",
          padding: 18,
          gap: 16,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>
              {deactivateIssue?.blocking
                ? "Acesso não pode ser desativado"
                : `Desativar acesso de ${deactivateMember?.displayName.split(" ")[0]}?`}
            </Text>
            <Text style={{ color: colors.muted, lineHeight: 20 }}>
              {deactivateIssue?.message ??
                `A pessoa perderá o acesso a ${organizationName} e às turmas atribuídas.`}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar aviso de desativação"
            disabled={deactivateBusy}
            onPress={closeDeactivateMember}
            style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
          >
            <GoAtletaIcon name="close" size={21} color={colors.text} />
          </Pressable>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10 }}>
          {deactivateIssue?.blocking ? (
            <Pressable
              onPress={closeDeactivateMember}
              style={{
                borderRadius: radius.internal,
                backgroundColor: colors.secondaryBg,
                paddingHorizontal: 18,
                paddingVertical: 10,
              }}
            >
              <Text style={{ color: colors.secondaryText, fontWeight: "800" }}>Entendi</Text>
            </Pressable>
          ) : (
            <>
              <Pressable
                disabled={deactivateBusy}
                onPress={closeDeactivateMember}
                style={{
                  borderRadius: radius.internal,
                  backgroundColor: colors.secondaryBg,
                  paddingHorizontal: 18,
                  paddingVertical: 10,
                  opacity: deactivateBusy ? 0.55 : 1,
                }}
              >
                <Text style={{ color: colors.secondaryText, fontWeight: "800" }}>
                  Manter acesso
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: deactivateBusy }}
                disabled={deactivateBusy}
                onPress={() => void submitDeactivateMember()}
                style={{
                  borderRadius: radius.internal,
                  backgroundColor: colors.dangerSolidBg,
                  paddingHorizontal: 18,
                  paddingVertical: 10,
                  opacity: deactivateBusy ? 0.55 : 1,
                }}
              >
                <Text style={{ color: colors.dangerSolidText, fontWeight: "800" }}>
                  {deactivateBusy ? "Desativando..." : "Desativar"}
                </Text>
              </Pressable>
            </>
          )}
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
