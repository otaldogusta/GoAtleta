import { Dimensions, Image, Platform, StyleSheet, Text, View } from "react-native";
import { memo, useCallback, useEffect, useRef, useState } from "react";

import type { ClassGroup } from "../../../core/models";
import { markRender } from "../../../observability/perf";
import type { ClassCardViewModel } from "../application/class-card-view-model";
import { radius, shadow } from "../../../theme/tokens";
import { ClassGenderBadge } from "../../../ui/ClassGenderBadge";
import { Pressable } from "../../../ui/Pressable";
import { AnchoredDropdown } from "../../../ui/AnchoredDropdown";
import { GoAtletaIcon } from "../../../ui/icon-registry";
import { ShimmerBlock } from "../../../ui/Shimmer";

type Conflict = {
  name: string;
  day: number;
  modality?: string;
  kind: "conflict" | "integration";
};

type ClassCardProps = {
  item: ClassGroup;
  conflicts?: Conflict[] | null;
  dayNames: string[];
  colors: Record<string, string>;
  onOpen: (value: ClassGroup) => void;
  viewModel: ClassCardViewModel;
  actionMenuOpen?: boolean;
  onToggleActionMenu?: (classId: string) => void;
  onCloseActionMenu?: () => void;
  onEdit?: (value: ClassGroup) => void;
  onDuplicate?: (value: ClassGroup) => void;
  onDelete?: (value: ClassGroup) => void;
  layout?: "card" | "table";
  showUnit?: boolean;
  narrowCard?: boolean;
};

const parseTime = (value: string) => {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
};

const formatTimeRange = (hour: number, minute: number, durationMinutes: number) => {
  const start = hour * 60 + minute;
  const end = start + durationMinutes;
  const endHour = Math.floor(end / 60) % 24;
  const endMinute = end % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(hour)}:${pad(minute)} - ${pad(endHour)}:${pad(endMinute)}`;
};

const formatDays = (days: number[], dayNames: string[]) =>
  days.length ? days.map((day) => dayNames[day] ?? "").filter(Boolean).join(", ") : "-";

function MetaPill({
  label,
  colors,
  tone = "neutral",
  compact = false,
}: {
  label: string;
  colors: Record<string, string>;
  tone?: "neutral" | "success" | "warning";
  compact?: boolean;
}) {
  const pillBg =
    tone === "success"
      ? colors.successBg ?? colors.secondaryBg
      : tone === "warning"
        ? colors.warningBg ?? colors.secondaryBg
        : colors.backgroundSubtle ?? colors.secondaryBg;
  const pillBorder =
    tone === "success"
      ? colors.successBorder ?? colors.border
      : tone === "warning"
        ? colors.warningBorder ?? colors.border
        : colors.borderSubtle ?? colors.border;
  const pillText =
    tone === "success"
      ? colors.successText ?? colors.text
      : tone === "warning"
        ? colors.warningText ?? colors.text
        : colors.textMuted ?? colors.muted;
  return (
    <View
      style={[
        styles.metaPill,
        compact ? styles.metaPillCompact : null,
        {
          backgroundColor: pillBg,
          borderColor: pillBorder,
        },
      ]}
    >
      <Text numberOfLines={1} style={[styles.metaPillText, { color: pillText }]}>
        {label}
      </Text>
    </View>
  );
}

const StudentAvatarItem = memo(function StudentAvatarItem({
  avatar,
  index,
  borderColor,
}: {
  avatar: ClassCardViewModel["visibleStudents"][number];
  index: number;
  borderColor: string;
}) {
  const [failedPhotoUrl, setFailedPhotoUrl] = useState<string | null>(null);
  const [loadedPhotoUrl, setLoadedPhotoUrl] = useState<string | null>(null);
  const photoUrl = avatar.photoUrl?.trim() || null;
  const showImage = Boolean(photoUrl && failedPhotoUrl !== photoUrl);
  const imageLoaded = Boolean(photoUrl && loadedPhotoUrl === photoUrl);
  const initials = (avatar.label || "A").trim() || "A";
  const handleImageLoad = useCallback(() => {
    setLoadedPhotoUrl(photoUrl);
  }, [photoUrl]);
  const handleImageError = useCallback(() => {
    setFailedPhotoUrl(photoUrl);
    setLoadedPhotoUrl(null);
  }, [photoUrl]);

  return (
    <View
      style={[
        styles.studentAvatar,
        {
          backgroundColor: avatar.color,
          borderColor,
          marginLeft: index === 0 ? 0 : -8,
        },
      ]}
    >
      {showImage ? (
        <>
          {!imageLoaded ? <ShimmerBlock style={styles.studentAvatarShimmer} /> : null}
          <Image
            source={{ uri: photoUrl! }}
            style={[
              styles.studentAvatarImage,
              !imageLoaded ? styles.studentAvatarImageLoading : null,
            ]}
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        </>
      ) : (
        <Text style={styles.studentAvatarText}>{initials}</Text>
      )}
    </View>
  );
});

const TeacherAvatarItem = memo(function TeacherAvatarItem({
  teacher,
  infoBg,
  infoText,
  containerStyle,
  imageStyle,
  textStyle,
}: {
  teacher: ClassCardViewModel["teacher"];
  infoBg: string;
  infoText: string;
  containerStyle: any;
  imageStyle: any;
  textStyle: any;
}) {
  const [imageError, setImageError] = useState(false);
  const showImage = Boolean(teacher.photoUrl && !imageError);
  const initials = (teacher.initials || "PR").trim() || "PR";

  return (
    <View style={[containerStyle, { backgroundColor: infoBg }]}>
      {showImage ? (
        <Image
          source={{ uri: teacher.photoUrl }}
          style={imageStyle}
          onError={() => setImageError(true)}
        />
      ) : (
        <Text style={[textStyle, { color: infoText }]}>{initials}</Text>
      )}
    </View>
  );
});

const StaffAvatarItem = memo(function StaffAvatarItem({
  member,
  index = 0,
  borderColor,
  size = 22,
}: {
  member: ClassCardViewModel["supportStaff"][number];
  index?: number;
  borderColor: string;
  size?: number;
}) {
  const [failedPhotoUrl, setFailedPhotoUrl] = useState<string | null>(null);
  const [loadedPhotoUrl, setLoadedPhotoUrl] = useState<string | null>(null);
  const photoUrl = member.photoUrl?.trim() || null;
  const showImage = Boolean(photoUrl && failedPhotoUrl !== photoUrl);
  const imageLoaded = Boolean(photoUrl && loadedPhotoUrl === photoUrl);

  return (
    <View
      style={[
        styles.staffAvatar,
        {
          width: size,
          height: size,
          backgroundColor: member.color,
          borderColor,
          marginLeft: index === 0 ? 0 : -6,
        },
      ]}
    >
      {showImage ? (
        <>
          {!imageLoaded ? <ShimmerBlock style={styles.staffAvatarShimmer} /> : null}
          <Image
            source={{ uri: photoUrl! }}
            style={[styles.staffAvatarImage, !imageLoaded ? styles.staffAvatarImageLoading : null]}
            onLoad={() => setLoadedPhotoUrl(photoUrl)}
            onError={() => {
              setFailedPhotoUrl(photoUrl);
              setLoadedPhotoUrl(null);
            }}
          />
        </>
      ) : (
        <Text style={styles.staffAvatarText}>{member.initials}</Text>
      )}
    </View>
  );
});

function StaffTeamPill({
  members,
  colors,
  compact = false,
}: {
  members: ClassCardViewModel["supportStaff"];
  colors: Record<string, string>;
  compact?: boolean;
}) {
  const triggerRef = useRef<View | null>(null);
  const [open, setOpen] = useState(false);
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [triggerLayout, setTriggerLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const visibleMembers = members.slice(0, 2);
  const extraCount = Math.max(0, members.length - visibleMembers.length);

  const close = useCallback(() => {
    setOpen(false);
    setPinnedOpen(false);
  }, []);

  const show = useCallback((pin = false) => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      const panelWidth = Math.min(248, Math.max(220, Dimensions.get("window").width - 32));
      const panelX = Math.max(
        16,
        Math.min(x + width - panelWidth, Dimensions.get("window").width - panelWidth - 16)
      );
      setTriggerLayout({ x: panelX, y, width: panelWidth, height });
      setOpen(true);
      if (pin) setPinnedOpen(true);
    });
  }, []);

  if (!members.length) return null;

  const details = (
    <>
      {members.map((member) => (
        <View key={`${member.role}:${member.id}`} style={styles.staffPopoverRow}>
          <StaffAvatarItem
            member={member}
            borderColor={colors.surfaceElevated ?? colors.card}
            size={30}
          />
          <Text
            numberOfLines={1}
            style={[styles.staffPopoverName, { color: colors.textPrimary ?? colors.text }]}
          >
            {member.name}
            <Text style={[styles.staffPopoverRole, { color: colors.textMuted ?? colors.muted }]}> — {member.roleLabel}</Text>
          </Text>
        </View>
      ))}
    </>
  );

  return (
    <View ref={triggerRef} style={styles.staffPillWrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${members.length} ${members.length === 1 ? "profissional de apoio" : "profissionais de apoio"}`}
        accessibilityState={{ expanded: open }}
        disableWebPressScale
        suppressWebHoverFeedback
        onHoverIn={() => show(false)}
        onHoverOut={() => {
          if (!pinnedOpen) setOpen(false);
        }}
        onFocus={() => show(false)}
        onBlur={() => {
          if (!pinnedOpen) setOpen(false);
        }}
        onPress={(event) => {
          event.stopPropagation?.();
          if (open && pinnedOpen) close();
          else show(true);
        }}
        style={(state) => [
          styles.staffPill,
          compact ? styles.staffPillCompact : null,
          {
            backgroundColor:
              open || pressedOrHovered(state)
                ? colors.backgroundSubtle ?? colors.secondaryBg
                : colors.secondaryBg,
            borderColor: open
              ? colors.primaryBg ?? colors.border
              : colors.borderSubtle ?? colors.border,
          },
        ]}
      >
        <View style={styles.staffAvatarStack}>
          {visibleMembers.map((member, index) => (
            <StaffAvatarItem
              key={`${member.role}:${member.id}`}
              member={member}
              index={index}
              borderColor={colors.secondaryBg}
              size={compact ? 19 : 21}
            />
          ))}
        </View>
        {extraCount > 0 ? (
          <Text style={[styles.staffExtraCount, { color: colors.textMuted ?? colors.muted }]}>+{extraCount}</Text>
        ) : null}
      </Pressable>

      {Platform.OS === "web" ? (
        <AnchoredDropdown
          visible={open}
          layout={triggerLayout}
          container={null}
          animationStyle={{ opacity: 1 }}
          zIndex={12600}
          maxHeight={Math.min(174, members.length * 48 + 12)}
          nestedScrollEnabled={false}
          density="compact"
          interactiveRefs={[triggerRef]}
          onRequestClose={close}
          showVerticalScrollIndicator={false}
          panelStyle={{ backgroundColor: colors.surfaceElevated ?? colors.card }}
          scrollContentStyle={styles.staffPopoverContent}
        >
          {details}
        </AnchoredDropdown>
      ) : open ? (
        <View
          style={[
            styles.staffNativePopover,
            {
              backgroundColor: colors.surfaceElevated ?? colors.card,
              borderColor: colors.borderSubtle ?? colors.border,
            },
          ]}
        >
          {details}
        </View>
      ) : null}
    </View>
  );
}

const getClassInitial = (name: string) => {
  const clean = name.trim();
  if (!clean) return "T";
  return clean[0]?.toUpperCase() ?? "T";
};

const getDomSafeId = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "_");

const pressedOrHovered = (state: { pressed: boolean; hovered?: boolean }) =>
  Boolean(state.pressed || state.hovered);

const ACTION_MENU_Z_INDEX = 12000;
const ACTION_MENU_WIDTH = 132;
const ACTION_MENU_ESTIMATED_HEIGHT = 150;
type ActionMenuLayout = { left: number; top: number };

export const ClassCard = memo(function ClassCard({
  item,
  conflicts,
  dayNames,
  colors,
  onOpen,
  viewModel,
  actionMenuOpen = false,
  onToggleActionMenu,
  onCloseActionMenu,
  onEdit,
  onDuplicate,
  onDelete,
  layout = "card",
  showUnit = false,
  narrowCard = false,
}: ClassCardProps) {
  markRender("screen.classes.render.classCard", { classId: item.id });

  const [showIntegrationTooltip, setShowIntegrationTooltip] = useState(false);
  const actionWrapRef = useRef<View | null>(null);
  const [actionMenuLayout, setActionMenuLayout] = useState<ActionMenuLayout | null>(null);
  const safeConflicts = conflicts ?? [];
  const parsed = parseTime(item.startTime || "");
  const duration = item.durationMinutes || 60;
  const timeLabel = parsed ? formatTimeRange(parsed.hour, parsed.minute, duration) : "Horário não definido";
  const daysLabel = formatDays(item.daysOfWeek ?? [], dayNames);
  const integrationCandidates = safeConflicts.filter((conflict) => conflict.kind === "integration");
  const conflictCandidates = safeConflicts.filter((conflict) => conflict.kind === "conflict");
  const canIntegrate = integrationCandidates.length > 0;
  const hasConflicts = conflictCandidates.length > 0;
  const integrationSummary = integrationCandidates.map((conflict) => conflict.name).join(" + ");
  const conflictSummary = conflictCandidates
    .map((conflict) => `${conflict.name} (${dayNames[conflict.day]})`)
    .join(", ");
  const classInitial = getClassInitial(item.name);
  const actionRootId = `class-card-actions-${getDomSafeId(item.id)}`;
  const actionMenuId = `${actionRootId}-menu`;
  const menuItems = [
    { label: "Editar", action: () => onEdit?.(item), danger: false },
    { label: "Duplicar", action: () => onDuplicate?.(item), danger: false },
    { label: "Ver turma", action: () => onOpen(item), danger: false },
    { label: "Apagar", action: () => onDelete?.(item), danger: true },
  ];

  useEffect(() => {
    if (!actionMenuOpen || Platform.OS !== "web") return undefined;
    const doc = (globalThis as typeof globalThis & { document?: Document }).document;
    const win = (globalThis as typeof globalThis & { window?: Window }).window;
    if (!doc) return undefined;

    const closeMenu = () => {
      onCloseActionMenu?.();
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as (EventTarget & { closest?: (selector: string) => Element | null }) | null;
      if (!target?.closest) {
        closeMenu();
        return;
      }
      if (target.closest(`#${actionRootId}`)) return;
      if (target.closest(`#${actionMenuId}`)) return;
      closeMenu();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };

    const handleVisibilityChange = () => {
      if (doc.visibilityState === "hidden") closeMenu();
    };

    doc.addEventListener("pointerdown", handlePointerDown, true);
    doc.addEventListener("scroll", closeMenu, true);
    doc.addEventListener("wheel", closeMenu, true);
    doc.addEventListener("touchmove", closeMenu, true);
    doc.addEventListener("keydown", handleKeyDown);
    doc.addEventListener("visibilitychange", handleVisibilityChange);
    win?.addEventListener("resize", closeMenu);
    win?.addEventListener("blur", closeMenu);
    return () => {
      doc.removeEventListener("pointerdown", handlePointerDown, true);
      doc.removeEventListener("scroll", closeMenu, true);
      doc.removeEventListener("wheel", closeMenu, true);
      doc.removeEventListener("touchmove", closeMenu, true);
      doc.removeEventListener("keydown", handleKeyDown);
      doc.removeEventListener("visibilitychange", handleVisibilityChange);
      win?.removeEventListener("resize", closeMenu);
      win?.removeEventListener("blur", closeMenu);
    };
  }, [actionMenuId, actionMenuOpen, actionRootId, onCloseActionMenu]);

  const resolveActionMenuLayout = useCallback((x: number, y: number, width: number, height: number) => {
    const viewport = Dimensions.get("window");
    const left = Math.max(12, Math.min(x + width - ACTION_MENU_WIDTH, viewport.width - ACTION_MENU_WIDTH - 12));
    const defaultTop = y + height + 6;
    const top =
      defaultTop + ACTION_MENU_ESTIMATED_HEIGHT > viewport.height - 12
        ? Math.max(12, y - ACTION_MENU_ESTIMATED_HEIGHT - 6)
        : defaultTop;
    return { left, top };
  }, []);

  const measureActionMenu = useCallback(() => {
    if (Platform.OS !== "web") return;
    const element = actionWrapRef.current as unknown as HTMLElement | null;
    if (element && typeof element.getBoundingClientRect === "function") {
      const rect = element.getBoundingClientRect();
      setActionMenuLayout(resolveActionMenuLayout(rect.left, rect.top, rect.width, rect.height));
      return;
    }

    actionWrapRef.current?.measureInWindow((x, y, width, height) => {
      setActionMenuLayout(resolveActionMenuLayout(x, y, width, height));
    });
  }, [resolveActionMenuLayout]);

  useEffect(() => {
    if (!actionMenuOpen || Platform.OS !== "web") return;
    measureActionMenu();
  }, [actionMenuOpen, measureActionMenu]);

  useEffect(() => {
    if (actionMenuOpen) return;
    Promise.resolve().then(() => {
      setActionMenuLayout(null);
    });
  }, [actionMenuOpen]);

  const actionMenuContent = (
    <View
      nativeID={actionMenuId}
      style={[
        styles.actionMenu,
        Platform.OS === "web" && actionMenuLayout
          ? ({
              position: "fixed",
              left: actionMenuLayout.left,
              top: actionMenuLayout.top,
              right: "auto",
              zIndex: ACTION_MENU_Z_INDEX + 2,
            } as unknown as object)
          : null,
        {
          backgroundColor: colors.surfaceElevated ?? colors.card,
          borderColor: colors.borderSubtle ?? colors.border,
        },
      ]}
    >
      {menuItems.map((menuItem) => (
        <Pressable
          key={menuItem.label}
          onPress={(event) => {
            event.stopPropagation?.();
            onCloseActionMenu?.();
            menuItem.action();
          }}
          style={(state) => [
            styles.actionMenuItem,
            {
              backgroundColor: pressedOrHovered(state)
                ? colors.secondaryBg
                : "transparent",
            },
          ]}
        >
          <Text
            style={[
              styles.actionMenuText,
              { color: menuItem.danger ? colors.dangerText : colors.text },
            ]}
          >
            {menuItem.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  const actionMenuPortal =
    Platform.OS === "web" &&
    actionMenuOpen &&
    actionMenuLayout &&
    typeof document !== "undefined"
      ? require("react-dom").createPortal(actionMenuContent, document.body)
      : null;

  if (layout === "table") {
    return (
      <Pressable
        disableWebPressScale
        onPress={() => {
          onCloseActionMenu?.();
          onOpen(item);
        }}
        style={(state) => [
          styles.tableRow,
          {
            backgroundColor: pressedOrHovered(state)
              ? colors.backgroundSubtle ?? colors.secondaryBg
              : "transparent",
            borderBottomColor: colors.borderSubtle ?? colors.border,
            zIndex: actionMenuOpen ? ACTION_MENU_Z_INDEX : 1,
          },
        ]}
      >
        <View style={[styles.tableCell, styles.tableIdentityCell]}>
          <View
            style={[
              styles.tableClassAvatar,
              { backgroundColor: colors.primaryBg },
            ]}
          >
            <Text style={[styles.tableClassAvatarText, { color: colors.primaryText }]}>
              {classInitial}
            </Text>
          </View>
          <View style={styles.tableIdentityText}>
            <View style={styles.titleLine}>
              <Text numberOfLines={1} style={[styles.tableTitle, { color: colors.textPrimary ?? colors.text }]}>
                {item.name}
              </Text>
              <ClassGenderBadge gender={item.gender} />
            </View>
            {showUnit ? (
              <Text numberOfLines={1} style={[styles.tableSecondaryText, { color: colors.textMuted ?? colors.muted }]}>
                {item.unit || "Sem unidade"}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={[styles.tableCell, styles.tableScheduleCell]}>
          <Text numberOfLines={1} style={[styles.tablePrimaryText, { color: colors.textPrimary ?? colors.text }]}>
            {timeLabel}
          </Text>
          <Text numberOfLines={1} style={[styles.tableSecondaryText, { color: colors.textMuted ?? colors.muted }]}>
            {[daysLabel, item.trainingSpace?.trim()].filter(Boolean).join(" · ")}
          </Text>
        </View>

        <View style={[styles.tableCell, styles.tableFocusCell]}>
          <Text numberOfLines={1} style={[styles.tablePrimaryText, { color: colors.textPrimary ?? colors.text }]}>
            {item.ageBand || "Faixa não definida"}
          </Text>
          <Text numberOfLines={1} style={[styles.tableSecondaryText, { color: colors.textMuted ?? colors.muted }]}>
            {[
              viewModel.developmentLevelLabel,
              viewModel.coverageSummary
                ? `${viewModel.coverageSummary.label} · ${viewModel.coverageSummary.dateLabel}`
                : null,
              canIntegrate ? "Integrado" : null,
            ].filter(Boolean).join(" · ")}
          </Text>
        </View>

        <View style={[styles.tableCell, styles.tableStudentsCell]}>
          <View style={styles.studentStack}>
            {viewModel.visibleStudents.length ? viewModel.visibleStudents.map((avatar, index) => (
              <StudentAvatarItem
                key={avatar.id}
                avatar={avatar}
                index={index}
                borderColor={colors.surface ?? colors.background}
              />
            )) : (
              <Text numberOfLines={1} style={[styles.noStudentsText, { color: colors.textMuted ?? colors.muted }]}>
                Sem alunos
              </Text>
            )}
            {viewModel.studentCount > 0 ? (
              <Text numberOfLines={1} style={[styles.studentCount, { color: colors.textPrimary ?? colors.text }]}>
                {viewModel.extraStudentCount > 0 ? `+${viewModel.extraStudentCount}` : `${viewModel.studentCount}`}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={[styles.tableCell, styles.tableTeacherCell]}>
          <TeacherAvatarItem
            teacher={viewModel.teacher}
            infoBg={colors.infoBg}
            infoText={colors.infoText}
            containerStyle={styles.tableTeacherAvatar}
            imageStyle={styles.teacherAvatarImage}
            textStyle={styles.teacherAvatarText}
          />
          <Text numberOfLines={1} style={[styles.tableTeacherName, { color: colors.textPrimary ?? colors.text }]}>
            {viewModel.teacher.compactName}
          </Text>
          <StaffTeamPill members={viewModel.supportStaff} colors={colors} compact />
        </View>

        <View ref={actionWrapRef} nativeID={actionRootId} style={styles.tableActionCell}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Opções de ${item.name}`}
            onPress={(event) => {
              event.stopPropagation?.();
              if (!actionMenuOpen) measureActionMenu();
              onToggleActionMenu?.(item.id);
            }}
            style={(state) => [
              styles.actionButton,
              {
                backgroundColor: pressedOrHovered(state) || actionMenuOpen
                  ? colors.secondaryBg
                  : "transparent",
              },
            ]}
          >
            <GoAtletaIcon name="ellipsisVertical" size={16} color={colors.textMuted ?? colors.muted} />
          </Pressable>
          {actionMenuOpen && Platform.OS !== "web" ? actionMenuContent : null}
        </View>
        {actionMenuPortal}
      </Pressable>
    );
  }

  return (
    <Pressable
      disableWebPressScale
      onPress={(event) => {
        if (Platform.OS === "web") {
          const target = event.target as unknown as (EventTarget & {
            closest?: (selector: string) => Element | null;
          }) | null;
          if (target?.closest?.(`#${actionRootId}`) || target?.closest?.(`#${actionMenuId}`)) {
            return;
          }
        }
        onCloseActionMenu?.();
        onOpen(item);
      }}
      style={(state) => {
        const isHovered = Boolean((state as typeof state & { hovered?: boolean }).hovered);
        return [
          styles.container,
          narrowCard ? styles.containerNarrow : null,
          {
            backgroundColor: colors.surface ?? colors.background,
            borderColor: colors.borderSubtle ?? colors.border,
            zIndex: actionMenuOpen ? ACTION_MENU_Z_INDEX : 1,
            elevation: actionMenuOpen ? ACTION_MENU_Z_INDEX : shadow.card.elevation,
          },
          isHovered || actionMenuOpen
            ? {
                borderColor: colors.borderSubtle ?? colors.border,
                ...(Platform.OS === "web"
                  ? { boxShadow: "0px 12px 24px rgba(0, 0, 0, 0.2)" }
                  : null),
              }
            : null,
        ];
      }}
    >
      <View style={styles.topRow}>
        <View style={[styles.classIdentity, narrowCard ? styles.classIdentityNarrow : null]}>
          <View
            style={[
              styles.classAvatar,
              narrowCard ? styles.classAvatarNarrow : null,
              {
                backgroundColor: colors.primaryBg,
                borderColor: colors.borderSubtle ?? colors.border,
              },
            ]}
          >
            <Text style={[styles.classAvatarText, narrowCard ? styles.classAvatarTextNarrow : null, { color: colors.primaryText }]}>
              {classInitial}
            </Text>
          </View>
          <View style={styles.titleWrap}>
            <View style={styles.titleLine}>
              <Text numberOfLines={1} style={[styles.title, narrowCard ? styles.titleNarrow : null, { color: colors.textPrimary ?? colors.text }]}>
                {item.name}
              </Text>
              <ClassGenderBadge gender={item.gender} />
            </View>
            <Text numberOfLines={1} style={[styles.subtitle, narrowCard ? styles.subtitleNarrow : null, { color: colors.textMuted ?? colors.muted }]}>
              {[
                timeLabel,
                daysLabel,
                item.trainingSpace?.trim(),
              ].filter(Boolean).join(" · ")}
            </Text>
          </View>
        </View>

        <View style={styles.topRightWrap}>
          <View style={[styles.studentStack, narrowCard ? styles.studentStackNarrow : null]}>
            {viewModel.visibleStudents.length ? viewModel.visibleStudents.slice(0, narrowCard ? 2 : 4).map((avatar, index) => (
              <StudentAvatarItem
                key={avatar.id}
                avatar={avatar}
                index={index}
                borderColor={colors.surface ?? colors.background}
              />
            )) : (
              !narrowCard ? (
                <Text numberOfLines={1} style={[styles.noStudentsText, { color: colors.textMuted ?? colors.muted }]}>
                  Sem alunos
                </Text>
              ) : null
            )}
            {viewModel.studentCount > 0 ? (
              <Text numberOfLines={1} style={[styles.studentCount, narrowCard ? styles.studentCountNarrow : null, { color: colors.successText ?? colors.primaryBg }]}>
                {viewModel.extraStudentCount > 0 || (narrowCard && viewModel.studentCount > 2)
                  ? `+${viewModel.extraStudentCount > 0 ? viewModel.extraStudentCount : viewModel.studentCount}`
                  : `${viewModel.studentCount}`}
              </Text>
            ) : null}
          </View>

          <View ref={actionWrapRef} nativeID={actionRootId} style={styles.actionWrap}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Opções de ${item.name}`}
              onPress={(event) => {
                event.stopPropagation?.();
                if (!actionMenuOpen) measureActionMenu();
                onToggleActionMenu?.(item.id);
              }}
              style={(state) => {
                const isHovered = Boolean((state as typeof state & { hovered?: boolean }).hovered);
                return [
                  styles.actionButton,
                  {
                    backgroundColor:
                      pressedOrHovered(state) || actionMenuOpen
                        ? colors.secondaryBg
                        : "transparent",
                  },
                  isHovered || actionMenuOpen ? styles.actionButtonHover : null,
                ];
              }}
            >
              <GoAtletaIcon name="ellipsisVertical" size={16} color={colors.textMuted ?? colors.muted} />
            </Pressable>
            {actionMenuOpen && Platform.OS !== "web" ? actionMenuContent : null}
          </View>
        </View>
        {actionMenuPortal}
      </View>

      <View style={[styles.metaGrid, narrowCard ? styles.metaGridNarrow : null]}>
        <MetaPill label={item.ageBand || "Faixa não definida"} colors={colors} compact={narrowCard} />
        <MetaPill label={viewModel.developmentLevelLabel} colors={colors} compact={narrowCard} />
        {viewModel.coverageSummary ? (
          <MetaPill
            label={`${viewModel.coverageSummary.label} · ${viewModel.coverageSummary.dateLabel}`}
            colors={colors}
            tone={viewModel.coverageSummary.tone}
            compact={narrowCard}
          />
        ) : null}
        {canIntegrate ? (
          <View style={styles.integrationWrap}>
            <Pressable
              style={[
                styles.integrationPill,
                { backgroundColor: colors.successBg ?? colors.primaryBg, borderColor: colors.successBorder ?? colors.primaryBg },
              ]}
              onHoverIn={() => {
                if (Platform.OS === "web") setShowIntegrationTooltip(true);
              }}
              onHoverOut={() => {
                if (Platform.OS === "web") setShowIntegrationTooltip(false);
              }}
            >
              <Text style={[styles.integrationPillText, { color: colors.successText ?? colors.primaryText }]}>
                Integrado
              </Text>
            </Pressable>
            {showIntegrationTooltip ? (
              <View
                style={[
                  styles.integrationTooltip,
                  {
                    backgroundColor: colors.surfaceElevated ?? colors.card,
                    borderColor: colors.borderSubtle ?? colors.border,
                  },
                ]}
              >
                <Text style={[styles.integrationTooltipText, { color: colors.text }]}>
                  {integrationSummary}
                </Text>
              </View>
            ) : null}
          </View>
        ) : hasConflicts ? (
          <View style={[styles.conflictPill, { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder }]}>
            <Text style={[styles.conflictPillText, { color: colors.dangerText }]}>
              Conflito
            </Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.teacherRow, narrowCard ? styles.teacherRowNarrow : null, { borderTopColor: colors.borderSubtle ?? colors.border }]}>
        <TeacherAvatarItem
          teacher={viewModel.teacher}
          infoBg={colors.infoBg}
          infoText={colors.infoText}
          containerStyle={[styles.teacherAvatar, narrowCard ? styles.teacherAvatarNarrow : null]}
          imageStyle={styles.teacherAvatarImage}
          textStyle={styles.teacherAvatarText}
        />
        <View style={{ minWidth: 0, flex: 1 }}>
          {!narrowCard ? (
            <Text style={[styles.teacherKicker, { color: colors.textMuted ?? colors.muted }]}>Professor</Text>
          ) : null}
          <Text numberOfLines={1} style={[styles.teacherName, { color: colors.textPrimary ?? colors.text }]}>
            {viewModel.teacher.compactName}
          </Text>
        </View>
        <StaffTeamPill members={viewModel.supportStaff} colors={colors} compact={narrowCard} />
      </View>

      {hasConflicts ? (
        <Text style={[styles.conflictText, { color: colors.dangerText }]}>
          Conflitos: {conflictSummary}
        </Text>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  tableRow: {
    minHeight: 88,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    position: "relative",
  },
  tableCell: {
    minWidth: 0,
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  tableIdentityCell: {
    flex: 2.2,
    minWidth: 200,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  tableScheduleCell: {
    flex: 1.15,
    minWidth: 112,
  },
  tableFocusCell: {
    flex: 1.15,
    minWidth: 115,
  },
  tableStudentsCell: {
    flex: 1.15,
    minWidth: 115,
  },
  tableTeacherCell: {
    flex: 1.85,
    minWidth: 180,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 9,
  },
  tableActionCell: {
    width: 42,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    zIndex: ACTION_MENU_Z_INDEX + 1,
  },
  tableClassAvatar: {
    width: 38,
    height: 38,
    borderRadius: radius.internal,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  tableClassAvatarText: {
    fontSize: 17,
    fontWeight: "900",
  },
  tableIdentityText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  tableTitle: {
    fontSize: 13,
    fontWeight: "900",
    minWidth: 0,
    flexShrink: 1,
  },
  tablePrimaryText: {
    fontSize: 12,
    fontWeight: "700",
  },
  tableSecondaryText: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 3,
  },
  tableTeacherAvatar: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  tableTeacherName: {
    fontSize: 12,
    fontWeight: "800",
    minWidth: 0,
    maxWidth: 116,
    flexShrink: 1,
  },
  container: {
    minHeight: 0,
    padding: 12,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    position: "relative",
    elevation: 0,
  },
  containerNarrow: {
    padding: 10,
  },
  conflictPill: {
    alignSelf: "flex-start",
    paddingVertical: 1,
    paddingHorizontal: 7,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  integrationPill: {
    alignSelf: "flex-start",
    paddingVertical: 1,
    paddingHorizontal: 7,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  integrationWrap: {
    alignSelf: "flex-start",
    position: "relative",
  },
  conflictPillText: {
    fontWeight: "700",
    fontSize: 10,
  },
  integrationPillText: {
    fontWeight: "700",
    fontSize: 10,
  },
  integrationTooltip: {
    position: "absolute",
    top: -42,
    right: 0,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.internal,
    minWidth: 180,
    maxWidth: 260,
    borderWidth: 1,
    zIndex: 10,
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 8px 18px rgba(0, 0, 0, 0.24)" }
      : {
          shadowColor: "#000",
          shadowOpacity: 0.24,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 6 },
        }),
  },
  integrationTooltipText: {
    fontSize: 11,
    fontWeight: "600",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
    zIndex: 3,
  },
  classIdentity: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
    flex: 1,
    gap: 10,
  },
  classIdentityNarrow: {
    gap: 8,
  },
  classAvatar: {
    width: 36,
    height: 36,
    borderRadius: radius.internal,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  classAvatarNarrow: {
    width: 28,
    height: 28,
    borderRadius: 8,
  },
  classAvatarText: {
    fontSize: 17,
    fontWeight: "900",
  },
  classAvatarTextNarrow: {
    fontSize: 13,
  },
  topRightWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  studentStack: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
    flexShrink: 0,
    maxWidth: 118,
    paddingTop: 2,
  },
  studentStackNarrow: {
    maxWidth: 84,
    paddingTop: 0,
  },
  studentAvatar: {
    width: 21,
    height: 21,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    overflow: "hidden",
  },
  studentAvatarText: {
    color: "#0A1322",
    fontSize: 9,
    fontWeight: "900",
    textAlign: "center",
    includeFontPadding: false,
    lineHeight: 11,
  },
  studentAvatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
  },
  studentAvatarImageLoading: {
    opacity: 0,
  },
  studentAvatarShimmer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: radius.full,
  },
  noStudentsText: {
    fontSize: 11,
    fontWeight: "700",
  },
  studentCount: {
    marginLeft: 6,
    fontSize: 11,
    fontWeight: "800",
  },
  studentCountNarrow: {
    marginLeft: 4,
    fontSize: 10,
  },
  actionWrap: {
    position: "relative",
    alignItems: "flex-end",
    flexShrink: 0,
    zIndex: ACTION_MENU_Z_INDEX + 1,
    elevation: ACTION_MENU_Z_INDEX + 1,
  },
  actionButton: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonHover: {
    ...(Platform.OS === "web"
      ? {
          boxShadow:
            "0px 8px 16px rgba(0, 0, 0, 0.22), 0px 0px 0px 1px rgba(148, 163, 184, 0.22)",
        }
      : null),
  },
  actionMenu: {
    position: "absolute",
    top: 34,
    right: 0,
    width: 132,
    borderRadius: radius.internal,
    borderWidth: 1,
    paddingVertical: 5,
    zIndex: ACTION_MENU_Z_INDEX + 2,
    elevation: ACTION_MENU_Z_INDEX + 2,
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 12px 24px rgba(0, 0, 0, 0.24)" }
      : {
          shadowColor: "#000",
          shadowOpacity: 0.22,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 8 },
        }),
  },
  actionMenuItem: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  actionMenuText: {
    fontSize: 12,
    fontWeight: "800",
  },
  titleLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
    maxWidth: "100%",
    alignSelf: "flex-start",
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 14,
    fontWeight: "900",
    minWidth: 0,
    flexShrink: 1,
  },
  titleNarrow: {
    fontSize: 13,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  subtitleNarrow: {
    fontSize: 10,
    marginTop: 1,
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  metaGridNarrow: {
    gap: 4,
    marginTop: 6,
  },
  metaPill: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  metaPillCompact: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  metaPillText: {
    fontSize: 10,
    fontWeight: "700",
  },
  conflictText: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: "700",
  },
  teacherRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    paddingTop: 7,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  teacherRowNarrow: {
    marginTop: 6,
    paddingTop: 6,
  },
  teacherAvatar: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  teacherAvatarNarrow: {
    width: 22,
    height: 22,
  },
  teacherAvatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
  },
  teacherAvatarText: {
    fontSize: 9,
    fontWeight: "900",
  },
  teacherKicker: {
    fontSize: 10,
    fontWeight: "700",
  },
  teacherName: {
    fontSize: 11,
    fontWeight: "800",
    marginTop: 0,
  },
  staffPillWrap: {
    position: "relative",
    flexShrink: 0,
    zIndex: 4,
  },
  staffPill: {
    minHeight: 30,
    minWidth: 42,
    paddingHorizontal: 7,
    borderRadius: radius.full,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  staffPillCompact: {
    minHeight: 28,
    minWidth: 38,
    paddingHorizontal: 6,
  },
  staffAvatarStack: {
    flexDirection: "row",
    alignItems: "center",
  },
  staffAvatar: {
    borderRadius: radius.full,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  staffAvatarText: {
    color: "#0A1322",
    fontSize: 8,
    lineHeight: 10,
    fontWeight: "900",
    textAlign: "center",
    includeFontPadding: false,
  },
  staffAvatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: radius.full,
  },
  staffAvatarImageLoading: {
    opacity: 0,
  },
  staffAvatarShimmer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: radius.full,
  },
  staffExtraCount: {
    fontSize: 10,
    fontWeight: "900",
  },
  staffPopoverContent: {
    padding: 6,
    gap: 2,
  },
  staffPopoverRow: {
    minHeight: 44,
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: radius.internal,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  staffPopoverName: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    fontWeight: "800",
  },
  staffPopoverRole: {
    fontSize: 11,
    fontWeight: "600",
  },
  staffNativePopover: {
    position: "absolute",
    top: 34,
    right: 0,
    width: 220,
    padding: 6,
    borderWidth: 1,
    borderRadius: 14,
    zIndex: 12600,
    elevation: 20,
  },
});
