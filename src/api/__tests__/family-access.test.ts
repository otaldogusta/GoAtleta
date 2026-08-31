import {
  FamilyAccessRequestError,
  getMyFamilyFinance,
  isFamilyFoundationUnavailable,
  mapFamilyFinanceData,
  mapFamilyOverviews,
  mapFamilyStudentContexts,
} from "../family-access";

jest.mock("../config", () => ({
  SUPABASE_ANON_KEY: "test-key",
  SUPABASE_URL: "https://example.supabase.co",
}));

jest.mock("../../auth/session", () => ({
  getValidAccessToken: jest.fn().mockResolvedValue("valid-token"),
}));

describe("family access mapping", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("maps the real relationship fields and fails closed for missing permissions", () => {
    expect(
      mapFamilyStudentContexts([
        {
          relationship_id: "rel-1",
          relationship_kind: "guardian",
          organization_id: "org-1",
          organization_name: "Rede Esporte",
          student_id: "student-1",
          student_name: "Ana",
          can_view_schedule: true,
          can_view_financial: true,
          can_pay: true,
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        relationshipId: "rel-1",
        relationshipType: "guardian",
        studentId: "student-1",
        canViewAgenda: true,
        canViewAttendance: false,
        canViewProgress: false,
        canViewFinance: true,
        canPay: true,
      }),
    ]);
  });

  it("discards rows without a server relationship id", () => {
    expect(
      mapFamilyStudentContexts([
        { organization_id: "org-1", student_id: "student-1" },
      ]),
    ).toEqual([]);
  });

  it("maps schedule, attendance and the honest progress-unavailable reason", () => {
    const overviews = mapFamilyOverviews([
      {
        relationship_id: "rel-1",
        organization_id: "org-1",
        organization_name: "Rede Esporte",
        student_id: "student-1",
        student_name: "Ana",
        can_view_schedule: true,
        can_view_attendance: true,
        can_view_progress: true,
        next_schedule: [
          {
            session_id: "session-1",
            class_id: "class-1",
            class_name: "Vôlei",
            starts_at: "2026-09-01T18:00:00Z",
            ends_at: "2026-09-01T19:00:00Z",
            session_type: "training",
          },
        ],
        attendance_summary: {
          available: true,
          total: 4,
          present: 3,
          absent: 1,
          attendance_rate_percent: 75,
          history: [{ date: "2026-08-30", status: "present" }],
        },
        progress_summary: {
          available: false,
          reason: "progress_semantics_not_modeled_yet",
        },
      },
    ]);

    expect(overviews[0]).toMatchObject({
      relationshipId: "rel-1",
      nextSchedule: [{ id: "session-1", className: "Vôlei" }],
      attendance: {
        available: true,
        total: 4,
        present: 3,
        attendanceRatePercent: 75,
      },
      progress: {
        available: false,
        reason: "progress_semantics_not_modeled_yet",
      },
    });
  });

  it("filters finance rows by relationship and never fabricates invoices", () => {
    const data = mapFamilyFinanceData(
      [
        {
          relationship_id: "rel-1",
          invoice_id: "invoice-1",
          competence_month: "2026-08-01",
          due_date: "2026-08-10",
          amount_cents: 12000,
          paid_cents: 2000,
          status: "overdue",
          description: "Mensalidade agosto",
          payment_url: "javascript:alert(1)",
        },
        {
          relationship_id: "rel-1",
          invoice_id: null,
        },
        {
          relationship_id: "rel-2",
          invoice_id: "invoice-2",
          amount_cents: 8000,
          status: "open",
        },
      ],
      "rel-1",
    );

    expect(data.invoices).toEqual([
      expect.objectContaining({
        id: "invoice-1",
        reference: "2026-08-01",
        amountMinor: 12000,
        paidAmountMinor: 2000,
        outstandingAmountMinor: 10000,
        status: "overdue",
        paymentUrl: null,
      }),
    ]);
    expect(data.summary).toMatchObject({
      openAmountMinor: 10000,
      overdueAmountMinor: 10000,
      paidAmountMinor: 2000,
      openCount: 1,
      overdueCount: 1,
    });
  });

  it("maps void and refunded invoices to a non-payable terminal status", () => {
    const data = mapFamilyFinanceData([
      { invoice_id: "void-1", amount_cents: 1000, status: "void" },
      { invoice_id: "refund-1", amount_cents: 2000, status: "refunded" },
    ]);

    expect(data.invoices.map((invoice) => invoice.status)).toEqual([
      "cancelled",
      "cancelled",
    ]);
    expect(data.summary.openAmountMinor).toBe(0);
  });

  it("calls the family finance RPC without unsupported parameters", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "[]",
    } as Response);

    await getMyFamilyFinance("rel-1", "valid-token");

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://example.supabase.co/rest/v1/rpc/get_my_family_finance_v1",
      expect.objectContaining({ body: "{}" }),
    );
  });

  it("recognizes an unavailable relationship foundation without hiding other errors", () => {
    expect(
      isFamilyFoundationUnavailable(
        new FamilyAccessRequestError(
          '{"code":"PGRST202","message":"Could not find get_my_student_contexts_v1"}',
          404,
          "get_my_student_contexts_v1",
        ),
      ),
    ).toBe(true);
    expect(
      isFamilyFoundationUnavailable(
        new FamilyAccessRequestError(
          "Unauthorized",
          401,
          "get_my_student_contexts_v1",
        ),
      ),
    ).toBe(false);
    expect(
      isFamilyFoundationUnavailable(
        new FamilyAccessRequestError(
          "Not found",
          404,
          "get_my_student_contexts_v1",
        ),
      ),
    ).toBe(false);
    expect(
      isFamilyFoundationUnavailable(
        new FamilyAccessRequestError(
          "Service unavailable",
          503,
          "get_my_student_contexts_v1",
        ),
      ),
    ).toBe(false);
  });
});
