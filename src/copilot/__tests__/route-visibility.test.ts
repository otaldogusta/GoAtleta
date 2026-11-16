import { isCopilotPublicRoute, usesCalendarAssistantButton, usesConsultationAssistantButton, usesPeriodizationAssistantButton, usesManagementAssistantButton, usesRegulationsAssistantButton, usesFinanceAssistantButton, usesProfileAssistantButton, usesEvidenceAssistantButton, usesClassLogAssistantButton } from "../route-visibility";

describe("assistant visibility on public routes", () => {
  it("replaces the FAB only on Evidence and legacy class logs with a compact header action", () => {
    for (const width of [390, 767]) {
      expect(usesEvidenceAssistantButton("/evidence/", width)).toBe(true);
      expect(usesClassLogAssistantButton("/class/qa-class/log/", width)).toBe(true);
    }
    expect(usesEvidenceAssistantButton("/evidence", 768)).toBe(false);
    expect(usesClassLogAssistantButton("/class/qa/log", 768)).toBe(false);
    for (const route of ["/evidence/synthesis", "/evidence-other", "/class/qa", "/class/qa/session", "/class/qa/log/detail", "/class/log"]) {
      expect(usesEvidenceAssistantButton(route, 390)).toBe(false);
      expect(usesClassLogAssistantButton(route, 390)).toBe(false);
    }
  });
  it("replaces the FAB only on the two finance screens with header actions", () => {
    for (const route of ["/coord/finance", "/coord/finance/manage/"]) {
      expect(usesFinanceAssistantButton(route, 390)).toBe(true);
      expect(usesFinanceAssistantButton(route, 767)).toBe(true);
      expect(usesFinanceAssistantButton(route, 834)).toBe(true);
      expect(usesFinanceAssistantButton(route, 1099)).toBe(true);
      expect(usesFinanceAssistantButton(route, 1100)).toBe(false);
    }
    for (const route of ["/coord/finance/settings", "/coord/finance/receivables", "/coord/finance/manage/detail", "/family/payments"]) {
      expect(usesFinanceAssistantButton(route, 390)).toBe(false);
    }
  });
  it("keeps own-profile aliases aligned and preserves other profile and desktop launchers", () => {
    for (const route of ["/profile", "/prof/profile", "/coord/profile", "/student/profile"]) {
      expect(usesProfileAssistantButton(route, 390)).toBe(true);
      expect(usesProfileAssistantButton(`${route}/settings/`, 390)).toBe(true);
      expect(usesProfileAssistantButton(route, 768)).toBe(false);
    }
    for (const route of ["/family/profile", "/students/athlete-a", "/coord/management/athletes", "/profile/security", "/prof/profile-other"]) {
      expect(usesProfileAssistantButton(route, 390)).toBe(false);
    }
  });
  it("moves the assistant only on screens with the periodization or management header action", () => {
    for (const route of ["/periodization", "/prof/periodization", "/coord/periodization/", "/class/qa/periodization"]) {
      expect(usesPeriodizationAssistantButton(route, 390)).toBe(true);
      expect(usesPeriodizationAssistantButton(route, 834)).toBe(true);
      expect(usesPeriodizationAssistantButton(route, 1440)).toBe(true);
    }
    expect(usesPeriodizationAssistantButton("/class/qa/planning", 390)).toBe(false);
    expect(usesManagementAssistantButton("/coord/management", 390)).toBe(true);
    expect(usesManagementAssistantButton("/coordination/", 390)).toBe(true);
    expect(usesManagementAssistantButton("/coord/management", 834)).toBe(false);
    expect(usesManagementAssistantButton("/coord/management/athletes", 390)).toBe(false);
    expect(usesRegulationsAssistantButton("/coord/regulation-history", 390)).toBe(true);
    expect(usesRegulationsAssistantButton("/regulation-sources", 390)).toBe(true);
    expect(usesRegulationsAssistantButton("/coord/regulation-history", 834)).toBe(false);
    expect(usesRegulationsAssistantButton("/reports/trainer", 390)).toBe(false);
  });
  it("uses the consultation header on compact viewports without hiding it on other forms", () => {
    expect(usesConsultationAssistantButton("/prof/consultation", 390)).toBe(true);
    expect(usesConsultationAssistantButton("/consultation/", 483)).toBe(true);
    expect(usesConsultationAssistantButton("/prof/consultation", 1200)).toBe(false);
    expect(usesConsultationAssistantButton("/student/profile", 390)).toBe(false);
  });
  it.each([
    "/invite", "/invite/token", "/invite/token/",
    "/family-invite", "/family-invite/token", "/family-invite/token/",
    "/staff-invite", "/staff-invite/token", "/staff-invite/token/",
    "/login", "/login/", "/welcome", "/reset-password", "/pending",
    "/scouting/enviar-video", "/scouting/enviar-video/",
  ])("blocks the assistant on %s even for an existing session", (path) => {
    expect(isCopilotPublicRoute(path)).toBe(true);
  });

  it.each(["/students", "/prof/planning", "/family/home", "/invites-history", "/family-invite-settings"]) (
    "keeps internal routes outside the public-route block: %s", (path) => {
      expect(isCopilotPublicRoute(path)).toBe(false);
    },
  );

  it("replaces the floating action only where the compact team calendar has an inline action", () => {
    expect(usesCalendarAssistantButton("/coord/calendar", 390)).toBe(true);
    expect(usesCalendarAssistantButton("/prof/calendar/", 390)).toBe(true);
    expect(usesCalendarAssistantButton("/calendar", 768)).toBe(false);
    expect(usesCalendarAssistantButton("/student/agenda", 390)).toBe(false);
  });
});
