import { usePathname, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SectionList, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ResponsivePage } from "../src/components/ui/ResponsivePage";
import { SectionLoadingState } from "../src/components/ui/SectionLoadingState";
import { ScreenPageHeader } from "../src/components/ui/ScreenPageHeader";
import { useEffectiveProfile } from "../src/hooks/use-effective-profile";
import type { AbsenceNotice, ClassGroup, Student } from "../src/core/models";
import {
  getAbsenceNotices,
  getClasses,
  getStudents,
  updateAbsenceNoticeStatus,
} from "../src/db/seed";
import { navigateBackOrReplace } from "../src/navigation/safe-router";
import type { AppNotification } from "../src/notificationsInbox";
import {
  archiveRead,
  getNotificationsPage,
  markAllRead,
  markNotificationRead,
  restoreNotification,
} from "../src/notificationsInbox";
import { markRender, measureAsync } from "../src/observability/perf";
import { resolveNotificationInboxScope } from "../src/notifications/inbox-scope";
import { useOrganization } from "../src/providers/OrganizationProvider";
import { canActOnAbsenceNotice } from "../src/screens/absence-notices/absence-notice-state";
import {
  buildNoticeFeedSections,
  resolveNoticeFeedCategory,
  type NoticeFeedFilter,
} from "../src/screens/absence-notices/notice-feed-view-model";
import { radius, spacing } from "../src/theme/tokens";
import { FadeHorizontalScroll } from "../src/ui/FadeHorizontalScroll";
import { Pressable } from "../src/ui/Pressable";
import { useAppTheme } from "../src/ui/app-theme";
import { useConfirmDialog } from "../src/ui/confirm-dialog";
import { GoAtletaIcon, type GoAtletaIconName } from "../src/ui/icon-registry";
import { useResponsiveLayout } from "../src/ui/use-responsive-layout";

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

const notificationTypeIcons: Record<AppNotification["type"], GoAtletaIconName> =
  {
    training_created: "plan",
    training_saved: "plan",
    birthday: "birthday",
    consultation_event: "consultation",
    absence_notice_created: "absenceNotices",
    absence_notice_status_changed: "absenceNotices",
    regulation_updated: "regulations",
    generic: "notifications",
  };

const filterLabels: Record<NoticeFeedFilter, string> = {
  all: "Todos",
  unread: "Não lidos",
  absence: "Ausências",
  birthday: "Aniversários",
  other: "Atualizações",
  archived: "Arquivados",
};

const filterOrder: readonly NoticeFeedFilter[] = [
  "all",
  "unread",
  "absence",
  "birthday",
  "other",
  "archived",
];

const NOTIFICATIONS_PAGE_SIZE = 20;

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

type NotificationsCenterScreenProps = {
  fallbackRoute?: string;
};

export function NotificationsCenterScreen({
  fallbackRoute = "/prof/home",
}: NotificationsCenterScreenProps) {
  const { colors } = useAppTheme();
  const responsive = useResponsiveLayout("content");
  const { activeOrganization } = useOrganization();
  const router = useRouter();
  const pathname = usePathname();
  const effectiveProfile = useEffectiveProfile();
  const inboxScope = resolveNotificationInboxScope({
    pathname,
    effectiveProfile,
  });
  const { confirm: confirmDialog } = useConfirmDialog();
  markRender("screen.absenceNotices.render.root");

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [absenceNotices, setAbsenceNotices] = useState<AbsenceNotice[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<NoticeFeedFilter>("all");
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [hasMoreNotifications, setHasMoreNotifications] = useState(false);
  const [notificationOffset, setNotificationOffset] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isArchivingRead, setIsArchivingRead] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const showingArchived = selectedFilter === "archived";

  const loadNotices = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [notificationPage, absenceList, studentList, classList] =
        await measureAsync(
          "screen.absenceNotices.load.initial",
          () =>
            Promise.all([
              getNotificationsPage({
                inboxScope,
                limit: NOTIFICATIONS_PAGE_SIZE,
                archiveScope: showingArchived ? "archived" : "active",
              }),
              getAbsenceNotices(),
              getStudents({ organizationId: activeOrganization?.id }),
              getClasses({ organizationId: activeOrganization?.id }),
            ]),
          { hasOrganization: activeOrganization?.id ? 1 : 0 },
        );
      setNotifications(notificationPage.items);
      setHasMoreNotifications(notificationPage.hasMore);
      setNotificationOffset(notificationPage.nextOffset);
      setAbsenceNotices(absenceList);
      setStudents(studentList);
      setClasses(classList);
    } catch {
      setNotifications([]);
      setHasMoreNotifications(false);
      setNotificationOffset(0);
      setAbsenceNotices([]);
      setStudents([]);
      setClasses([]);
      setLoadError(
        "Não foi possível carregar os avisos agora. Verifique sua sessão e tente novamente.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [activeOrganization?.id, inboxScope, showingArchived]);

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
    [students],
  );

  const classesById = useMemo(
    () => new Map(classes.map((item) => [item.id, item] as const)),
    [classes],
  );

  const absenceById = useMemo(
    () => new Map(absenceNotices.map((item) => [item.id, item] as const)),
    [absenceNotices],
  );

  const listItems = useMemo<NoticeListItem[]>(() => {
    const notificationAbsenceIds = new Set(
      notifications
        .filter((item) => item.sourceType === "absence_notice" && item.sourceId)
        .map((item) => item.sourceId as string),
    );

    const notificationItems: NoticeListItem[] = notifications.map(
      (notification) => ({
        id: notification.id,
        kind: "notification",
        notification,
        absenceNotice:
          notification.sourceType === "absence_notice" && notification.sourceId
            ? (absenceById.get(notification.sourceId) ?? null)
            : null,
        sortTime: toSortTime(notification.createdAt, notification.createdAt),
      }),
    );

    const absenceFallbackItems: NoticeListItem[] = (
      showingArchived ? [] : absenceNotices
    )
      .filter((notice) => !notificationAbsenceIds.has(notice.id))
      .map((notice) => ({
        id: `absence-${notice.id}`,
        kind: "absence",
        notification: null,
        absenceNotice: notice,
        sortTime: toSortTime(notice.createdAt, `${notice.date}T00:00:00`),
      }));

    return [...notificationItems, ...absenceFallbackItems].sort(
      (left, right) => right.sortTime - left.sortTime,
    );
  }, [absenceById, absenceNotices, notifications, showingArchived]);

  const feedCandidates = useMemo(
    () =>
      listItems.map((item) => ({
        value: item,
        sortTime: item.sortTime,
        category: resolveNoticeFeedCategory({
          hasAbsenceNotice: Boolean(item.absenceNotice),
          notificationType: item.notification?.type,
        }),
        unread: Boolean(item.notification && !item.notification.read),
        archived: Boolean(item.notification?.archived),
      })),
    [listItems],
  );

  const sections = useMemo(
    () => buildNoticeFeedSections(feedCandidates, selectedFilter),
    [feedCandidates, selectedFilter],
  );

  const filterCounts = useMemo<Record<NoticeFeedFilter, number>>(
    () => ({
      all: feedCandidates.length,
      unread: feedCandidates.filter((item) => item.unread).length,
      absence: feedCandidates.filter((item) => item.category === "absence")
        .length,
      birthday: feedCandidates.filter((item) => item.category === "birthday")
        .length,
      other: feedCandidates.filter((item) => item.category === "other").length,
      archived: showingArchived ? feedCandidates.length : 0,
    }),
    [feedCandidates, showingArchived],
  );

  const unreadCount = filterCounts.unread;
  const pendingAbsenceCount = absenceNotices.filter(
    (notice) => notice.status === "pending",
  ).length;
  const headerSubtitle = showingArchived
    ? `${notifications.length}${hasMoreNotifications ? "+" : ""} ${
        notifications.length === 1 ? "aviso arquivado" : "avisos arquivados"
      }`
    : unreadCount > 0 || pendingAbsenceCount > 0
      ? [
          unreadCount > 0
            ? `${unreadCount} não ${unreadCount === 1 ? "lido" : "lidos"}`
            : null,
          pendingAbsenceCount > 0
            ? `${pendingAbsenceCount} ${pendingAbsenceCount === 1 ? "ausência pendente" : "ausências pendentes"}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : "Tudo em dia";

  const readActiveCount = notifications.filter(
    (item) => item.read && !item.archived,
  ).length;

  const getStudentName = useCallback(
    (id: string) => studentsById.get(id)?.name ?? "Aluno",
    [studentsById],
  );

  const getClassLabel = useCallback(
    (id: string) => {
      const cls = classesById.get(id);
      if (!cls) return "Turma";
      return cls.unit ? `${cls.unit} • ${cls.name}` : cls.name;
    },
    [classesById],
  );

  const getStatusColors = useCallback(
    (status: AbsenceNotice["status"] | "new" | "default") => {
      if (status === "confirmed") {
        return {
          backgroundColor: "rgba(65, 217, 132, 0.14)",
          color: colors.primaryBg,
        };
      }
      if (status === "ignored") {
        return { backgroundColor: colors.secondaryBg, color: colors.muted };
      }
      if (status === "new") {
        return {
          backgroundColor: "rgba(65, 217, 132, 0.14)",
          color: colors.primaryBg,
        };
      }
      if (status === "pending") {
        return {
          backgroundColor: "rgba(255, 210, 120, 0.14)",
          color: colors.warning ?? colors.text,
        };
      }
      return { backgroundColor: colors.secondaryBg, color: colors.muted };
    },
    [
      colors.muted,
      colors.primaryBg,
      colors.secondaryBg,
      colors.text,
      colors.warning,
    ],
  );

  const markRead = useCallback(async (notification: AppNotification) => {
    if (notification.read) return;
    await markNotificationRead(notification.id, inboxScope);
    const readAt = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((item) =>
        item.id === notification.id
          ? { ...item, read: true, readAt: item.readAt ?? readAt }
          : item,
      ),
    );
  }, [inboxScope]);

  const markAllNotificationsAsRead = useCallback(async () => {
    if (isMarkingAllRead || unreadCount === 0) return;
    setIsMarkingAllRead(true);
    setActionError(null);
    try {
      await markAllRead(inboxScope);
      const readAt = new Date().toISOString();
      setNotifications((current) =>
        current.map((item) => ({
          ...item,
          read: true,
          readAt: item.readAt ?? readAt,
        })),
      );
    } catch {
      setActionError("Não foi possível marcar os avisos como lidos.");
    } finally {
      setIsMarkingAllRead(false);
    }
  }, [inboxScope, isMarkingAllRead, unreadCount]);

  const loadMoreNotifications = useCallback(async () => {
    if (isLoadingMore || !hasMoreNotifications) return;
    setIsLoadingMore(true);
    setActionError(null);
    try {
      const page = await getNotificationsPage({
        inboxScope,
        limit: NOTIFICATIONS_PAGE_SIZE,
        offset: notificationOffset,
        archiveScope: showingArchived ? "archived" : "active",
      });
      setNotifications((current) => {
        const knownIds = new Set(current.map((item) => item.id));
        return [
          ...current,
          ...page.items.filter((item) => !knownIds.has(item.id)),
        ];
      });
      setNotificationOffset(page.nextOffset);
      setHasMoreNotifications(page.hasMore);
    } catch {
      setActionError("Não foi possível carregar mais avisos.");
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    hasMoreNotifications,
    inboxScope,
    isLoadingMore,
    notificationOffset,
    showingArchived,
  ]);

  const requestArchiveReadNotifications = useCallback(() => {
    if (isArchivingRead || readActiveCount === 0) return;
    void confirmDialog({
      title: "Limpar avisos lidos?",
      message:
        "Os avisos lidos sairão da lista principal e poderão ser recuperados em Arquivados. Chamadas, ausências, planejamentos e outros registros não serão apagados.",
      confirmLabel: "Limpar lidos",
      cancelLabel: "Cancelar",
      onConfirm: async () => {
        setIsArchivingRead(true);
        setActionError(null);
        try {
          await archiveRead(inboxScope);
          await loadNotices();
        } catch {
          setActionError("Não foi possível arquivar os avisos lidos.");
        } finally {
          setIsArchivingRead(false);
        }
      },
    });
  }, [confirmDialog, inboxScope, isArchivingRead, loadNotices, readActiveCount]);

  const restoreArchivedNotification = useCallback(
    async (notificationId: string) => {
      if (restoringId) return;
      setRestoringId(notificationId);
      setActionError(null);
      try {
        await restoreNotification(notificationId, inboxScope);
        setNotifications((current) =>
          current.filter((item) => item.id !== notificationId),
        );
      } catch {
        setActionError("Não foi possível restaurar este aviso.");
      } finally {
        setRestoringId(null);
      }
    },
    [inboxScope, restoringId],
  );

  const openNotification = useCallback(
    async (notification: AppNotification) => {
      await markRead(notification);
      if (notification.actionUrl) {
        router.push(notification.actionUrl as never);
      }
    },
    [markRead, router],
  );

  const updateStatus = useCallback(
    async (
      notice: AbsenceNotice,
      status: AbsenceNotice["status"],
      notification?: AppNotification | null,
    ) => {
      setUpdatingId(notice.id);
      setActionError(null);
      try {
        await updateAbsenceNoticeStatus(notice.id, status);
        setAbsenceNotices((prev) =>
          prev.map((item) =>
            item.id === notice.id ? { ...item, status } : item,
          ),
        );
        if (notification) {
          await markRead(notification);
        }
      } catch {
        setActionError("Não foi possível atualizar este aviso de ausência.");
      } finally {
        setUpdatingId(null);
      }
    },
    [markRead],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ResponsivePage style={{ flex: 1 }} gap={0}>
        <ScreenPageHeader
          title="Avisos"
          subtitle={headerSubtitle}
          horizontalBleed={0}
          contentStyle={{ paddingHorizontal: 0, paddingBottom: spacing.md }}
          onBack={() =>
            navigateBackOrReplace({ router, fallback: fallbackRoute })
          }
          right={
            unreadCount > 0 ? (
              <Pressable
                accessibilityLabel="Marcar todos os avisos como lidos"
                disabled={isMarkingAllRead}
                onPress={() => void markAllNotificationsAsRead()}
                style={{
                  minHeight: 40,
                  paddingHorizontal: responsive.isMobile ? 10 : 14,
                  borderRadius: radius.card,
                  backgroundColor: colors.secondaryBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  opacity: isMarkingAllRead ? 0.6 : 1,
                }}
              >
                <GoAtletaIcon
                  name="checkmarkCircle"
                  size={18}
                  color={colors.primaryBg}
                />
                {!responsive.isMobile ? (
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 13,
                      fontWeight: "800",
                    }}
                  >
                    Marcar como lidos
                  </Text>
                ) : null}
              </Pressable>
            ) : null
          }
        />

        <View
          style={{
            flex: 1,
            minWidth: 0,
            gap: spacing.sm,
            paddingBottom: spacing.md,
          }}
        >
          <FadeHorizontalScroll
            fadeColor={colors.background}
            fadeWidth={28}
            contentContainerStyle={{ gap: spacing.xs, paddingRight: 28 }}
          >
            {filterOrder.map((filter) => {
              const active = filter === selectedFilter;
              return (
                <Pressable
                  key={filter}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setSelectedFilter(filter)}
                  style={{
                    minHeight: 38,
                    paddingHorizontal: 13,
                    borderRadius: radius.full,
                    borderWidth: 1,
                    borderColor: active ? colors.successBorder : colors.border,
                    backgroundColor: active ? colors.successBg : colors.card,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 7,
                  }}
                >
                  <Text
                    style={{
                      color: active ? colors.successText : colors.text,
                      fontSize: 13,
                      fontWeight: active ? "800" : "700",
                    }}
                  >
                    {filterLabels[filter]}
                  </Text>
                  {filter !== "archived" || showingArchived ? (
                    <Text
                      style={{
                        color: active ? colors.successText : colors.muted,
                        fontSize: 12,
                        fontWeight: "800",
                      }}
                    >
                      {filterCounts[filter]}
                      {filterCounts[filter] > 0 && hasMoreNotifications
                        ? "+"
                        : ""}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </FadeHorizontalScroll>

          {!showingArchived && readActiveCount > 0 ? (
            <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
              <Pressable
                accessibilityLabel="Limpar avisos lidos"
                disabled={isArchivingRead}
                onPress={requestArchiveReadNotifications}
                style={{
                  minHeight: 36,
                  paddingHorizontal: 12,
                  borderRadius: radius.internal,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                  opacity: isArchivingRead ? 0.6 : 1,
                }}
              >
                <GoAtletaIcon name="archive" size={17} color={colors.muted} />
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 12,
                    fontWeight: "800",
                  }}
                >
                  Limpar lidos
                </Text>
              </Pressable>
            </View>
          ) : null}

          {actionError ? (
            <View
              accessibilityRole="alert"
              style={{
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: radius.card,
                backgroundColor: colors.dangerBg,
                borderWidth: 1,
                borderColor: colors.dangerBorder,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <GoAtletaIcon
                name="warningCircle"
                size={18}
                color={colors.dangerText}
              />
              <Text
                style={{ flex: 1, color: colors.dangerText, fontWeight: "700" }}
              >
                {actionError}
              </Text>
            </View>
          ) : null}

          {loadError ? (
            <View
              style={{
                padding: spacing.md,
                borderRadius: radius.container,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                gap: 10,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "800" }}>
                Avisos indisponíveis
              </Text>
              <Text style={{ color: colors.muted }}>{loadError}</Text>
              <Pressable
                onPress={loadNotices}
                style={{
                  alignSelf: "flex-start",
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: radius.internal,
                  backgroundColor: colors.primaryBg,
                }}
              >
                <Text style={{ color: colors.primaryText, fontWeight: "800" }}>
                  Tentar novamente
                </Text>
              </Pressable>
            </View>
          ) : isLoading && listItems.length === 0 ? (
            <SectionLoadingState />
          ) : (
            <SectionList
              sections={sections}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              stickySectionHeadersEnabled={false}
              contentContainerStyle={{ paddingBottom: spacing.xl }}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={7}
              ListEmptyComponent={
                <View
                  style={{
                    padding: spacing.lg,
                    borderRadius: radius.container,
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <GoAtletaIcon
                    name={
                      selectedFilter === "unread"
                        ? "checkmarkCircle"
                        : selectedFilter === "archived"
                          ? "archive"
                          : "notifications"
                    }
                    size={24}
                    color={
                      selectedFilter === "unread"
                        ? colors.success
                        : colors.muted
                    }
                  />
                  <Text style={{ color: colors.text, fontWeight: "800" }}>
                    {listItems.length === 0
                      ? "Nenhum aviso registrado"
                      : `Nenhum aviso em ${filterLabels[selectedFilter].toLowerCase()}`}
                  </Text>
                  <Text style={{ color: colors.muted, textAlign: "center" }}>
                    {selectedFilter === "unread"
                      ? "Você já revisou todos os avisos."
                      : selectedFilter === "archived"
                        ? "Os avisos limpos poderão ser recuperados aqui."
                        : "Novos avisos aparecerão aqui quando forem registrados."}
                  </Text>
                </View>
              }
              ListFooterComponent={
                notifications.length > 0 ? (
                  <View
                    style={{
                      paddingTop: spacing.md,
                      alignItems: "center",
                      justifyContent: "center",
                      gap: spacing.xs,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.muted,
                        fontSize: 12,
                        fontWeight: "700",
                      }}
                    >
                      {notifications.length}
                      {hasMoreNotifications ? "+" : ""} avisos carregados
                    </Text>
                    {hasMoreNotifications ? (
                      <Pressable
                        accessibilityLabel="Carregar mais avisos"
                        disabled={isLoadingMore}
                        onPress={() => void loadMoreNotifications()}
                        style={{
                          minHeight: 38,
                          paddingHorizontal: 14,
                          borderRadius: radius.internal,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: colors.secondaryBg,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 7,
                          opacity: isLoadingMore ? 0.6 : 1,
                        }}
                      >
                        <GoAtletaIcon
                          name="chevronDown"
                          size={17}
                          color={colors.text}
                        />
                        <Text
                          style={{
                            color: colors.text,
                            fontSize: 12,
                            fontWeight: "800",
                          }}
                        >
                          {isLoadingMore ? "Carregando..." : "Carregar mais"}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null
              }
              renderSectionHeader={({ section }) => (
                <View
                  style={{
                    paddingTop: spacing.sm,
                    paddingBottom: spacing.xs,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 14,
                      fontWeight: "900",
                    }}
                  >
                    {section.title}
                  </Text>
                  <Text
                    style={{
                      color: colors.muted,
                      fontSize: 12,
                      fontWeight: "700",
                    }}
                  >
                    {section.data.length}
                  </Text>
                </View>
              )}
              renderItem={({ item, index, section }) => {
                const notice = item.absenceNotice;
                const notification = item.notification;
                const isPending = canActOnAbsenceNotice(notice);
                const isUpdating = notice ? updatingId === notice.id : false;
                const unread = Boolean(notification && !notification.read);
                const first = index === 0;
                const last = index === section.data.length - 1;
                const category = resolveNoticeFeedCategory({
                  hasAbsenceNotice: Boolean(notice),
                  notificationType: notification?.type,
                });
                const title =
                  notification?.title ??
                  (notice ? getStudentName(notice.studentId) : "Aviso");
                const body =
                  notification?.body ??
                  (notice
                    ? `${notice.reason}${notice.note ? ` • ${notice.note}` : ""}`
                    : "");
                const contextLabel = notice
                  ? `${getClassLabel(notice.classId)} • ${formatDate(notice.date)}`
                  : null;
                const typeLabel = notice
                  ? "Ausência"
                  : notification
                    ? notificationTypeLabels[notification.type]
                    : "Aviso";
                const iconName = notice
                  ? "absenceNotices"
                  : notification
                    ? notificationTypeIcons[notification.type]
                    : "notifications";
                const iconBackground =
                  category === "absence"
                    ? colors.warningBg
                    : category === "birthday"
                      ? colors.infoBg
                      : colors.secondaryBg;
                const iconColor =
                  category === "absence"
                    ? colors.warningText
                    : category === "birthday"
                      ? colors.infoText
                      : colors.muted;
                const statusColors = notice
                  ? getStatusColors(notice.status)
                  : null;

                return (
                  <Pressable
                    accessibilityLabel={`${unread ? "Não lido. " : ""}${title}`}
                    onPress={() => {
                      if (notification) void openNotification(notification);
                    }}
                    disabled={!notification && !isPending}
                    style={{
                      paddingHorizontal: responsive.isMobile ? 12 : 14,
                      paddingVertical: 12,
                      backgroundColor: unread
                        ? colors.surfaceElevated
                        : colors.card,
                      borderWidth: 1,
                      borderBottomWidth: last ? 1 : 0,
                      borderColor: unread
                        ? colors.successBorder
                        : colors.border,
                      borderTopLeftRadius: first ? radius.container : 0,
                      borderTopRightRadius: first ? radius.container : 0,
                      borderBottomLeftRadius: last ? radius.container : 0,
                      borderBottomRightRadius: last ? radius.container : 0,
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: radius.internal,
                        backgroundColor: iconBackground,
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <GoAtletaIcon
                        name={iconName}
                        size={19}
                        color={iconColor}
                      />
                    </View>

                    <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        {unread ? (
                          <View
                            accessibilityLabel="Não lido"
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: 4,
                              backgroundColor: colors.primaryBg,
                            }}
                          />
                        ) : null}
                        <Text
                          numberOfLines={1}
                          style={{
                            flex: 1,
                            color: colors.text,
                            fontSize: 14,
                            fontWeight: "800",
                          }}
                        >
                          {title}
                        </Text>
                        {notice && statusColors ? (
                          <View
                            style={{
                              borderRadius: radius.full,
                              paddingHorizontal: 9,
                              paddingVertical: 3,
                              backgroundColor: statusColors.backgroundColor,
                            }}
                          >
                            <Text
                              style={{
                                color: statusColors.color,
                                fontSize: 11,
                                fontWeight: "800",
                              }}
                            >
                              {statusLabels[notice.status]}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      {body ? (
                        <Text
                          numberOfLines={2}
                          style={{
                            color: colors.textSecondary,
                            lineHeight: 19,
                          }}
                        >
                          {body}
                        </Text>
                      ) : null}
                      {contextLabel ? (
                        <Text
                          numberOfLines={1}
                          style={{ color: colors.muted, fontSize: 12 }}
                        >
                          {contextLabel}
                        </Text>
                      ) : null}
                      <Text style={{ color: colors.muted, fontSize: 12 }}>
                        {typeLabel}
                        {notification
                          ? ` • ${formatTime(notification.createdAt)}`
                          : ""}
                      </Text>

                      {notice && isPending ? (
                        <View
                          style={{
                            marginTop: 5,
                            flexDirection: "row",
                            flexWrap: "wrap",
                            gap: 8,
                          }}
                        >
                          <Pressable
                            onPress={() =>
                              void updateStatus(
                                notice,
                                "confirmed",
                                notification,
                              )
                            }
                            disabled={isUpdating}
                            style={{
                              minHeight: 34,
                              paddingHorizontal: 12,
                              borderRadius: radius.internal,
                              backgroundColor: isUpdating
                                ? colors.primaryDisabledBg
                                : colors.primaryBg,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Text
                              style={{
                                color: colors.primaryText,
                                fontSize: 12,
                                fontWeight: "800",
                              }}
                            >
                              Confirmar
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() =>
                              void updateStatus(notice, "ignored", notification)
                            }
                            disabled={isUpdating}
                            style={{
                              minHeight: 34,
                              paddingHorizontal: 12,
                              borderRadius: radius.internal,
                              backgroundColor: colors.secondaryBg,
                              borderWidth: 1,
                              borderColor: colors.border,
                              alignItems: "center",
                              justifyContent: "center",
                              opacity: isUpdating ? 0.6 : 1,
                            }}
                          >
                            <Text
                              style={{
                                color: colors.text,
                                fontSize: 12,
                                fontWeight: "800",
                              }}
                            >
                              Ignorar
                            </Text>
                          </Pressable>
                        </View>
                      ) : showingArchived && notification ? (
                        <Pressable
                          accessibilityLabel={`Restaurar aviso ${title}`}
                          disabled={restoringId === notification.id}
                          onPress={(event) => {
                            event.stopPropagation();
                            void restoreArchivedNotification(notification.id);
                          }}
                          style={{
                            marginTop: 5,
                            alignSelf: "flex-start",
                            minHeight: 34,
                            paddingHorizontal: 11,
                            borderRadius: radius.internal,
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: colors.secondaryBg,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            opacity: restoringId === notification.id ? 0.6 : 1,
                          }}
                        >
                          <GoAtletaIcon
                            name="restore"
                            size={16}
                            color={colors.text}
                          />
                          <Text
                            style={{
                              color: colors.text,
                              fontSize: 12,
                              fontWeight: "800",
                            }}
                          >
                            Restaurar
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>

                    {notification?.actionUrl ? (
                      <GoAtletaIcon
                        name="chevronForward"
                        size={17}
                        color={colors.muted}
                        style={{ marginTop: 10 }}
                      />
                    ) : null}
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      </ResponsivePage>
    </SafeAreaView>
  );
}

export default function AbsenceNoticesScreen() {
  return <NotificationsCenterScreen />;
}
