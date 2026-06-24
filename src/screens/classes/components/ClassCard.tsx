import { Ionicons } from "@expo/vector-icons";
import { memo, useEffect, useMemo, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import type { ClassGroup } from "../../../core/models";
import { markRender } from "../../../observability/perf";
import { radius, shadow } from "../../../theme/tokens";
import { ClassGenderBadge } from "../../../ui/ClassGenderBadge";
import { Pressable } from "../../../ui/Pressable";

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
  actionMenuOpen?: boolean;
  onToggleActionMenu?: (classId: string) => void;
  onCloseActionMenu?: () => void;
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

const AVATAR_COLORS = ["#3DDC84", "#93C5FD", "#F8D394", "#FCA5A5", "#C4B5FD"];

const hashString = (value: string) =>
  value.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);

const getClassInitial = (name: string) => {
  const clean = name.trim();
  if (!clean) return "T";
  return clean[0]?.toUpperCase() ?? "T";
};

const buildStudentAvatars = (name: string) => {
  const base = hashString(name || "turma");
  const initials = ["A", "B", "C", "D"].map((letter, index) => ({
    label: letter,
    color: AVATAR_COLORS[(base + index) % AVATAR_COLORS.length],
  }));
  return initials;
};

const getStudentCount = (item: ClassGroup) => {
  const base = hashString(`${item.name}-${item.unit}-${item.ageBand}`);
  return 18 + (base % 16);
};

const getDomSafeId = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "_");

const pressedOrHovered = (state: { pressed: boolean; hovered?: boolean }) =>
  Boolean(state.pressed || state.hovered);

export const ClassCard = memo(function ClassCard({
  item,
  conflicts,
  dayNames,
  colors,
  onOpen,
  actionMenuOpen = false,
  onToggleActionMenu,
  onCloseActionMenu,
}: ClassCardProps) {
  markRender("screen.classes.render.classCard", { classId: item.id });

  const [showIntegrationTooltip, setShowIntegrationTooltip] = useState(false);
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
  const studentCount = getStudentCount(item);
  const studentAvatars = useMemo(() => buildStudentAvatars(item.name), [item.name]);
  const extraStudents = Math.max(0, studentCount - studentAvatars.length);
  const actionRootId = `class-card-actions-${getDomSafeId(item.id)}`;

  useEffect(() => {
    if (!actionMenuOpen || Platform.OS !== "web") return undefined;
    const doc = (globalThis as typeof globalThis & { document?: Document }).document;
    if (!doc) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as (EventTarget & { closest?: (selector: string) => Element | null }) | null;
      if (!target?.closest) {
        onCloseActionMenu?.();
        return;
      }
      if (target.closest(`#${actionRootId}`)) return;
      onCloseActionMenu?.();
    };

    doc.addEventListener("pointerdown", handlePointerDown);
    return () => {
      doc.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [actionMenuOpen, actionRootId, onCloseActionMenu]);

  return (
    <Pressable
      onPress={() => {
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
          },
          isHovered || actionMenuOpen
            ? {
                borderColor: colors.primaryBg,
                ...(Platform.OS === "web"
                  ? { boxShadow: "0px 12px 24px rgba(0, 0, 0, 0.2)" }
                  : null),
              }
            : null,
        ];
      }}
    >
      <View style={styles.topRow}>
        <View style={styles.avatarCluster}>
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
          <View style={styles.studentStack}>
            {studentAvatars.map((avatar, index) => (
              <View
                key={`${avatar.label}-${index}`}
                style={[
                  styles.studentAvatar,
                  {
                    backgroundColor: avatar.color,
                    borderColor: colors.surface ?? colors.background,
                    marginLeft: index === 0 ? 0 : -8,
                  },
                ]}
              >
                <Text style={styles.studentAvatarText}>{avatar.label}</Text>
              </View>
            ))}
            <Text numberOfLines={1} style={[styles.studentCount, { color: colors.successText ?? colors.primaryBg }]}>
              +{extraStudents}
            </Text>
          </View>
        </View>

        <View nativeID={actionRootId} style={styles.actionWrap}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Opções de ${item.name}`}
            onPress={(event) => {
              event.stopPropagation?.();
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
            <Ionicons name="ellipsis-vertical" size={16} color={colors.textMuted ?? colors.muted} />
          </Pressable>
          {actionMenuOpen ? (
            <View
              style={[
                styles.actionMenu,
                {
                  backgroundColor: colors.surfaceElevated ?? colors.card,
                  borderColor: colors.borderSubtle ?? colors.border,
                },
              ]}
            >
              {["Editar", "Duplicar", "Ver turma", "Apagar"].map((label) => (
                <Pressable
                  key={label}
                  onPress={(event) => {
                    event.stopPropagation?.();
                    onCloseActionMenu?.();
                    if (label === "Ver turma" || label === "Editar") onOpen(item);
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
                      { color: label === "Apagar" ? colors.dangerText : colors.text },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.contentRow}>
        <View style={styles.titleWrap}>
          <Text numberOfLines={1} style={[styles.title, { color: colors.textPrimary ?? colors.text }]}>{item.name}</Text>
          <Text numberOfLines={1} style={[styles.subtitle, { color: colors.textMuted ?? colors.muted }]}>
            {timeLabel} · {daysLabel}
          </Text>
        </View>
        <ClassGenderBadge gender={item.gender} />
      </View>

      <View style={styles.metaGrid}>
        <MetaPill label={item.ageBand || "Faixa não definida"} colors={colors} />
        <MetaPill label={item.goal || "Objetivo"} colors={colors} />
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
          <Text style={[styles.teacherAvatarText, { color: colors.infoText }]}>GR</Text>
        </View>
        <View style={{ minWidth: 0, flex: 1 }}>
          <Text style={[styles.teacherKicker, { color: colors.textMuted ?? colors.muted }]}>Professor</Text>
          <Text numberOfLines={1} style={[styles.teacherName, { color: colors.textPrimary ?? colors.text }]}>
            Gustavo Ribeiro
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
  container: {
    minHeight: 170,
    padding: 12,
    borderRadius: radius.card,
    borderWidth: 1,
    position: "relative",
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 4px 10px rgba(10, 19, 34, 0.05)" }
      : {
          shadowColor: shadow.card.shadowColor,
          shadowOpacity: shadow.card.shadowOpacity,
          shadowRadius: shadow.card.shadowRadius,
          shadowOffset: shadow.card.shadowOffset,
        }),
    elevation: shadow.card.elevation,
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
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    zIndex: 3,
  },
  avatarCluster: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
    flex: 1,
    gap: 10,
  },
  classAvatar: {
    width: 38,
    height: 38,
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
    flex: 1,
  },
  studentAvatar: {
    width: 22,
    height: 22,
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
  studentCount: {
    marginLeft: 7,
    fontSize: 11,
    fontWeight: "800",
  },
  actionWrap: {
    position: "relative",
    alignItems: "flex-end",
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
    zIndex: 20,
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
  contentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 14,
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 14,
    fontWeight: "900",
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
    marginTop: 10,
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
    marginTop: 13,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  teacherAvatar: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
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
