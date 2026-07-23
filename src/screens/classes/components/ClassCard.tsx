import { Dimensions, Image, Platform, StyleSheet, Text, View } from "react-native";
import { memo, useCallback, useEffect, useRef, useState } from "react";

import type { ClassGroup } from "../../../core/models";
import { markRender } from "../../../observability/perf";
import type { ClassCardViewModel } from "../application/class-card-view-model";
import { radius, shadow } from "../../../theme/tokens";
import { ClassGenderBadge } from "../../../ui/ClassGenderBadge";
import { Pressable } from "../../../ui/Pressable";
import { GoAtletaIcon } from "../../../ui/icon-registry";

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
}: {
  label: string;
  colors: Record<string, string>;
}) {
  return (
    <View
      style={[
        styles.metaPill,
        {
          backgroundColor: colors.backgroundSubtle ?? colors.secondaryBg,
          borderColor: colors.borderSubtle ?? colors.border,
        },
      ]}
    >
      <Text numberOfLines={1} style={[styles.metaPillText, { color: colors.textMuted ?? colors.muted }]}>
        {label}
      </Text>
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
    setActionMenuLayout(null);
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
            {[viewModel.developmentLevelLabel, canIntegrate ? "Integrado" : null].filter(Boolean).join(" · ")}
          </Text>
        </View>

        <View style={[styles.tableCell, styles.tableStudentsCell]}>
          <View style={styles.studentStack}>
            {viewModel.visibleStudents.length ? viewModel.visibleStudents.map((avatar, index) => (
              <View
                key={avatar.id}
                style={[
                  styles.studentAvatar,
                  {
                    backgroundColor: avatar.color,
                    borderColor: colors.surface ?? colors.background,
                    marginLeft: index === 0 ? 0 : -8,
                  },
                ]}
              >
                {avatar.photoUrl ? (
                  <Image source={{ uri: avatar.photoUrl }} style={styles.studentAvatarImage} />
                ) : (
                  <Text style={styles.studentAvatarText}>{avatar.label}</Text>
                )}
              </View>
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
          <View style={[styles.tableTeacherAvatar, { backgroundColor: colors.infoBg }]}>
            {viewModel.teacher.photoUrl ? (
              <Image source={{ uri: viewModel.teacher.photoUrl }} style={styles.teacherAvatarImage} />
            ) : (
              <Text style={[styles.teacherAvatarText, { color: colors.infoText }]}>
                {viewModel.teacher.initials}
              </Text>
            )}
          </View>
          <Text numberOfLines={1} style={[styles.tableTeacherName, { color: colors.textPrimary ?? colors.text }]}>
            {viewModel.teacher.name}
          </Text>
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
        <View style={styles.classIdentity}>
          <View
            style={[
              styles.classAvatar,
              {
                backgroundColor: colors.primaryBg,
                borderColor: colors.borderSubtle ?? colors.border,
              },
            ]}
          >
            <Text style={[styles.classAvatarText, { color: colors.primaryText }]}>
              {classInitial}
            </Text>
          </View>
          <View style={styles.titleWrap}>
            <View style={styles.titleLine}>
              <Text numberOfLines={1} style={[styles.title, { color: colors.textPrimary ?? colors.text }]}>
                {item.name}
              </Text>
              <ClassGenderBadge gender={item.gender} />
            </View>
            <Text numberOfLines={1} style={[styles.subtitle, { color: colors.textMuted ?? colors.muted }]}>
              {[timeLabel, daysLabel, item.trainingSpace?.trim()].filter(Boolean).join(" · ")}
            </Text>
          </View>
        </View>

        {!narrowCard ? <View style={styles.studentStack}>
          {viewModel.visibleStudents.length ? viewModel.visibleStudents.map((avatar, index) => (
            <View
              key={avatar.id}
              style={[
                styles.studentAvatar,
                {
                  backgroundColor: avatar.color,
                  borderColor: colors.surface ?? colors.background,
                  marginLeft: index === 0 ? 0 : -8,
                },
              ]}
            >
              {avatar.photoUrl ? (
                <Image source={{ uri: avatar.photoUrl }} style={styles.studentAvatarImage} />
              ) : (
                <Text style={styles.studentAvatarText}>{avatar.label}</Text>
              )}
            </View>
          )) : (
            <Text numberOfLines={1} style={[styles.noStudentsText, { color: colors.textMuted ?? colors.muted }]}>
              Sem alunos
            </Text>
          )}
          {viewModel.studentCount > 0 ? (
            <Text numberOfLines={1} style={[styles.studentCount, { color: colors.successText ?? colors.primaryBg }]}>
              {viewModel.extraStudentCount > 0 ? `+${viewModel.extraStudentCount}` : `${viewModel.studentCount}`}
            </Text>
          ) : null}
        </View> : null}

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
        {actionMenuPortal}
      </View>

      {narrowCard ? (
        <View style={styles.narrowStudentRow}>
          <View style={styles.studentStack}>
            {viewModel.visibleStudents.length ? viewModel.visibleStudents.map((avatar, index) => (
              <View
                key={avatar.id}
                style={[
                  styles.studentAvatar,
                  {
                    backgroundColor: avatar.color,
                    borderColor: colors.surface ?? colors.background,
                    marginLeft: index === 0 ? 0 : -8,
                  },
                ]}
              >
                {avatar.photoUrl ? (
                  <Image source={{ uri: avatar.photoUrl }} style={styles.studentAvatarImage} />
                ) : (
                  <Text style={styles.studentAvatarText}>{avatar.label}</Text>
                )}
              </View>
            )) : (
              <Text numberOfLines={1} style={[styles.noStudentsText, { color: colors.textMuted ?? colors.muted }]}>
                Sem alunos
              </Text>
            )}
            {viewModel.studentCount > 0 ? (
              <Text numberOfLines={1} style={[styles.studentCount, { color: colors.successText ?? colors.primaryBg }]}>
                {viewModel.extraStudentCount > 0 ? `+${viewModel.extraStudentCount}` : `${viewModel.studentCount}`}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      <View style={styles.metaGrid}>
        <MetaPill label={item.ageBand || "Faixa não definida"} colors={colors} />
        <MetaPill label={viewModel.developmentLevelLabel} colors={colors} />
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

      <View style={[styles.teacherRow, { borderTopColor: colors.borderSubtle ?? colors.border }]}>
        <View style={[styles.teacherAvatar, { backgroundColor: colors.infoBg }]}>
          {viewModel.teacher.photoUrl ? (
            <Image source={{ uri: viewModel.teacher.photoUrl }} style={styles.teacherAvatarImage} />
          ) : (
            <Text style={[styles.teacherAvatarText, { color: colors.infoText }]}>
              {viewModel.teacher.initials}
            </Text>
          )}
        </View>
        <View style={{ minWidth: 0, flex: 1 }}>
          <Text style={[styles.teacherKicker, { color: colors.textMuted ?? colors.muted }]}>Professor</Text>
          <Text numberOfLines={1} style={[styles.teacherName, { color: colors.textPrimary ?? colors.text }]}>
            {viewModel.teacher.name}
          </Text>
        </View>
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
    minWidth: 210,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  tableScheduleCell: {
    flex: 1.12,
    minWidth: 112,
  },
  tableFocusCell: {
    flex: 1.24,
    minWidth: 120,
  },
  tableStudentsCell: {
    flex: 1.05,
    minWidth: 108,
  },
  tableTeacherCell: {
    flex: 1.58,
    minWidth: 170,
    flexDirection: "row",
    alignItems: "center",
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
    flexShrink: 1,
  },
  container: {
    minHeight: 132,
    padding: 12,
    borderRadius: radius.card,
    borderWidth: 0,
    position: "relative",
    elevation: 0,
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
  classAvatar: {
    width: 36,
    height: 36,
    borderRadius: radius.internal,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  classAvatarText: {
    fontSize: 17,
    fontWeight: "900",
  },
  studentStack: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
    flexShrink: 0,
    maxWidth: 118,
    paddingTop: 7,
  },
  narrowStudentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    minHeight: 24,
    marginTop: 2,
  },
  studentAvatar: {
    width: 21,
    height: 21,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  studentAvatarText: {
    color: "#0A1322",
    fontSize: 9,
    fontWeight: "900",
  },
  studentAvatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
  },
  noStudentsText: {
    fontSize: 11,
    fontWeight: "700",
  },
  studentCount: {
    marginLeft: 7,
    fontSize: 11,
    fontWeight: "800",
  },
  actionWrap: {
    position: "relative",
    alignItems: "flex-end",
    flexShrink: 0,
    zIndex: ACTION_MENU_Z_INDEX + 1,
    elevation: ACTION_MENU_Z_INDEX + 1,
  },
  actionButton: {
    width: 30,
    height: 30,
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
  subtitle: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 9,
  },
  metaPill: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  metaPillText: {
    fontSize: 10,
    fontWeight: "700",
  },
  conflictText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "700",
  },
  teacherRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 11,
    paddingTop: 9,
    borderTopWidth: 1,
  },
  teacherAvatar: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  teacherAvatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
  },
  teacherAvatarText: {
    fontSize: 10,
    fontWeight: "900",
  },
  teacherKicker: {
    fontSize: 10,
    fontWeight: "700",
  },
  teacherName: {
    fontSize: 12,
    fontWeight: "800",
    marginTop: 1,
  },
});
