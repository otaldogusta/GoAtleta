/* eslint-disable import/first */
const supabaseRestPostMock = jest.fn();

jest.mock("../rest", () => ({
  supabaseRestPost: (...args: unknown[]) => supabaseRestPostMock(...args),
}));

import {
  listRegulationUpdates,
  markRegulationUpdateRead,
} from "../regulation-updates";

describe("regulation updates api", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("listRegulationUpdates maps rows and returns cursor", async () => {
    supabaseRestPostMock.mockResolvedValue([
      {
        id: "ru_1",
        organization_id: "org_1",
        rule_set_id: "rs_1",
        source_id: "src_1",
        document_id: "doc_1",
        published_at: "2026-02-20T10:00:00.000Z",
        changed_topics: ["Substituicoes", "Libero"],
        diff_summary: "Novo adendo detectado.",
        source_url: "https://example.com/regra.pdf",
        checksum_sha256: "abc",
        status: "published",
        created_at: "2026-02-20T10:01:00.000Z",
        source_label: "FIVB 2026",
        source_authority: "FIVB",
        read_at: null,
        is_read: false,
      },
    ]);

    const result = await listRegulationUpdates({
      organizationId: "org_1",
      unreadOnly: true,
      limit: 1,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toContain("FIVB");
    expect(result.items[0].isRead).toBe(false);
    expect(result.nextCursor).toBe("2026-02-20T10:01:00.000Z");
  });

  test("markRegulationUpdateRead calls rpc with params", async () => {
    supabaseRestPostMock.mockResolvedValue(null);

    await markRegulationUpdateRead({
      organizationId: "org_1",
      ruleUpdateId: "ru_1",
    });

    expect(supabaseRestPostMock).toHaveBeenCalledWith(
      "/rpc/mark_regulation_update_read",
      {
        p_organization_id: "org_1",
        p_rule_update_id: "ru_1",
      },
      "return=minimal"
    );
  });
});
