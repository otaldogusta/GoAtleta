import {
  clearMyNotifications,
  createNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../notifications";

const mockGetSessionUserId = jest.fn();
const mockGetValidAccessToken = jest.fn();
const mockGetActiveOrganizationId = jest.fn();
const mockRestGet = jest.fn();
const mockRestPost = jest.fn();
const mockRestPatch = jest.fn();
const mockRestDelete = jest.fn();
const mockSendPushToUser = jest.fn();
const mockFetch = jest.fn();

jest.mock("../../auth/session", () => ({
  getSessionUserId: () => mockGetSessionUserId(),
  getValidAccessToken: () => mockGetValidAccessToken(),
}));

jest.mock("../../db/client", () => ({
  getActiveOrganizationId: () => mockGetActiveOrganizationId(),
}));

jest.mock("../rest", () => ({
  supabaseRestGet: (...args: unknown[]) => mockRestGet(...args),
  supabaseRestPost: (...args: unknown[]) => mockRestPost(...args),
  supabaseRestPatch: (...args: unknown[]) => mockRestPatch(...args),
  supabaseRestDelete: (...args: unknown[]) => mockRestDelete(...args),
}));

jest.mock("../push", () => ({
  sendPushToUser: (...args: unknown[]) => mockSendPushToUser(...args),
}));

jest.mock("../config", () => ({
  SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_URL: "https://example.supabase.co",
}));

describe("notifications api", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSessionUserId.mockResolvedValue("user-1");
    mockGetValidAccessToken.mockResolvedValue("access-token");
    mockGetActiveOrganizationId.mockResolvedValue("org-1");
    global.fetch = mockFetch as typeof fetch;
  });

  test("lists notifications from the current org and user", async () => {
    mockRestGet.mockResolvedValue([
      {
        id: "n-1",
        organization_id: "org-1",
        recipient_user_id: "user-1",
        actor_user_id: null,
        type: "training_saved",
        title: "Treino salvo",
        body: "Treino salvo com sucesso.",
        action_url: "/training",
        source_type: "training",
        source_id: null,
        metadata: {},
        read_at: null,
        created_at: "2026-07-06T12:00:00.000Z",
      },
    ]);

    const items = await listNotifications();

    expect(items).toEqual([
      expect.objectContaining({
        id: "n-1",
        organizationId: "org-1",
        recipientUserId: "user-1",
        actionUrl: "/training",
        read: false,
      }),
    ]);
    expect(mockRestGet).toHaveBeenCalledWith(
      expect.stringContaining("/notifications?select=")
    );
  });

  test("creates own notification through Data API", async () => {
    mockRestPost.mockResolvedValue([
      {
        id: "n-2",
        organization_id: "org-1",
        recipient_user_id: "user-1",
        actor_user_id: "user-1",
        type: "birthday",
        title: "Aniversariantes do dia",
        body: "Aniversariantes de hoje: Ana.",
        action_url: "/students/birthdays",
        source_type: "birthdays",
        source_id: null,
        metadata: { total: 1 },
        read_at: null,
        created_at: "2026-07-06T12:00:00.000Z",
      },
    ]);

    const created = await createNotification({
      type: "birthday",
      title: "Aniversariantes do dia",
      body: "Aniversariantes de hoje: Ana.",
      actionUrl: "/students/birthdays",
      metadata: { total: 1 },
    });

    expect(created?.id).toBe("n-2");
    expect(mockRestPost).toHaveBeenCalledWith(
      "/notifications",
      expect.arrayContaining([
        expect.objectContaining({
          organization_id: "org-1",
          recipient_user_id: "user-1",
          type: "birthday",
        }),
      ])
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("creates cross-user notification through Edge Function", async () => {
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          notification: {
            id: "n-3",
            organization_id: "org-1",
            recipient_user_id: "user-2",
            actor_user_id: "user-1",
            type: "consultation_event",
            title: "Treino publicado",
            body: "Seu treino já está disponível.",
            action_url: "/student-consultation",
            source_type: "consultation",
            source_id: "event-1",
            metadata: {},
            read_at: null,
            created_at: "2026-07-06T12:00:00.000Z",
          },
        }),
        { status: 200 }
      )
    );

    const created = await createNotification({
      organizationId: "org-1",
      recipientUserId: "user-2",
      type: "consultation_event",
      title: "Treino publicado",
      body: "Seu treino já está disponível.",
      actionUrl: "/student-consultation",
      sourceType: "consultation",
      sourceId: "event-1",
    });

    expect(created?.recipientUserId).toBe("user-2");
    expect(mockRestPost).not.toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.supabase.co/functions/v1/create-notification",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
          apikey: "anon-key",
        }),
      })
    );
  });

  test("deduplicates own notification by recipient, type and source", async () => {
    mockRestGet.mockResolvedValue([
      {
        id: "n-existing",
        organization_id: "org-1",
        recipient_user_id: "user-1",
        actor_user_id: "user-1",
        type: "absence_notice_created",
        title: "Novo aviso de ausência",
        body: "Aluno avisou ausência.",
        action_url: "/prof/absence-notices",
        source_type: "absence_notice",
        source_id: "notice-1",
        metadata: {},
        read_at: null,
        created_at: "2026-07-06T12:00:00.000Z",
      },
    ]);

    const created = await createNotification({
      type: "absence_notice_created",
      title: "Novo aviso de ausência",
      body: "Aluno avisou ausência.",
      actionUrl: "/prof/absence-notices",
      sourceType: "absence_notice",
      sourceId: "notice-1",
      dedupe: true,
    });

    expect(created?.id).toBe("n-existing");
    expect(mockRestGet).toHaveBeenCalledWith(
      expect.stringContaining("source_id=eq.notice-1")
    );
    expect(mockRestPost).not.toHaveBeenCalled();
    expect(mockSendPushToUser).not.toHaveBeenCalled();
  });

  test("keeps notification creation successful when push delivery fails", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({
        created: true,
        notification: {
        id: "n-push",
        organization_id: "org-1",
        recipient_user_id: "user-2",
        actor_user_id: "user-1",
        type: "absence_notice_created",
        title: "Novo aviso de ausência",
        body: "Aluno avisou ausência.",
        action_url: "/prof/absence-notices",
        source_type: "absence_notice",
        source_id: "notice-1",
        metadata: {},
        read_at: null,
        created_at: "2026-07-06T12:00:00.000Z",
        },
      }), { status: 200 })
    );
    mockSendPushToUser.mockRejectedValue(new Error("no tokens"));

    const created = await createNotification({
      type: "absence_notice_created",
      recipientUserId: "user-2",
      title: "Novo aviso de ausência",
      body: "Aluno avisou ausência.",
      actionUrl: "/prof/absence-notices",
      sourceType: "absence_notice",
      sourceId: "notice-1",
      sendPush: true,
    });

    expect(created?.id).toBe("n-push");
    expect(mockSendPushToUser).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        targetUserId: "user-2",
        title: "Novo aviso de ausência",
        data: {
          route: "/prof/absence-notices",
          params: {
            sourceType: "absence_notice",
            sourceId: "notice-1",
          },
        },
      })
    );
  });

  test("never sends push implicitly to the current user", async () => {
    mockRestPost.mockResolvedValue([
      {
        id: "n-own",
        organization_id: "org-1",
        recipient_user_id: "user-1",
        actor_user_id: "user-1",
        type: "generic",
        title: "Aviso",
        body: "Mensagem interna.",
        action_url: null,
        source_type: null,
        source_id: null,
        metadata: {},
        read_at: null,
        created_at: "2026-07-06T12:00:00.000Z",
      },
    ]);

    await createNotification({ title: "Aviso", body: "Mensagem interna.", sendPush: true });

    expect(mockRestPost).toHaveBeenCalled();
    expect(mockSendPushToUser).not.toHaveBeenCalled();
  });

  test("does not resend push when the Edge Function deduplicates a notification", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({
        created: false,
        notification: {
          id: "n-existing",
          organization_id: "org-1",
          recipient_user_id: "user-2",
          actor_user_id: "user-1",
          type: "absence_notice_created",
          title: "Novo aviso de ausência",
          body: "Aluno avisou ausência.",
          action_url: "/prof/absence-notices",
          source_type: "absence_notice",
          source_id: "notice-1",
          metadata: {},
          read_at: null,
          created_at: "2026-07-06T12:00:00.000Z",
        },
      }), { status: 200 })
    );

    const notification = await createNotification({
      recipientUserId: "user-2",
      type: "absence_notice_created",
      title: "Novo aviso de ausência",
      body: "Aluno avisou ausência.",
      sourceType: "absence_notice",
      sourceId: "notice-1",
      sendPush: true,
      dedupe: true,
    });

    expect(notification?.id).toBe("n-existing");
    expect(mockSendPushToUser).not.toHaveBeenCalled();
  });

  test("marks and clears only current user's notifications through scoped filters", async () => {
    await markNotificationRead("n-1");
    await markAllNotificationsRead();
    await clearMyNotifications();

    expect(mockRestPatch).toHaveBeenNthCalledWith(
      1,
      "/notifications?id=eq.n-1",
      expect.objectContaining({ read_at: expect.any(String) }),
      "return=minimal"
    );
    expect(mockRestPatch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("recipient_user_id=eq.user-1"),
      expect.objectContaining({ read_at: expect.any(String) }),
      "return=minimal"
    );
    expect(mockRestDelete).toHaveBeenCalledWith(
      expect.stringContaining("recipient_user_id=eq.user-1"),
      "return=minimal"
    );
  });

  test("treats missing notifications table as empty/no-op until migration is applied", async () => {
    const missingTableError = new Error(
      '{"code":"PGRST205","message":"Could not find the table \'public.notifications\' in the schema cache"}'
    );
    mockRestGet.mockRejectedValue(missingTableError);
    mockRestPatch.mockRejectedValue(missingTableError);
    mockRestDelete.mockRejectedValue(missingTableError);
    mockRestPost.mockRejectedValue(missingTableError);

    await expect(listNotifications()).resolves.toEqual([]);
    await expect(markNotificationRead("n-1")).resolves.toBeUndefined();
    await expect(markAllNotificationsRead()).resolves.toBeUndefined();
    await expect(clearMyNotifications()).resolves.toBeUndefined();
    await expect(
      createNotification({
        title: "Treino salvo",
        body: "Treino salvo com sucesso.",
      })
    ).resolves.toBeNull();
  });
});
