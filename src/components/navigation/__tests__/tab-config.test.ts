import { ROLE_RADIAL_ACTIONS, ROLE_TABS } from "../tab-config";

describe("role navigation configuration", () => {
  it("exposes the four operational family tabs without a center action", () => {
    expect(
      ROLE_TABS.family.map((item) => ({
        label: item.label,
        href: item.isCenter ? null : String(item.href),
      })),
    ).toEqual([
      { label: "Hoje", href: "/family/home" },
      { label: "Agenda", href: "/family/agenda" },
      { label: "Pagamentos", href: "/family/payments" },
      { label: "Perfil", href: "/family/profile" },
    ]);
  });

  it("keeps Financeiro in coordination actions instead of adding a bottom tab", () => {
    expect(ROLE_TABS.coord.some((item) => item.key === "finance")).toBe(false);
    expect(ROLE_RADIAL_ACTIONS.coord).toContainEqual(
      expect.objectContaining({
        id: "finance",
        label: "Financeiro",
        href: "/coord/finance",
      }),
    );
  });
});
