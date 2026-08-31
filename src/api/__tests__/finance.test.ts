import {
  createTuitionPlan,
  getOrganizationFinanceDashboard,
  issueTuitionInvoice,
  listOrganizationInvoices,
  listTuitionAgreements,
  listTuitionPlans,
  mapFinanceSummary,
  mapOrganizationInvoice,
  mapTuitionAgreement,
  mapTuitionPlan,
  recordManualPayment,
} from "../finance";
import { supabaseRestPost } from "../rest";

jest.mock("../rest", () => ({ supabaseRestPost: jest.fn() }));

const postMock = supabaseRestPost as jest.MockedFunction<typeof supabaseRestPost>;

describe("finance API", () => {
  beforeEach(() => postMock.mockReset());

  it("maps bigint strings without leaking provider fields", () => {
    expect(
      mapFinanceSummary(
        {
          organization_id: "org-1",
          expected_cents: "123400",
          received_cents: "50000",
          overdue_cents: "10000",
          open_cents: "63400",
          overdue_count: "1",
          open_count: "3",
          paid_count: "2",
          active_agreements_count: "6",
        },
        "fallback"
      )
    ).toEqual({
      organizationId: "org-1",
      expectedCents: 123400,
      receivedCents: 50000,
      overdueCents: 10000,
      openCents: 63400,
      overdueCount: 1,
      openCount: 3,
      paidCount: 2,
      activeAgreementsCount: 6,
    });
  });

  it("normalizes an invoice row", () => {
    expect(
      mapOrganizationInvoice({
        invoice_id: "invoice-1",
        student_id: "student-1",
        student_name: "  Júlia  ",
        competence_month: "2026-08-01",
        due_date: "2026-08-10",
        amount_cents: "15000",
        paid_cents: "5000",
        status: "partially_paid",
        description: null,
        created_at: "2026-08-01T00:00:00Z",
        paid_at: null,
      })
    ).toMatchObject({
      id: "invoice-1",
      studentName: "Júlia",
      amountCents: 15000,
      paidCents: 5000,
      status: "partially_paid",
      description: "Mensalidade",
    });
  });

  it("maps plans and agreements without exposing private student data", () => {
    expect(
      mapTuitionPlan({
        plan_id: "plan-1",
        name: "  Mensal  ",
        description: null,
        amount_cents: "12000",
        currency: "BRL",
        due_day: "10",
        active: true,
        created_at: "2026-08-30T00:00:00Z",
      })
    ).toMatchObject({ id: "plan-1", name: "Mensal", amountCents: 12000, dueDay: 10 });
    expect(
      mapTuitionAgreement({
        agreement_id: "agreement-1",
        student_id: "student-1",
        student_name: "Júlia",
        plan_id: "plan-1",
        plan_name: "Mensal",
        payer_user_id: "user-1",
        status: "active",
        start_date: "2026-08-01",
        end_date: null,
        amount_cents: "12000",
        due_day: "10",
      })
    ).toMatchObject({ id: "agreement-1", studentName: "Júlia", payerUserId: "user-1" });
  });

  it("uses organization-scoped RPCs", async () => {
    postMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await getOrganizationFinanceDashboard("org-1");
    await listOrganizationInvoices("org-1", "overdue");

    expect(postMock).toHaveBeenNthCalledWith(
      1,
      "/rpc/get_organization_finance_dashboard_v1",
      { p_org_id: "org-1" }
    );
    expect(postMock).toHaveBeenNthCalledWith(
      2,
      "/rpc/list_organization_invoices_v1",
      { p_org_id: "org-1", p_status: "overdue" }
    );
  });

  it("uses organization-scoped management RPCs and caller idempotency", async () => {
    postMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce("plan-1")
      .mockResolvedValueOnce("invoice-1")
      .mockResolvedValueOnce([
        { payment_id: "payment-1", invoice_status: "paid", paid_cents: "12000" },
      ]);

    await listTuitionPlans("org-1");
    await listTuitionAgreements("org-1");
    await createTuitionPlan({
      organizationId: "org-1",
      name: "Mensal",
      amountCents: 12000,
      dueDay: 10,
      idempotencyKey: "plan-key",
    });
    await issueTuitionInvoice({
      organizationId: "org-1",
      agreementId: "agreement-1",
      competenceMonth: "2026-08-01",
      dueDate: "2026-08-10",
      idempotencyKey: "invoice-key",
    });
    const payment = await recordManualPayment({
      organizationId: "org-1",
      invoiceId: "invoice-1",
      amountCents: 12000,
      method: "pix",
      paidAt: "2026-08-10T12:00:00Z",
      idempotencyKey: "payment-key",
    });

    expect(postMock).toHaveBeenNthCalledWith(1, "/rpc/list_tuition_plans_v1", {
      p_org_id: "org-1",
    });
    expect(postMock).toHaveBeenNthCalledWith(2, "/rpc/list_tuition_agreements_v1", {
      p_org_id: "org-1",
    });
    expect(postMock).toHaveBeenNthCalledWith(
      3,
      "/rpc/create_tuition_plan_v1",
      expect.objectContaining({ p_org_id: "org-1", p_idempotency_key: "plan-key" })
    );
    expect(payment).toEqual({
      paymentId: "payment-1",
      invoiceStatus: "paid",
      paidCents: 12000,
    });
  });
});
