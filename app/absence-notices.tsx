import { useIsFocused, usePathname, useRouter } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Platform, SectionList, View } from "react-native";
import { OperationalText as Text } from "../src/ui/OperationalText";
import { SafeAreaView } from "react-native-safe-area-context";

import { useRole } from "../src/auth/role";
import { FullscreenLoadingState } from "../src/components/ui/FullscreenLoadingState";
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
import { resolveNotificationOrganizationId } from "../src/notifications/notification-organization";
import { useOrganization } from "../src/providers/organization-context";
import { canActOnAbsenceNotice } from "../src/screens/absence-notices/absence-notice-state";
import {
  buildNoticeFeedSections,
  resolveNoticeFeedCategory,
  type NoticeFeedFilter,
} from "../src/screens/absence-notices/notice-feed-view-model";
import { borders, compactUiMetrics, radius, spacing } from "../src/theme/tokens";
import { UnderlineTabs } from "../src/ui/UnderlineTabs";
import { CompactSelect } from "../src/ui/CompactSelect";
import { ListEmptyState } from "../src/ui/ListEmptyState";
import { Button } from "../src/ui/Button";
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
  generic: "Notificação",
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

const emptyFilterLabels: Record<NoticeFeedFilter, string> = {
  all: "Nenhum aviso por aqui",
  unread: "Nenhum aviso não lido",
  absence: "Nenhum aviso de ausência",
  birthday: "Nenhum aniversário",
  other: "Nenhuma atualização",
  archived: "Nenhum aviso arquivado",
};

const NOTIFICATIONS_PAGE_SIZE = 20;
const noticeItemFocusId = (id: string) => `notice-feed-item-${id}`;
const noticeFilterFocusId = (filter: NoticeFeedFilter) => `notice-feed-filter-${filter}`;

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
  const { student } = useRole();
  const router = useRouter();
  const isFocused = useIsFocused();
  const pathname = usePathname();
  const effectiveProfile = useEffectiveProfile();
  const inboxScope = resolveNotificationInboxScope({
    pathname,
    effectiveProfile,
  });
  const notificationOrganizationId = resolveNotificationOrganizationId({
    activeOrganizationId: activeOrganization?.id,
    studentOrganizationId: student?.organizationId,
    inboxScope,
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
  const [actionFeedback, setActionFeedback] = useState<{ scope: string; message: string } | null>(null);
  const [focusAfterAction, setFocusAfterAction] = useState<{
    scope: string;
    filter: NoticeFeedFilter;
    preferredId: string | null;
    waitsForReturn: boolean;
  } | null>(null);
  const detailWasOpened = useRef(false);

  const showingArchived = selectedFilter === "archived";
  const noticesContextKey = `${notificationOrganizationId ?? "none"}:${inboxScope}`;
  const noticesContextKeyRef = useRef(noticesContextKey);
  const showingArchivedRef = useRef(showingArchived);
  const loadNoticesRequestIdRef = useRef(0);
  const loadMoreRequestIdRef = useRef(0);
  useLayoutEffect(() => {
    noticesContextKeyRef.current = noticesContextKey;
  }, [noticesContextKey]);
  const [loadedNoticesContextKey, setLoadedNoticesContextKey] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<{ context: string; archived: boolean } | null>(null);
  const hasVisibleSnapshot = snapshot?.context === noticesContextKey && snapshot.archived === showingArchived;
  const switchingArchive = !hasVisibleSnapshot && !loadError;

  const loadNotices = useCallback(async (archived = showingArchived) => {
    const requestContextKey = noticesContextKey;
    if (noticesContextKeyRef.current !== requestContextKey || showingArchivedRef.current !== archived) return;
    const requestId = ++loadNoticesRequestIdRef.current;
    loadMoreRequestIdRef.current += 1;
    const isCurrentRequest = () =>
      loadNoticesRequestIdRef.current === requestId &&
      noticesContextKeyRef.current === requestContextKey &&
      showingArchivedRef.current === archived;

    setIsLoading(true);
    setIsLoadingMore(false);
    setLoadError(null);
    try {
      const [notificationPage, absenceList, studentList, classList] =
        await measureAsync(
          "screen.absenceNotices.load.initial",
          () =>
            Promise.all([
              getNotificationsPage({
                inboxScope,
                organizationId: notificationOrganizationId,
                limit: NOTIFICATIONS_PAGE_SIZE,
                archiveScope: archived ? "archived" : "active",
                throwOnError: true,
              }),
              getAbsenceNotices({
                organizationId: notificationOrganizationId,
              }),
              getStudents({ organizationId: notificationOrganizationId }),
              getClasses({ organizationId: notificationOrganizationId }),
            ]),
          { hasOrganization: notificationOrganizationId ? 1 : 0 },
        );
      if (!isCurrentRequest()) return;
      setNotifications(notificationPage.items);
      setHasMoreNotifications(notificationPage.hasMore);
      setNotificationOffset(notificationPage.nextOffset);
      setAbsenceNotices(absenceList);
      setStudents(studentList);
      setClasses(classList);
      setSnapshot({ context: requestContextKey, archived });
    } catch {
      if (!isCurrentRequest()) return;
      setLoadError(
        "Tente novamente para consultar a caixa de avisos.",
      );
    } finally {
      if (isCurrentRequest()) {
        setIsLoading(false);
      }
    }
  }, [
    inboxScope,
    notificationOrganizationId,
    noticesContextKey,
    showingArchived,
  ]);

  useEffect(() => {
    let alive = true;
    (async () => {
      await loadNotices();
      if (!alive) return;
      setLoadedNoticesContextKey(noticesContextKey);
    })();
    return () => {
      alive = false;
    };
  }, [loadNotices, noticesContextKey]);

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
  const visibleItems = useMemo(() => sections.flatMap((section) => section.data), [sections]);
  const queueFeedFocus = useCallback((id: string | null, removed: boolean, waitsForReturn = false) => {
    if (Platform.OS !== "web") return;
    const index = visibleItems.findIndex((item) => item.id === id);
    const nextItem = index >= 0 ? visibleItems[index + 1] : undefined;
    const preferredItem = !removed && id ? id : nextItem?.id;
    detailWasOpened.current = false;
    setFocusAfterAction({
      scope: noticesContextKey,
      filter: selectedFilter,
      preferredId: preferredItem ? noticeItemFocusId(preferredItem) : null,
      waitsForReturn,
    });
  }, [noticesContextKey, selectedFilter, visibleItems]);

  useEffect(() => {
    if (Platform.OS !== "web" || !focusAfterAction) return;
    if (!isFocused) {
      detailWasOpened.current = true;
      return;
    }
    if (focusAfterAction.waitsForReturn && !detailWasOpened.current) return;
    if (focusAfterAction.scope !== noticesContextKey || focusAfterAction.filter !== selectedFilter) return;

    const frame = requestAnimationFrame(() => {
      const fallbackIds = [noticeFilterFocusId(selectedFilter), "notice-feed-empty"];
      const focusIds = focusAfterAction.preferredId ? [focusAfterAction.preferredId, ...fallbackIds] : fallbackIds;
      const target = focusIds
        .map((id) => document.getElementById(id))
        .find((element) => element && element.getClientRects().length > 0);
      target?.focus();
      setFocusAfterAction(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [focusAfterAction, isFocused, noticesContextKey, selectedFilter]);

  const filterCounts = useMemo<Record<NoticeFeedFilter, number>>(
    () => ({
      all: feedCandidates.length,
      unread: showingArchived ? 0 : feedCandidates.filter((item) => item.unread).length,
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
  const headerSubtitle = isLoading || switchingArchive ? "Atualizando avisos…" : loadError ? undefined : showingArchived
    ? (notifications.length ? `${notifications.length}${hasMoreNotifications ? "+" : ""} ${
        notifications.length === 1
          ? "notificação arquivada"
          : "notificações arquivadas"
      }` : undefined)
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
      : hasMoreNotifications ? "Há mais avisos para consultar" : undefined;

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
          backgroundColor: colors.successBg,
          color: colors.successText,
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
          backgroundColor: colors.warningBg,
          color: colors.warningText,
        };
      }
      return { backgroundColor: colors.secondaryBg, color: colors.muted };
    },
    [
      colors.muted,
      colors.primaryBg,
      colors.secondaryBg,
      colors.successBg,
      colors.successText,
      colors.warningBg,
      colors.warningText,
    ],
  );

  const markRead = useCallback(async (notification: AppNotification) => {
    if (notification.read) return;
    await markNotificationRead(
      notification.id,
      inboxScope,
      notificationOrganizationId,
    );
    if (noticesContextKeyRef.current !== noticesContextKey) return;
    const readAt = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((item) =>
        item.id === notification.id
          ? { ...item, read: true, readAt: item.readAt ?? readAt }
          : item,
      ),
    );
  }, [inboxScope, noticesContextKey, notificationOrganizationId]);

  const markAllNotificationsAsRead = useCallback(async () => {
    if (isMarkingAllRead || unreadCount === 0) return;
    setIsMarkingAllRead(true);
    setActionError(null);
    setActionFeedback(null);
    try {
      await markAllRead(inboxScope, notificationOrganizationId);
      if (noticesContextKeyRef.current !== noticesContextKey) return;
      const readAt = new Date().toISOString();
      if (!showingArchivedRef.current) {
        setNotifications((current) => current.map((item) => ({
          ...item,
          read: true,
          readAt: item.readAt ?? readAt,
        })));
      }
      setActionFeedback({ scope: noticesContextKey, message: "Avisos marcados como lidos." });
      queueFeedFocus(null, true);
    } catch {
      if (noticesContextKeyRef.current === noticesContextKey) setActionError("Não foi possível marcar os avisos como lidos.");
    } finally {
      setIsMarkingAllRead(false);
    }
  }, [inboxScope, isMarkingAllRead, noticesContextKey, notificationOrganizationId, queueFeedFocus, unreadCount]);

  const loadMoreNotifications = useCallback(async () => {
    if (isLoadingMore || !hasMoreNotifications) return;
    const requestId = ++loadMoreRequestIdRef.current;
    const requestContextKey = noticesContextKey;
    const isCurrentRequest = () =>
      loadMoreRequestIdRef.current === requestId &&
      noticesContextKeyRef.current === requestContextKey;

    setIsLoadingMore(true);
    setActionError(null);
    try {
      const page = await getNotificationsPage({
        inboxScope,
        organizationId: notificationOrganizationId,
        limit: NOTIFICATIONS_PAGE_SIZE,
        offset: notificationOffset,
        archiveScope: showingArchived ? "archived" : "active",
        throwOnError: true,
      });
      if (!isCurrentRequest()) return;
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
      if (!isCurrentRequest()) return;
      setActionError("Não foi possível carregar mais avisos.");
    } finally {
      if (isCurrentRequest()) {
        setIsLoadingMore(false);
      }
    }
  }, [
    hasMoreNotifications,
    inboxScope,
    isLoadingMore,
    notificationOrganizationId,
    notificationOffset,
    noticesContextKey,
    showingArchived,
  ]);

  const requestArchiveReadNotifications = useCallback(() => {
    if (isArchivingRead || readActiveCount === 0) return;
    void confirmDialog({
      title: "Arquivar avisos lidos?",
      message: "Os avisos lidos podem ser recuperados no filtro Arquivados.",
      confirmLabel: "Arquivar lidos",
      cancelLabel: "Cancelar",
      onConfirm: async () => {
        if (noticesContextKeyRef.current !== noticesContextKey) return;
        setIsArchivingRead(true);
        setActionError(null);
        setActionFeedback(null);
        try {
          await archiveRead(inboxScope, notificationOrganizationId);
          if (noticesContextKeyRef.current !== noticesContextKey) return;
          await loadNotices(showingArchivedRef.current);
          if (noticesContextKeyRef.current !== noticesContextKey) return;
          setActionFeedback({ scope: noticesContextKey, message: "Avisos lidos movidos para Arquivados." });
          queueFeedFocus(null, true);
        } catch {
          if (noticesContextKeyRef.current === noticesContextKey) setActionError("Não foi possível arquivar os avisos lidos.");
        } finally {
          setIsArchivingRead(false);
        }
      },
    });
  }, [
    confirmDialog,
    inboxScope,
    isArchivingRead,
    loadNotices,
    noticesContextKey,
    notificationOrganizationId,
    queueFeedFocus,
    readActiveCount,
  ]);

  const restoreArchivedNotification = useCallback(
    async (notificationId: string) => {
      if (restoringId) return;
      setRestoringId(notificationId);
      setActionError(null);
      setActionFeedback(null);
      try {
        await restoreNotification(
          notificationId,
          inboxScope,
          notificationOrganizationId,
        );
        if (noticesContextKeyRef.current !== noticesContextKey) return;
        if (showingArchivedRef.current) {
          setNotifications((current) => current.filter((item) => item.id !== notificationId));
        }
        await loadNotices(showingArchivedRef.current);
        if (noticesContextKeyRef.current !== noticesContextKey) return;
        setActionFeedback({ scope: noticesContextKey, message: "Aviso restaurado na lista principal." });
        queueFeedFocus(notificationId, true);
      } catch {
        if (noticesContextKeyRef.current === noticesContextKey) setActionError("Não foi possível restaurar este aviso.");
      } finally {
        setRestoringId(null);
      }
    },
    [inboxScope, loadNotices, noticesContextKey, notificationOrganizationId, queueFeedFocus, restoringId],
  );

  const openNotification = useCallback(
    async (notification: AppNotification) => {
      setActionError(null);
      try {
        await markRead(notification);
        if (noticesContextKeyRef.current !== noticesContextKey) return;
        queueFeedFocus(notification.id, selectedFilter === "unread" && !notification.read, Boolean(notification.actionUrl));
        if (notification.actionUrl) router.push(notification.actionUrl as never);
      } catch {
        if (noticesContextKeyRef.current === noticesContextKey) {
          setActionError("Não foi possível abrir este aviso. Tente novamente.");
        }
      }
    },
    [markRead, noticesContextKey, queueFeedFocus, router, selectedFilter],
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
        if (noticesContextKeyRef.current !== noticesContextKey) return;
        setAbsenceNotices((prev) =>
          prev.map((item) =>
            item.id === notice.id ? { ...item, status } : item,
          ),
        );
        if (notification) {
          await markRead(notification);
        }
        if (noticesContextKeyRef.current !== noticesContextKey) return;
        queueFeedFocus(notification?.id ?? `absence-${notice.id}`, selectedFilter === "unread");
      } catch {
        if (noticesContextKeyRef.current === noticesContextKey) setActionError("Não foi possível atualizar este aviso de ausência.");
      } finally {
        setUpdatingId(null);
      }
    },
    [markRead, noticesContextKey, queueFeedFocus, selectedFilter],
  );

  const selectFilter = (filter: NoticeFeedFilter) => {
    if ((filter === "archived") !== showingArchived) {
      showingArchivedRef.current = filter === "archived";
      setLoadError(null);
      loadNoticesRequestIdRef.current += 1;
      loadMoreRequestIdRef.current += 1;
    }
    setSelectedFilter(filter);
    setFocusAfterAction(null);
    setActionError(null);
    setActionFeedback(null);
  };

  if (loadedNoticesContextKey !== noticesContextKey) {
    return <FullscreenLoadingState overlay />;
  }

  return (
    <SafeAreaView nativeID="notice-center" style={{ flex: 1, backgroundColor: colors.background }}>
      {Platform.OS === "web" ? (
        <style>{`
          #notice-center :is(button, [role="button"], [tabindex="-1"]):focus-visible {
            outline: ${borders.focus}px solid ${colors.text};
            outline-offset: ${borders.focus}px;
          }
        `}</style>
      ) : null}
      <ResponsivePage style={{ flex: 1 }} gap={0}>
        <ScreenPageHeader
          title="Avisos"
          subtitle={headerSubtitle}
          horizontalBleed={0}
          contentStyle={{ paddingHorizontal: 0, paddingBottom: spacing.xs }}
          onBack={() =>
            navigateBackOrReplace({ router, fallback: fallbackRoute })
          }
        />

        <View
          style={{
            flex: 1,
            minWidth: 0,
            gap: responsive.density.sectionGap,
            paddingBottom: spacing.sm,
          }}
        >
          <View style={{ gap: 4 }}>
            <UnderlineTabs accessibilityLabel="Caixa de avisos"
              value={selectedFilter === "unread" || selectedFilter === "archived" ? selectedFilter : "all"}
              items={(["all", "unread", "archived"] as const).map((filter) => ({ value: filter,
                id: noticeFilterFocusId(filter), label: filter === "unread" && unreadCount > 0 && !showingArchived ? `Não lidos · ${unreadCount}${hasMoreNotifications ? "+" : ""}` : filterLabels[filter] }))}
              onChange={(filter) => selectFilter(filter as NoticeFeedFilter)} />
            <CompactSelect label="Tipo" value={["absence", "birthday", "other"].includes(selectedFilter) ? selectedFilter : "all"}
              nativeID={["absence", "birthday", "other"].includes(selectedFilter) ? noticeFilterFocusId(selectedFilter) : "notice-type-filter"}
              options={(["all", "absence", "birthday", "other"] as const).map((value) => ({ value, label: filterLabels[value] }))}
              onChange={(filter) => selectFilter(filter as NoticeFeedFilter)} />
          </View>

          {!isLoading && !switchingArchive && !loadError && !showingArchived && (unreadCount > 0 || readActiveCount > 0) ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
              {unreadCount > 0 ? (
                <Button label="Marcar todos como lidos" variant="secondary" loading={isMarkingAllRead} onPress={() => void markAllNotificationsAsRead()} />
              ) : null}
              {readActiveCount > 0 ? (
                <Button label="Arquivar lidos" variant="ghost" loading={isArchivingRead} onPress={requestArchiveReadNotifications} />
              ) : null}
            </View>
          ) : null}
          {actionFeedback?.scope === noticesContextKey ? (
            <Text role="status" accessibilityLiveRegion="polite" style={{ color: colors.successText }}>
              {actionFeedback.message}
            </Text>
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
              <View accessibilityRole="alert" style={{ gap: 4 }}>
                <Text style={{ color: colors.text, fontWeight: "700" }}>
                  {hasVisibleSnapshot ? "Não foi possível atualizar os avisos" : "Avisos indisponíveis"}
                </Text>
                <Text style={{ color: colors.muted }}>
                  {hasVisibleSnapshot ? "Mostrando os avisos da última consulta." : loadError}
                </Text>
              </View>
              <View style={{ alignSelf: "flex-start" }}>
                <Button label="Tentar novamente" variant="secondary" onPress={() => void loadNotices()} />
              </View>
            </View>
          ) : null}
          {switchingArchive || (isLoading && !hasVisibleSnapshot) ? (
            <SectionLoadingState />
          ) : hasVisibleSnapshot ? (
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
                  nativeID="notice-feed-empty"
                  tabIndex={-1}
                  style={{ width: "100%" }}
                >
                  <ListEmptyState
                    title={hasMoreNotifications ? "Sem resultados nos avisos carregados" : emptyFilterLabels[selectedFilter]}
                    description={selectedFilter === "archived" ? "Os avisos arquivados ficam aqui para consulta." : selectedFilter === "all" ? "Novos avisos da sua instituição aparecerão aqui." : "Os outros avisos continuam na caixa de entrada."}
                    actionLabel="Ver todos os avisos"
                    onAction={selectedFilter !== "all" ? () => selectFilter("all") : undefined}
                  />
                </View>
              }
              ListFooterComponent={
                hasMoreNotifications && !loadError && !isLoading ? (
                  <View
                    style={{
                      paddingTop: spacing.md,
                      alignItems: "center",
                      justifyContent: "center",
                      gap: spacing.xs,
                    }}
                  >
                    <Button label="Carregar mais avisos" variant="secondary" loading={isLoadingMore} onPress={() => void loadMoreNotifications()} />
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
                    accessibilityRole="header"
                    style={{
                      color: colors.text,
                      fontSize: compactUiMetrics.bodyFontSize,
                      fontWeight: "700",
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
                  (notice ? getStudentName(notice.studentId) : "Notificação");
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
                    : "Notificação";
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

                const isInteractive = notification && (Boolean(notification.actionUrl) || unread);
                const itemFocusId = noticeItemFocusId(item.id);
                const focusableContent = <>
                  <View style={{ width: 32, height: 32, borderRadius: radius.internal, backgroundColor: iconBackground, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <GoAtletaIcon name={iconName} size={compactUiMetrics.iconSize} color={iconColor} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 6, rowGap: 4 }}>
                      {unread ? <View aria-hidden={true} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primaryBg }} /> : null}
                      <Text style={{ flexShrink: 1, color: colors.text, fontSize: responsive.density.cardTitleFontSize, fontWeight: "700" }}>{title}</Text>
                      {notice && statusColors ? (
                        <View style={{ borderRadius: radius.full, paddingHorizontal: spacing.xs, paddingVertical: 3, backgroundColor: statusColors.backgroundColor }}>
                          <Text style={{ color: statusColors.color, fontSize: responsive.density.metadataFontSize, fontWeight: "700" }}>{statusLabels[notice.status]}</Text>
                        </View>
                      ) : null}
                    </View>
                    {body ? <Text style={{ color: colors.textSecondary, lineHeight: compactUiMetrics.bodyLineHeight }}>{body}</Text> : null}
                    {contextLabel ? <Text style={{ color: colors.muted, fontSize: responsive.density.metadataFontSize }}>{contextLabel}</Text> : null}
                    <Text style={{ color: colors.muted, fontSize: responsive.density.metadataFontSize }}>
                      {typeLabel}{notification ? ` · ${formatTime(notification.createdAt)}` : ""}
                    </Text>
                  </View>
                  {notification?.actionUrl ? <GoAtletaIcon name="chevronForward" size={compactUiMetrics.iconSize} color={colors.muted} style={{ marginTop: 8 }} /> : null}
                </>;
                const itemLayout = { flexDirection: "row", alignItems: "flex-start", minHeight: compactUiMetrics.touchTarget, gap: spacing.xs } as const;
                const itemLabel = [title, unread ? "Não lido" : null, body, contextLabel, notice ? statusLabels[notice.status] : null].filter(Boolean).join(". ");
                const actionButtonStyle = {
                  minHeight: compactUiMetrics.touchTarget,
                  paddingHorizontal: spacing.sm,
                  borderRadius: radius.internal,
                  alignItems: "center",
                  justifyContent: "center",
                } as const;

                return (
                  <View style={{
                    padding: responsive.density.cardPadding,
                    backgroundColor: unread ? colors.surfaceElevated : colors.card,
                    borderWidth: 1,
                    borderBottomWidth: last ? 1 : 0,
                    borderColor: colors.border,
                    borderTopLeftRadius: first ? radius.container : 0,
                    borderTopRightRadius: first ? radius.container : 0,
                    borderBottomLeftRadius: last ? radius.container : 0,
                    borderBottomRightRadius: last ? radius.container : 0,
                  }}>
                    {isInteractive ? (
                      <Pressable
                        nativeID={itemFocusId}
                        accessibilityRole="button"
                        accessibilityLabel={itemLabel}
                        accessibilityHint={notification.actionUrl ? "Abre os detalhes do aviso" : "Marca este aviso como lido"}
                        onPress={() => void openNotification(notification)}
                        style={[itemLayout, { borderRadius: radius.sm }]}
                      >
                        {focusableContent}
                      </Pressable>
                    ) : (
                      <View nativeID={itemFocusId} tabIndex={-1} style={itemLayout}>
                        {focusableContent}
                      </View>
                    )}
                    {notice && isPending ? (
                      <View style={{ flexDirection: "row", flexWrap: "wrap", marginLeft: 40, marginTop: spacing.xs, gap: spacing.xs }}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Confirmar ausência de ${getStudentName(notice.studentId)}`}
                          accessibilityState={{ busy: isUpdating }}
                          onPress={() => void updateStatus(notice, "confirmed", notification)}
                          disabled={isUpdating}
                          style={[actionButtonStyle, { backgroundColor: isUpdating ? colors.primaryDisabledBg : colors.primaryBg }]}
                        >
                          <Text style={{ color: colors.primaryText, fontWeight: "700" }}>Confirmar</Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Ignorar ausência de ${getStudentName(notice.studentId)}`}
                          accessibilityState={{ busy: isUpdating }}
                          onPress={() => void updateStatus(notice, "ignored", notification)}
                          disabled={isUpdating}
                          style={[actionButtonStyle, { backgroundColor: colors.secondaryBg, borderWidth: 1, borderColor: colors.border, opacity: isUpdating ? 0.6 : 1 }]}
                        >
                          <Text style={{ color: colors.text, fontWeight: "700" }}>Ignorar</Text>
                        </Pressable>
                      </View>
                    ) : showingArchived && notification ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Restaurar aviso ${title}`}
                        accessibilityState={{ busy: restoringId === notification.id }}
                        disabled={restoringId === notification.id}
                        onPress={() => void restoreArchivedNotification(notification.id)}
                        style={[actionButtonStyle, { alignSelf: "flex-start", flexDirection: "row", marginTop: spacing.xs, marginLeft: 40, gap: spacing.xs, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondaryBg }]}
                      >
                        <GoAtletaIcon name="restore" size={compactUiMetrics.iconSize} color={colors.text} />
                        <Text style={{ color: colors.text, fontWeight: "700" }}>Restaurar</Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              }}
            />
          ) : null}
        </View>
      </ResponsivePage>
    </SafeAreaView>
  );
}

export default function AbsenceNoticesScreen() {
  return <NotificationsCenterScreen />;
}
