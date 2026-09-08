import { normalizeAIActionDate, resolveAIContext } from "../ai-context.ts";

describe("AI action context", () => {
  test.each([[5, "member"], [10, "coach"], [50, "admin"]])("resolves actual organization role %s as %s", async (level, expectedRole) => {
    const filters: string[] = [];
    const client = { rpc: async () => ({ data: [], error: null }), from(table: string) {
      const result = { data: table === "organization_members" ? [{ organization_id: "org", role_level: level }] : table === "organizations" ? { id: "org", name: "Fixture" } : null, error: null };
      return { select() { return this; }, eq(key: string, value: string) { filters.push(`${table}:${key}:${value}`); return this; },
        maybeSingle() { return Promise.resolve(result); }, then(resolve: (value: unknown) => unknown) { return Promise.resolve(result).then(resolve); } };
    } };
    const context = await resolveAIContext(client as never, { id: "user" } as never, { organizationId: "org" });
    expect(context.user.role).toBe(expectedRole);
    expect(filters).toContain("organization_members:user_id:user");
  });
  test("normaliza a data da ação usada pelo contexto documental", () => {
    expect(normalizeAIActionDate("2026-07-16")).toBe("2026-07-16");
    expect(normalizeAIActionDate("2026-07-16T14:00:00-03:00")).toBe(
      "2026-07-16"
    );
  });

  test("rejeita datas ambíguas ou impossíveis", () => {
    expect(normalizeAIActionDate("16/07/2026")).toBeNull();
    expect(normalizeAIActionDate("2026-02-30")).toBeNull();
    expect(normalizeAIActionDate("")).toBeNull();
  });
});
