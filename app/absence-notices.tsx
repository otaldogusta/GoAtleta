import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenPageHeader } from "../src/components/ui/ScreenPageHeader";
import type { AbsenceNotice, ClassGroup, Student } from "../src/core/models";
import { getAbsenceNotices, getClasses, getStudents, updateAbsenceNoticeStatus } from "../src/db/seed";
import { navigateBackOrReplace } from "../src/navigation/safe-router";
import type { AppNotification } from "../src/notificationsInbox";
import { getNotifications, markNotificationRead } from "../src/notificationsInbox";
import { markRender, measureAsync } from "../src/observability/perf";
import { useOrganization } from "../src/providers/OrganizationProvider";
import { canActOnAbsenceNotice } from "../src/screens/absence-notices/absence-notice-state";
import { Pressable } from "../src/ui/Pressable";
import { useAppTheme } from "../src/ui/app-theme";

const statusLabels: Record<AbsenceNotice["status"], string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  ignored: "Ignorado",
};

const notificationTypeLabels: Record<AppNotification["type"], string> = {
  training_created: "Treino",
  training_saved: "Treino",
  birthday: "Aniversário",
  consultation_event: "Consultoria",
  absence_notice_created: "Ausência",
  absence_notice_status_changed: "Ausência",
  regulation_updated: "Regulamento",
  generic: "Aviso",
};

type NoticeListItem =
  | {
      id: string;
      kind: "notification";
      notification: AppNotification;
      absenceNotice: AbsenceNotice | null;
      sortTime: number;
    }
  | {
      id: string;
      kind: "absence";
      notification: null;
      absenceNotice: AbsenceNotice;
      sortTime: number;
    };

const formatDate = (value: string) => {
  const parsed = new Date(value + "T00:00:00");
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("pt-BR");
};

const formatTime = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toSortTime = (value: string | null | undefined, fallback: string) => {
  const parsed = new Date(value ?? fallback).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

export default function AbsenceNoticesScreen() {
  const { colors } = useAppTheme();
  const { activeOrganization } = useOrganization();
  const router = useRouter();
  markRender("screen.absenceNotices.render.root");

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [absenceNotices, setAbsenceNotices] = useState<AbsenceNotice[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadNotices = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [notificationList, absenceList, studentList, classList] = await measureAsync(
        "screen.absenceNotices.load.initial",
        () =>
          Promise.all([
            getNotifications(),
            getAbsenceNotices(),
            getStudents({ organizationId: activeOrganization?.id }),
            getClasses({ organizationId: activeOrganization?.id }),
          ]),
        { hasOrganization: activeOrganization?.id ? 1 : 0 }
      );
      setNotifications(notificationList);
      setAbsenceNotices(absenceList);
      setStudents(studentList);
      setClasses(classList);
    } catch {
      setNotifications([]);
      setAbsenceNotices([]);
      setStudents([]);
      setClasses([]);
      setLoadError(
        "Não foi possível carregar os avisos agora. Verifique sua sessão e tente novamente."
      );
    } finally {
      setIsLoading(false);
    }
  }, [activeOrganization?.id]);

  useEffect(() => {
    let alive = true;
    (async () => {
      await loadNotices();
      if (!alive) return;
    })();
    return () => {
      alive = false;
    };
  }, [loadNotices]);

  const studentsById = useMemo(
    () => new Map(students.map((item) => [item.id, item] as const)),
    [students]
  );

  const classesById = useMemo(
    () => new Map(classes.map((item) => [item.id, item] as const)),
    [classes]
  );

  const absenceById = useMemo(
    () => new Map(absenceNotices.map((item) => [item.id, item] as const)),
    [absenceNotices]
  );

  const listItems = useMemo<NoticeListItem[]>(() => {
    const notificationAbsenceIds = new Set(
      notifications
        .filter((item) => item.sourceType === "absence_notice" && item.sourceId)
        .map((item) => item.sourceId as string)
    );

    const notificationItems: NoticeListItem[] = notifications.map((notification) => ({
      id: notification.id,
      kind: "notification",
      notification,
      absenceNotice:
        notification.sourceType === "absence_notice" && notification.sourceId
          ? absenceById.get(notification.sourceId) ?? null
          : null,
      sortTime: toSortTime(notification.createdAt, notification.createdAt),
    }));

    const absenceFallbackItems: NoticeListItem[] = absenceNotices
      .filter((notice) => !notificationAbsenceIds.has(notice.id))
      .map((notice) => ({
        id: `absence-${notice.id}`,
        kind: "absence",
        notification: null,
        absenceNotice: notice,
        sortTime: toSortTime(notice.createdAt, `${notice.date}T00:00:00`),
      }));

    return [...notificationItems, ...absenceFallbackItems].sort(
      (left, right) => right.sortTime - left.sortTime
    );
  }, [absenceById, absenceNotices, notifications]);

  const getStudentName = useCallback(
    (id: string) => studentsById.get(id)?.name ?? "Aluno",
    [studentsById]
  );

  const getClassLabel = useCallback(
    (id: string) => {
      const cls = classesById.get(id);
      if (!cls) return "Turma";
      return cls.unit ? `${cls.unit} • ${cls.name}` : cls.name;
    },
    [classesById]
  );

  const getStatusColors = useCallback(
    (status: AbsenceNotice["status"] | "new" | "default") => {
      if (status === "confirmed") {
        return { backgroundColor: "rgba(65, 217, 132, 0.14)", color: colors.primaryBg };
      }
      if (status === "ignored") {
        return { backgroundColor: colors.secondaryBg, color: colors.muted };
      }
      if (status === "new") {
        return { backgroundColor: "rgba(65, 217, 132, 0.14)", color: colors.primaryBg };
      }
      if (status === "pending") {
        return {
          backgroundColor: "rgba(255, 210, 120, 0.14)",
          color: colors.warning ?? colors.text,
        };
      }
      return { backgroundColor: colors.secondaryBg, color: colors.muted };
    },
    [colors.muted, colors.primaryBg, colors.secondaryBg, colors.text, colors.warning]
  );

  const markRead = useCallback(async (notification: AppNotification) => {
    if (notification.read) return;
    await markNotificationRead(notification.id);
    const readAt = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((item) =>
        item.id === notification.id ? { ...item, read: true, readAt: item.readAt ?? readAt } : item
      )
    );
  }, []);

  const openNotification = useCallback(
    async (notification: AppNotification) => {
      await markRead(notification);
      if (notification.actionUrl) {
        router.push(notification.actionUrl as never);
      }
    },
    [markRead, router]
  );

  const updateStatus = useCallback(
    async (
      notice: AbsenceNotice,
      status: AbsenceNotice["status"],
      notification?: AppNotification | null
    ) => {
      setUpdatingId(notice.id);
      try {
        await updateAbsenceNoticeStatus(notice.id, status);
        setAbsenceNotices((prev) =>
          prev.map((item) => (item.id === notice.id ? { ...item, status } : item))
        );
        if (notification) {
          await markRead(notification);
        }
      } finally {
        setUpdatingId(null);
      }
    },
    [markRead]
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenPageHeader
        title="Avisos"
        onBack={() => navigateBackOrReplace({ router, fallback: "/prof/home" })}
      />
      <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 2, paddingBottom: 16, gap: 12 }}>
        {loadError ? (
          <View
            style={{
              padding: 16,
              borderRadius: 16,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 10,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>Avisos indisponíveis</Text>
            <Text style={{ color: colors.muted }}>{loadError}</Text>
            <Pressable
              onPress={loadNotices}
              style={{
                alignSelf: "flex-start",
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 10,
                backgroundColor: colors.primaryBg,
              }}
            >
              <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
                Tentar novamente
              </Text>
            </Pressable>
          </View>
        ) : listItems.length === 0 ? (
          <View
            style={{
              padding: 16,
              borderRadius: 16,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              {isLoading ? "Carregando avisos..." : "Nenhum aviso registrado"}
            </Text>
            <Text style={{ color: colors.muted, marginTop: 6 }}>
              Ausências, treinos, consultorias e atualizações vão aparecer aqui.
            </Text>
          </View>
        ) : (
          <FlatList
            data={listItems}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            windowSize={7}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            renderItem={({ item }) => {
              const notice = item.absenceNotice;
              const notification = item.notification;
              const isAbsence = Boolean(notice);
              const isPending = canActOnAbsenceNotice(notice);
              const isUpdating = notice ? updatingId === notice.id : false;
              const title = notification?.title ?? (notice ? getStudentName(notice.studentId) : "Aviso");
              const body =
                notification?.body ??
                (notice
                  ? `${getClassLabel(notice.classId)} • ${formatDate(notice.date)} • ${notice.reason}`
                  : "");
              const detail =
                notice && !notification
                  ? notice.note
                  : notification
                    ? formatTime(notification.createdAt)
                    : null;
              const badgeStatus = notice?.status ?? (!notification?.read ? "new" : "default");
              const badgeColors = getStatusColors(badgeStatus);
              const badgeLabel = notice
                ? statusLabels[notice.status]
                : notification?.read
                  ? notificationTypeLabels[notification.type]
                  : "Novo";

              return (
                <Pressable
                  onPress={() => {
                    if (!notification?.actionUrl) return;
                    void openNotification(notification);
                  }}
                  disabled={!notification?.actionUrl}
                  style={{
                    padding: 14,
                    borderRadius: 16,
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: notification && !notification.read ? colors.primaryBg : colors.border,
                    gap: 8,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "700", flex: 1 }}>
                      {title}
                    </Text>
                    <View
                      style={{
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        backgroundColor: badgeColors.backgroundColor,
                      }}
                    >
                      <Text style={{ color: badgeColors.color, fontSize: 12, fontWeight: "700" }}>
                        {badgeLabel}
                      </Text>
                    </View>
                  </View>
                  {body ? <Text style={{ color: colors.text }}>{body}</Text> : null}
                  {notice && notification ? (
                    <Text style={{ color: colors.muted }}>
                      {getClassLabel(notice.classId)} • {formatDate(notice.date)}
                    </Text>
                  ) : null}
                  {detail ? <Text style={{ color: colors.muted }}>{detail}</Text> : null}
                  {isAbsence && isPending && notice ? (
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Pressable
                        onPress={() => updateStatus(notice, "confirmed", notification)}
                        disabled={isUpdating}
                        style={{
                          flex: 1,
                          paddingVertical: 8,
                          borderRadius: 10,
                          backgroundColor: isUpdating ? colors.primaryDisabledBg : colors.primaryBg,
                          alignItems: "center",
                        }}
                      >
                        <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
                          Confirmar
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => updateStatus(notice, "ignored", notification)}
                        disabled={isUpdating}
                        style={{
                          flex: 1,
                          paddingVertical: 8,
                          borderRadius: 10,
                          backgroundColor: colors.secondaryBg,
                          borderWidth: 1,
                          borderColor: colors.border,
                          alignItems: "center",
                          opacity: isUpdating ? 0.6 : 1,
                        }}
                      >
                        <Text style={{ color: colors.text, fontWeight: "700" }}>Ignorar</Text>
                      </Pressable>
                    </View>
                  ) : notification?.actionUrl ? (
                    <Text style={{ color: colors.primaryBg, fontWeight: "700" }}>Abrir</Text>
                  ) : null}
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
