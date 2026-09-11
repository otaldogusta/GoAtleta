jest.mock("../rest", () => ({ supabaseRestPost: jest.fn() }));

import { supabaseRestPost } from "../rest";
import {
  platformListInstitutions,
  platformUpdateInstitutionAccount,
} from "../platform-institutions";

const post = supabaseRestPost as jest.MockedFunction<typeof supabaseRestPost>;

beforeEach(() => post.mockReset());

it("maps platform institution rows and numeric counts", async () => {
  post.mockResolvedValueOnce([
    {
      organization_id: "org-1",
      organization_name: "Rede",
      responsible_user_id: null,
      responsible_name: "Mariah",
      responsible_email: "m@rede.com",
      product: "goatleta",
      lifecycle_status: "active",
      commercial_status: "ok",
      evaluation_ends_at: null,
      activated_at: "2026-08-15",
      renews_at: "2026-09-18",
      commercial_note: "Contato direto",
      users_count: "48",
      updated_at: "2026-09-09T12:00:00Z",
    },
  ]);
  await expect(platformListInstitutions()).resolves.toEqual([
    expect.objectContaining({
      organizationId: "org-1",
      organizationName: "Rede",
      usersCount: 48,
      lifecycleStatus: "active",
    }),
  ]);
  expect(post).toHaveBeenCalledWith("/rpc/platform_list_institutions", {});
});

it("sends lifecycle and commercial state without a payment field", async () => {
  post.mockResolvedValueOnce([
    {
      organization_id: "org-1",
      changed: true,
      updated_at: "2026-09-09T12:00:00Z",
    },
  ]);
  await platformUpdateInstitutionAccount({
    organizationId: "org-1",
    product: "goatleta",
    lifecycleStatus: "active",
    commercialStatus: "attention",
    evaluationEndsAt: null,
    activatedAt: "2026-08-15",
    renewsAt: "2026-09-18",
    commercialNote: "Cobrança externa",
    idempotencyKey: "00000000-0000-4000-8000-000000000001",
  });
  expect(post).toHaveBeenCalledWith(
    "/rpc/platform_update_institution_account",
    expect.not.objectContaining({ p_payment_status: expect.anything() }),
  );
});
