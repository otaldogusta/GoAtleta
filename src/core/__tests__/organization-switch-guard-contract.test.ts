import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const readSource = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const sources = {
  family: readSource(
    "src/screens/family/CoordinationFamilyAccessScreen.tsx",
  ),
  tuition: readSource(
    "src/screens/finance/CoordinationTuitionSetup.tsx",
  ),
  dashboard: readSource(
    "src/screens/finance/CoordinationFinanceDashboard.tsx",
  ),
  receivables: readSource(
    "src/screens/finance/CoordinationReceivables.tsx",
  ),
};

describe("organization switch guards", () => {
  it.each(Object.entries(sources))(
    "captures and validates organization identity in %s",
    (_name, source) => {
      expect(source).toContain("captureOrganizationAsyncIdentity(");
      expect(source).toContain("isOrganizationAsyncIdentityCurrent(");
      expect(source).toContain("useOrganizationAsyncIdentity(");
    },
  );

  it("binds family results and invite URLs to the selected athlete", () => {
    expect(sources.family).toContain(
      "relationshipScope.studentId === scopedSelectedStudentId",
    );
    expect(sources.family).toContain(
      "inviteUrlScope.studentId === scopedSelectedStudentId",
    );
    expect(sources.family).toContain(
      "selectedStudentIdRef.current !== studentId",
    );
  });

  it("closes organization-scoped details before loading the next workspace", () => {
    expect(sources.dashboard).toContain("setPaymentInvoice(null)");
    expect(sources.dashboard).toContain("setWorkspaceModal(null)");
    expect(sources.receivables).toContain("setSelectedInvoice(null)");
    expect(sources.family).toContain("setInviteUrl(\"\")");
  });

  it("remounts each stateful workspace when its organization key changes", () => {
    expect(sources.family).toContain("key={organizationId}");
    expect(sources.tuition).toContain("key={organizationId}");
    expect(sources.dashboard).toContain("key={scopeKey}");
    expect(sources.receivables).toContain("key={organizationId}");
  });

  it("guards the deferred month picker measurement callback", () => {
    const picker = sources.dashboard.slice(
      sources.dashboard.indexOf("const openMonthPicker"),
      sources.dashboard.indexOf("const selectInvoice"),
    );

    expect(picker.indexOf("captureOrganizationAsyncIdentity(")).toBeGreaterThan(
      -1,
    );
    expect(picker.indexOf("isOrganizationAsyncIdentityCurrent(")).toBeGreaterThan(
      picker.indexOf("measureInWindow("),
    );
    expect(picker.indexOf("setShowMonthPicker(true)")).toBeGreaterThan(
      picker.indexOf("isOrganizationAsyncIdentityCurrent("),
    );
  });
});
