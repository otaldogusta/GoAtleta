import { listClassHeadsByClassIds } from "../class-responsibles";

const mockRestPost = jest.fn();

jest.mock("../rest", () => ({
  supabaseRestPost: (...args: unknown[]) => mockRestPost(...args),
}));

describe("class responsibles api", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("loads the public responsible identity for organization members", async () => {
    mockRestPost.mockResolvedValue([
      {
        class_id: "class-1",
        user_id: "user-1",
        class_name: "Amigos do Vôlei",
        unit: "Cidadania Boa Vista",
        display_name: "Gustavo Ribeiro",
        photo_url: "https://example.com/profile.jpg",
      },
    ]);

    const result = await listClassHeadsByClassIds({
      organizationId: " org-1 ",
      classIds: [" class-1 ", "class-1", ""],
    });

    expect(mockRestPost).toHaveBeenCalledWith(
      "/rpc/list_org_class_heads_for_classes",
      {
        p_org_id: "org-1",
        p_class_ids: ["class-1"],
      },
      "return=representation"
    );
    expect(result).toEqual([
      {
        classId: "class-1",
        userId: "user-1",
        className: "Amigos do Vôlei",
        unit: "Cidadania Boa Vista",
        displayName: "Gustavo Ribeiro",
        email: null,
        photoUrl: "https://example.com/profile.jpg",
      },
    ]);
  });

  test("does not call the server without an organization or class", async () => {
    await expect(
      listClassHeadsByClassIds({ organizationId: "", classIds: ["class-1"] })
    ).resolves.toEqual([]);
    await expect(
      listClassHeadsByClassIds({ organizationId: "org-1", classIds: [] })
    ).resolves.toEqual([]);

    expect(mockRestPost).not.toHaveBeenCalled();
  });
});
