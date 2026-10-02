import { isCopilotPublicRoute } from "../route-visibility";

describe("assistant visibility on public routes", () => {
  it.each([
    "/invite", "/invite/token", "/invite/token/",
    "/family-invite", "/family-invite/token", "/family-invite/token/",
    "/staff-invite", "/staff-invite/token", "/staff-invite/token/",
    "/login", "/login/", "/welcome", "/reset-password", "/pending",
  ])("blocks the assistant on %s even for an existing session", (path) => {
    expect(isCopilotPublicRoute(path)).toBe(true);
  });

  it.each(["/students", "/prof/planning", "/family/home", "/invites-history", "/family-invite-settings"]) (
    "keeps internal routes outside the public-route block: %s", (path) => {
      expect(isCopilotPublicRoute(path)).toBe(false);
    },
  );
});
