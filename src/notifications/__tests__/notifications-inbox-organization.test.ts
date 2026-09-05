import {
  addNotification,
  archiveRead,
  clearNotifications,
  getNotifications,
  getNotificationsPage,
  getUnreadCount,
  markAllRead,
  markNotificationRead,
  restoreNotification,
  subscribeNotifications,
} from "../../notificationsInbox";

const mockArchiveReadNotifications = jest.fn();
const mockClearMyNotifications = jest.fn();
const mockCreateNotification = jest.fn();
const mockGetUnreadNotificationCount = jest.fn();
const mockListNotifications = jest.fn();
const mockMarkAllNotificationsRead = jest.fn();
const mockMarkNotificationRead = jest.fn();
const mockRestoreNotification = jest.fn();

jest.mock("../../api/notifications", () => ({
  archiveReadNotifications: (...args: unknown[]) =>
    mockArchiveReadNotifications(...args),
  clearMyNotifications: (...args: unknown[]) => mockClearMyNotifications(...args),
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
  getUnreadNotificationCount: (...args: unknown[]) =>
    mockGetUnreadNotificationCount(...args),
  listNotifications: (...args: unknown[]) => mockListNotifications(...args),
  markAllNotificationsRead: (...args: unknown[]) =>
    mockMarkAllNotificationsRead(...args),
  markNotificationRead: (...args: unknown[]) => mockMarkNotificationRead(...args),
  restoreNotification: (...args: unknown[]) => mockRestoreNotification(...args),
}));

describe("notifications inbox organization propagation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateNotification.mockResolvedValue(null);
    mockListNotifications.mockResolvedValue([]);
    mockGetUnreadNotificationCount.mockResolvedValue(0);
  });

  test("forwards the explicit student organization to reads and pagination", async () => {
    await getNotifications("student", "org-student");
    await getNotificationsPage({
      inboxScope: "student",
      organizationId: "org-student",
      limit: 20,
    });

    expect(mockListNotifications).toHaveBeenNthCalledWith(1, {
      inboxScope: "student",
      organizationId: "org-student",
    });
    expect(mockListNotifications).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        inboxScope: "student",
        organizationId: "org-student",
      }),
    );
  });

  test("forwards the explicit student organization to mutations and unread count", async () => {
    await markAllRead("student", "org-student");
    await markNotificationRead("notification-1", "student", "org-student");
    await archiveRead("student", "org-student");
    await restoreNotification("notification-1", "student", "org-student");
    await getUnreadCount("student", "org-student");

    expect(mockMarkAllNotificationsRead).toHaveBeenCalledWith(
      "student",
      "org-student",
    );
    expect(mockMarkNotificationRead).toHaveBeenCalledWith("notification-1");
    expect(mockArchiveReadNotifications).toHaveBeenCalledWith(
      "student",
      "org-student",
    );
    expect(mockRestoreNotification).toHaveBeenCalledWith(
      "notification-1",
      "org-student",
    );
    expect(mockGetUnreadNotificationCount).toHaveBeenCalledWith(
      "student",
      "org-student",
    );
    expect(mockListNotifications).toHaveBeenCalledTimes(4);
    expect(mockListNotifications).toHaveBeenCalledWith({
      inboxScope: "student",
      organizationId: "org-student",
    });
  });

  test("emits only to subscribers with the same inbox scope and organization", async () => {
    const profOrgA = jest.fn();
    const profOrgB = jest.fn();
    const studentOrgB = jest.fn();
    const unsubscribeProfOrgA = subscribeNotifications(
      profOrgA,
      "prof",
      "org-a",
    );
    const unsubscribeProfOrgB = subscribeNotifications(
      profOrgB,
      "prof",
      "org-b",
    );
    const unsubscribeStudentOrgB = subscribeNotifications(
      studentOrgB,
      "student",
      "org-b",
    );

    try {
      await clearNotifications("prof", "org-a");

      expect(profOrgA).toHaveBeenCalledWith([]);
      expect(profOrgB).not.toHaveBeenCalled();
      expect(studentOrgB).not.toHaveBeenCalled();

      await clearNotifications("student", "org-b");

      expect(profOrgA).toHaveBeenCalledTimes(1);
      expect(profOrgB).not.toHaveBeenCalled();
      expect(studentOrgB).toHaveBeenCalledWith([]);
    } finally {
      unsubscribeProfOrgA();
      unsubscribeProfOrgB();
      unsubscribeStudentOrgB();
    }
  });

  test("uses the created notification organization when add omits it", async () => {
    const studentOrgA = jest.fn();
    const studentOrgB = jest.fn();
    const createdNotification = {
      id: "notification-a",
      organizationId: "org-a",
      title: "Treino criado",
      body: "Seu treino está disponível.",
    };
    mockCreateNotification.mockResolvedValue(createdNotification);
    mockListNotifications.mockResolvedValue([createdNotification]);
    const unsubscribeStudentOrgA = subscribeNotifications(
      studentOrgA,
      "student",
      "org-a",
    );
    const unsubscribeStudentOrgB = subscribeNotifications(
      studentOrgB,
      "student",
      "org-b",
    );

    try {
      await addNotification("Treino criado", "Seu treino está disponível.", {
        inboxScope: "student",
      });

      expect(mockListNotifications).toHaveBeenCalledWith({
        inboxScope: "student",
        organizationId: "org-a",
      });
      expect(studentOrgA).toHaveBeenCalledWith([createdNotification]);
      expect(studentOrgB).not.toHaveBeenCalled();
    } finally {
      unsubscribeStudentOrgA();
      unsubscribeStudentOrgB();
    }
  });

  test("refetches prof and student subscribers for an all-scope event in the same organization", async () => {
    const profOrgA = jest.fn();
    const studentOrgA = jest.fn();
    const profOrgB = jest.fn();
    mockCreateNotification.mockResolvedValue({
      id: "notification-all",
      organizationId: "org-a",
      title: "Aviso geral",
      body: "Atualização para todos.",
    });
    mockListNotifications.mockImplementation(
      ({ inboxScope, organizationId }: { inboxScope: string; organizationId: string }) =>
        Promise.resolve([
          {
            id: `${inboxScope}-${organizationId}`,
            organizationId,
            inboxScope,
            title: `Aviso ${inboxScope}`,
            body: "Atualização para todos.",
          },
        ]),
    );
    const unsubscribeProfOrgA = subscribeNotifications(profOrgA, "prof", "org-a");
    const unsubscribeStudentOrgA = subscribeNotifications(
      studentOrgA,
      "student",
      "org-a",
    );
    const unsubscribeProfOrgB = subscribeNotifications(profOrgB, "prof", "org-b");

    try {
      await addNotification("Aviso geral", "Atualização para todos.", {
        inboxScope: "all",
        organizationId: "org-a",
      });

      expect(mockListNotifications).toHaveBeenCalledWith({
        inboxScope: "prof",
        organizationId: "org-a",
      });
      expect(mockListNotifications).toHaveBeenCalledWith({
        inboxScope: "student",
        organizationId: "org-a",
      });
      expect(profOrgA).toHaveBeenCalledWith([
        expect.objectContaining({ id: "prof-org-a" }),
      ]);
      expect(studentOrgA).toHaveBeenCalledWith([
        expect.objectContaining({ id: "student-org-a" }),
      ]);
      expect(profOrgB).not.toHaveBeenCalled();
    } finally {
      unsubscribeProfOrgA();
      unsubscribeStudentOrgA();
      unsubscribeProfOrgB();
    }
  });
});
