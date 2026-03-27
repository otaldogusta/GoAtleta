import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import {
    type ClassResponsible,
    listClassHeadsByClassIds,
} from "../../../api/class-responsibles";
import { sendPushToUser } from "../../../api/push";
import {
    type AdminPendingAttendance,
    type AdminPendingSessionLogs,
    type AdminRecentActivity,
    listAdminPendingAttendance,
    listAdminPendingSessionLogs,
    listAdminRecentActivity,
} from "../../../api/reports";
import { markRender, measureAsync } from "../../../observability/perf";
import { useOrganization } from "../../../providers/OrganizationProvider";
import { Pressable } from "../../../ui/Pressable";
import { useAppTheme } from "../../../ui/app-theme";
import { getGlassCardStyle } from "../../../ui/glass-styles";
import { SectionLoadingState } from "../../../components/ui/SectionLoadingState";

type LegacyPendingAttendance = Partial<AdminPendingAttendance> & {
  class_id?: string;
  target_date?: string;
  class_name?: string;
};

type SummaryRouteTarget = {
  classId: string;
  targetDate: string;
  className: string;
  unit: string;
};

type NotifyPreview = {
  target: SummaryRouteTarget;
  head: ClassResponsible | null;
  loading: boolean;
};

type MetricItem = {
  id: string;
  label: string;
  value: string;
  hint: string;
};

type ManagerAction = {
  id: string;
  label: string;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const COOLDOWN_MS = 60 * 60 * 1000;

const formatDateBr = (value: string) => {
  const datePart = value.includes("T") ? value.split("T")[0] : value;
  const parts = datePart.split("-");
  if (parts.length !== 3) return value;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const formatDateTimeBr = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const resolveAttendanceRouteTarget = (
  value: LegacyPendingAttendance | null | undefined
): SummaryRouteTarget | null => {
  if (!value) return null;
  const classId =
    typeof value.classId === "string" && value.classId.trim().length > 0
      ? value.classId
      : typeof value.class_id === "string" && value.class_id.trim().length > 0
      ? value.class_id
      : "";
  if (!classId) return null;

  const targetDate =
    typeof value.targetDate === "string" && value.targetDate.trim().length > 0
      ? value.targetDate
      : typeof value.target_date === "string" && value.target_date.trim().length > 0
      ? value.target_date
      : "";
  if (!targetDate) return null;

  const className =
    typeof value.className === "string" && value.className.trim().length > 0
      ? value.className
      : typeof value.class_name === "string" && value.class_name.trim().length > 0
      ? value.class_name
      : "Turma";

  const unit = typeof value.unit === "string" && value.unit.trim().length > 0 ? value.unit : "Sem unidade";

  return { classId, targetDate, className, unit };
};

const getCooldownKey = (organizationId: string, classId: string, date: string) =>
  `push_pending_attendance_cooldown_v1:${organizationId}:${classId}:${date}`;

const getFirstName = (value: string) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "";
  const [first] = normalized.split(/\s+/);
  return first || normalized;
};

const activityLabel = (kind: AdminRecentActivity["kind"]) =>
  kind === "attendance" ? "Chamada registrada" : "Relatório enviado";

const ManagerMetricTile = memo(function ManagerMetricTile({
  item,
  colors,
}: {
  item: MetricItem;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  return (
    <View
      style={[
        styles.metricTile,
        { backgroundColor: colors.secondaryBg, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.metricLabel, { color: colors.muted }]}>{item.label}</Text>
      <Text style={[styles.metricValue, { color: colors.text }]}>{item.value}</Text>
      <Text style={[styles.metricHint, { color: colors.muted }]}>{item.hint}</Text>
    </View>
  );
});

const AdminQuickActions = memo(function AdminQuickActions({
  actions,
  onPress,
  colors,
}: {
  actions: ManagerAction[];
  onPress: (route: string) => void;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  markRender("screen.homeAdmin.render.quickActions");
  return (
    <View style={styles.quickActionsRow}>
      {actions.map((action) => (
        <Pressable
          key={action.id}
          onPress={() => onPress(action.route)}
          style={[
            styles.quickActionButton,
            { backgroundColor: colors.secondaryBg, borderColor: colors.border },
          ]}
        >
          <Ionicons name={action.icon} size={14} color={colors.text} />
          <Text style={[styles.quickActionText, { color: colors.text }]}>{action.label}</Text>
        </Pressable>
      ))}
    </View>
  );
});

const AdminOverview = memo(function AdminOverview({
  loading,
  error,
  metrics,
  onRetry,
  colors,
}: {
  loading: boolean;
  error: string | null;
  metrics: MetricItem[];
  onRetry: () => void;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  markRender("screen.homeAdmin.render.summaryRow");

  if (loading) {
    return (
      <View style={{ gap: 12 }}>
        <SectionLoadingState />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorWrap}>
        <Text style={[styles.errorText, { color: colors.dangerText }]}>{error}</Text>
        <Pressable
          onPress={onRetry}
          style={[
            styles.retryButton,
            { backgroundColor: colors.secondaryBg, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.retryButtonText, { color: colors.text }]}>Tentar novamente</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.metricsGrid}>
      {metrics.map((item) => (
        <ManagerMetricTile key={item.id} item={item} colors={colors} />
      ))}
    </View>
  );
});

export function AdminHomeHeader({ compact = false }: { compact?: boolean } = {}) {
  markRender("screen.homeAdmin.render.header");

  const router = useRouter();
  const { colors } = useAppTheme();
  const { activeOrganization } = useOrganization();
  const organizationId = activeOrganization?.id ?? "";
  const isOperationalAdmin = (activeOrganization?.role_level ?? 0) >= 50;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notifying, setNotifying] = useState(false);
  const [pendingAttendance, setPendingAttendance] = useState<LegacyPendingAttendance[]>([]);
  const [pendingSessionLogs, setPendingSessionLogs] = useState<AdminPendingSessionLogs[]>([]);
  const [recentActivity, setRecentActivity] = useState<AdminRecentActivity[]>([]);
  const [notifyPreview, setNotifyPreview] = useState<NotifyPreview | null>(null);

  const latestSummaryRequestRef = useRef(0);
  const latestHeadRequestRef = useRef(0);

  const sanitizeAttendanceRows = useCallback(
    (rows: LegacyPendingAttendance[]): LegacyPendingAttendance[] =>
      (rows ?? []).filter((item) => {
        if (!item) return false;
        const classId =
          (typeof item.classId === "string" && item.classId.trim()) ||
          (typeof item.class_id === "string" && item.class_id.trim()) ||
          "";
        return classId.length > 0;
      }),
    []
  );

  const sanitizeSessionRows = useCallback(
    (rows: AdminPendingSessionLogs[]): AdminPendingSessionLogs[] =>
      (rows ?? []).filter((item) => Boolean(item && typeof item.classId === "string" && item.classId.trim())),
    []
  );

  const sanitizeRecentRows = useCallback(
    (rows: AdminRecentActivity[]): AdminRecentActivity[] =>
      (rows ?? []).filter((item) => Boolean(item && typeof item.classId === "string" && item.classId.trim())),
    []
  );

  const managerActions = useMemo<ManagerAction[]>(
    () => [
      { id: "reports", label: "Relatórios", route: "/coord/reports", icon: "bar-chart-outline" },
      { id: "coordination", label: "Coordenação", route: "/coord/management", icon: "people-outline" },
      { id: "events", label: "Eventos", route: "/coord/events", icon: "calendar-outline" },
      { id: "nfc", label: "NFC", route: "/prof/nfc-attendance", icon: "radio-outline" },
      { id: "members", label: "Membros", route: "/coord/org-members", icon: "person-add-outline" },
    ],
    []
  );

  const navigateTo = useCallback(
    (route: string) => {
      router.push(route as never);
    },
    [router]
  );

  const notifyResponsibleTeacher = useCallback(
    async (target: SummaryRouteTarget, head: ClassResponsible) => {
      if (!organizationId || notifying) return;
      setNotifying(true);

      try {
        await measureAsync(
          "screen.homeAdmin.action.notifyTeacher",
          async () => {
            const cooldownKey = getCooldownKey(organizationId, target.classId, target.targetDate);
            const lastSentAtRaw = await AsyncStorage.getItem(cooldownKey);
            const lastSentAt = Number(lastSentAtRaw ?? "0");
            if (Number.isFinite(lastSentAt) && lastSentAt > 0) {
              const elapsed = Date.now() - lastSentAt;
              if (elapsed < COOLDOWN_MS) {
                throw new Error("Aviso já enviado recentemente para esta turma/data.");
              }
            }

            if (!head?.userId) {
              throw new Error("Professor responsável não encontrado para esta turma.");
            }

            const result = await sendPushToUser({
              organizationId,
              targetUserId: head.userId,
              title: "Chamada pendente",
              body: `Turma ${target.className} (${target.unit}) - ${formatDateBr(
                target.targetDate
              )}. Toque para abrir.`,
              data: {
                type: "pending_attendance_reminder",
                route: "/class/[id]/attendance",
                params: {
                  id: target.classId,
                  date: target.targetDate,
                },
              },
            });

            if (result.sent <= 0) {
              throw new Error("Não foi possível entregar o push para o responsável desta turma.");
            }

            await AsyncStorage.setItem(cooldownKey, String(Date.now()));
          },
          {
            screen: "homeAdmin",
            organizationId,
            classId: target.classId,
            targetUserId: head.userId,
          }
        );

        Alert.alert("Aviso enviado", `Responsável ${head.displayName} notificado com sucesso.`);
      } catch (sendError) {
        const message = sendError instanceof Error ? sendError.message : "Falha ao enviar aviso.";
        Alert.alert("Não foi possível avisar", message);
      } finally {
        setNotifying(false);
      }
    },
    [notifying, organizationId]
  );

  const loadSummary = useCallback(async () => {
    const requestId = latestSummaryRequestRef.current + 1;
    latestSummaryRequestRef.current = requestId;

    if (!organizationId || !isOperationalAdmin) {
      setLoading(false);
      setError(null);
      setPendingAttendance([]);
      setPendingSessionLogs([]);
      setRecentActivity([]);
      setNotifyPreview(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [attendanceRows, sessionRows, activityRows] = await measureAsync(
        "screen.homeAdmin.load.summary",
        () =>
          Promise.all([
            listAdminPendingAttendance({ organizationId }),
            listAdminPendingSessionLogs({ organizationId }),
            listAdminRecentActivity({ organizationId, limit: 8 }),
          ]),
        { screen: "homeAdmin", organizationId }
      );

      if (latestSummaryRequestRef.current !== requestId) return;
      setPendingAttendance(sanitizeAttendanceRows(attendanceRows));
      setPendingSessionLogs(sanitizeSessionRows(sessionRows));
      setRecentActivity(sanitizeRecentRows(activityRows));
      setError(null);
    } catch (loadError) {
      if (latestSummaryRequestRef.current !== requestId) return;
      setPendingAttendance([]);
      setPendingSessionLogs([]);
      setRecentActivity([]);
      setNotifyPreview(null);
      setError(loadError instanceof Error ? loadError.message : "Falha ao carregar resumo.");
    } finally {
      if (latestSummaryRequestRef.current !== requestId) return;
      setLoading(false);
    }
  }, [isOperationalAdmin, organizationId, sanitizeAttendanceRows, sanitizeRecentRows, sanitizeSessionRows]);

  useEffect(() => {
    void loadSummary();
    return () => {
      latestSummaryRequestRef.current += 1;
    };
  }, [loadSummary]);

  const attendanceRouteTarget = useMemo(
    () => resolveAttendanceRouteTarget(pendingAttendance[0]),
    [pendingAttendance]
  );

  useEffect(() => {
    const requestId = latestHeadRequestRef.current + 1;
    latestHeadRequestRef.current = requestId;

    if (!organizationId || !attendanceRouteTarget) {
      setNotifyPreview(null);
      return;
    }

    setNotifyPreview({
      target: attendanceRouteTarget,
      head: null,
      loading: true,
    });

    void measureAsync(
      "screen.homeAdmin.load.responsible",
      () =>
        listClassHeadsByClassIds({
          organizationId,
          classIds: [attendanceRouteTarget.classId],
        }),
      { screen: "homeAdmin", organizationId, classId: attendanceRouteTarget.classId }
    )
      .then((heads) => {
        if (latestHeadRequestRef.current !== requestId) return;
        setNotifyPreview({
          target: attendanceRouteTarget,
          head: heads[0] ?? null,
          loading: false,
        });
      })
      .catch(() => {
        if (latestHeadRequestRef.current !== requestId) return;
        setNotifyPreview({
          target: attendanceRouteTarget,
          head: null,
          loading: false,
        });
      });

    return () => {
      latestHeadRequestRef.current += 1;
    };
  }, [attendanceRouteTarget, organizationId]);

  const managerMetrics = useMemo<MetricItem[]>(() => {
    const now = Date.now();
    const recent24h = recentActivity.filter((item) => {
      const parsed = new Date(item.occurredAt).getTime();
      return Number.isFinite(parsed) && now - parsed <= 24 * 60 * 60 * 1000;
    });
    const activeClasses24h = new Set(recent24h.map((item) => item.classId)).size;
    const criticalLogs = pendingSessionLogs.filter((item) => item.daysWithoutReport >= 2).length;

    return [
      {
        id: "attendance",
        label: "Chamadas pendentes",
        value: String(pendingAttendance.length),
        hint: "Aguardando fechamento",
      },
      {
        id: "reports",
        label: "Relatórios pendentes",
        value: String(pendingSessionLogs.length),
        hint: criticalLogs > 0 ? `${criticalLogs} com atraso crítico` : "Sem atraso crítico",
      },
      {
        id: "activity",
        label: "Atividade 24h",
        value: String(recent24h.length),
        hint: "Registros de execução",
      },
      {
        id: "classes",
        label: "Turmas ativas 24h",
        value: String(activeClasses24h),
        hint: "Com atividade recente",
      },
    ];
  }, [pendingAttendance.length, pendingSessionLogs, recentActivity]);

  const topRecent = useMemo(() => recentActivity.slice(0, 3), [recentActivity]);

  const mostCriticalSession = useMemo(() => {
    if (!pendingSessionLogs.length) return null;
    return [...pendingSessionLogs].sort((a, b) => b.daysWithoutReport - a.daysWithoutReport)[0];
  }, [pendingSessionLogs]);

  const containerSurface = useMemo(
    () => ({
      ...getGlassCardStyle(colors),
      borderColor: colors.border,
      backgroundColor: colors.card,
    }),
    [colors]
  );

  if (!isOperationalAdmin || !organizationId) return null;

  if (compact) {
    return (
      <View
        style={[
          styles.compactWrap,
          { backgroundColor: colors.secondaryBg, borderColor: colors.border },
        ]}
      >
        <View style={styles.compactHeaderRow}>
          <Text style={[styles.compactTitle, { color: colors.text }]}>Coordenação</Text>
          <Pressable onPress={() => navigateTo("/coord/management")} style={styles.compactOpenLink}>
            <Text style={[styles.compactOpenLinkText, { color: colors.muted }]}>Abrir</Text>
          </Pressable>
        </View>

        <Text style={[styles.compactMeta, { color: colors.muted }]}>
          {notifyPreview?.target
            ? `${notifyPreview.target.className} • ${formatDateBr(notifyPreview.target.targetDate)}`
            : "Sem chamada pendente no momento."}
        </Text>

        <Pressable
          onPress={() => {
            if (!notifyPreview?.target || !notifyPreview.head) return;
            void notifyResponsibleTeacher(notifyPreview.target, notifyPreview.head);
          }}
          disabled={notifying || notifyPreview?.loading || !notifyPreview?.head || !notifyPreview?.target}
          style={[
            styles.compactPrimaryAction,
            {
              backgroundColor:
                notifying || !notifyPreview?.head ? colors.primaryDisabledBg : colors.primaryBg,
              borderColor: colors.border,
            },
          ]}
        >
          <Ionicons name="notifications-outline" size={14} color={colors.primaryText} />
          <Text style={[styles.compactPrimaryActionText, { color: colors.primaryText }]}>
            {notifying
              ? "Enviando..."
              : notifyPreview?.head
              ? `Avisar ${getFirstName(notifyPreview.head.displayName)}`
              : "Responsável não definido"}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, containerSurface]}>
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <Text style={[styles.title, { color: colors.text }]}>Coordenação</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Visão gerencial da operação em tempo real
          </Text>
        </View>
      </View>

      <AdminQuickActions actions={managerActions} onPress={navigateTo} colors={colors} />

      <AdminOverview
        loading={loading}
        error={error}
        metrics={managerMetrics}
        onRetry={loadSummary}
        colors={colors}
      />

      {!loading && !error && notifyPreview ? (
        <View
          style={[
            styles.targetCard,
            { backgroundColor: colors.secondaryBg, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Fila de ação imediata</Text>
          <Text style={[styles.targetLine, { color: colors.text }]}>
            Turma alvo: {notifyPreview.target.className} • {notifyPreview.target.unit}
          </Text>
          <Text style={[styles.targetMeta, { color: colors.muted }]}>
            Data pendente: {formatDateBr(notifyPreview.target.targetDate)}
          </Text>
          <Text style={[styles.targetMeta, { color: colors.muted }]}>
            Responsável:{" "}
            {notifyPreview.loading
              ? "carregando..."
              : notifyPreview.head
              ? notifyPreview.head.displayName
              : "não definido"}
          </Text>

          <Pressable
            onPress={() => {
              if (!notifyPreview.head) return;
              void notifyResponsibleTeacher(notifyPreview.target, notifyPreview.head);
            }}
            disabled={notifying || notifyPreview.loading || !notifyPreview.head}
            style={[
              styles.primaryAction,
              {
                backgroundColor:
                  notifying || !notifyPreview.head ? colors.primaryDisabledBg : colors.primaryBg,
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons name="notifications-outline" size={16} color={colors.primaryText} />
            <Text style={[styles.primaryActionText, { color: colors.primaryText }]}>
              {notifying
                ? "Enviando aviso..."
                : notifyPreview.head
                ? `Avisar ${getFirstName(notifyPreview.head.displayName)}`
                : "Responsável não definido"}
            </Text>
          </Pressable>

          {!notifyPreview.loading && !notifyPreview.head ? (
            <Pressable onPress={() => navigateTo("/coord/management")} style={styles.secondaryActionLink}>
              <Text style={[styles.secondaryActionText, { color: colors.muted }]}>
                Definir responsável na coordenação
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {!loading && !error && mostCriticalSession ? (
        <View
          style={[
            styles.alertCard,
            { backgroundColor: colors.secondaryBg, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Ponto de atenção</Text>
          <Text style={[styles.alertText, { color: colors.text }]}>
            {mostCriticalSession.className} está há {mostCriticalSession.daysWithoutReport} dia(s) sem
            relatório.
          </Text>
          <Pressable onPress={() => navigateTo("/coord/reports")} style={styles.secondaryActionLink}>
            <Text style={[styles.secondaryActionText, { color: colors.muted }]}>
              Abrir relatórios
            </Text>
          </Pressable>
        </View>
      ) : null}

      {!loading && !error && topRecent.length > 0 ? (
        <View
          style={[
            styles.recentWrap,
            { backgroundColor: colors.secondaryBg, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Atividade recente</Text>
          {topRecent.map((item) => (
            <View key={`${item.kind}-${item.classId}-${item.occurredAt}`} style={styles.recentRow}>
              <View style={styles.recentBullet} />
              <View style={styles.recentContent}>
                <Text style={[styles.recentMain, { color: colors.text }]}>
                  {activityLabel(item.kind)} • {item.className}
                </Text>
                <Text style={[styles.recentMeta, { color: colors.muted }]}>
                  {formatDateTimeBr(item.occurredAt)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 18,
    padding: 14,
    gap: 12,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleWrap: {
    gap: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "500",
  },
  quickActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  quickActionButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 7,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: "700",
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metricTile: {
    width: "48%",
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 4,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  metricValue: {
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 24,
  },
  metricHint: {
    fontSize: 11,
    fontWeight: "500",
  },
  metricShimmer: {
    width: "48%",
    height: 70,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
  },
  targetCard: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 4,
  },
  targetLine: {
    fontSize: 14,
    fontWeight: "700",
  },
  targetMeta: {
    fontSize: 12,
    fontWeight: "500",
  },
  primaryAction: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 11,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  primaryActionText: {
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryActionLink: {
    alignSelf: "flex-start",
    paddingHorizontal: 2,
    paddingVertical: 2,
    marginTop: 2,
  },
  secondaryActionText: {
    fontSize: 12,
    fontWeight: "700",
  },
  alertCard: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 6,
  },
  alertText: {
    fontSize: 13,
    fontWeight: "600",
  },
  recentWrap: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  recentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  recentBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
    backgroundColor: "rgba(148,163,184,0.75)",
  },
  recentContent: {
    flex: 1,
    gap: 2,
  },
  recentMain: {
    fontSize: 13,
    fontWeight: "700",
  },
  recentMeta: {
    fontSize: 12,
    fontWeight: "500",
  },
  errorWrap: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.36)",
    backgroundColor: "rgba(239,68,68,0.10)",
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    fontWeight: "600",
  },
  retryButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  retryButtonText: {
    fontSize: 12,
    fontWeight: "700",
  },
  compactWrap: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 9,
    paddingHorizontal: 10,
    gap: 8,
  },
  compactHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  compactTitle: {
    fontSize: 13,
    fontWeight: "800",
  },
  compactOpenLink: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  compactOpenLinkText: {
    fontSize: 11,
    fontWeight: "700",
  },
  compactMeta: {
    fontSize: 12,
    fontWeight: "500",
  },
  compactPrimaryAction: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 9,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  compactPrimaryActionText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
