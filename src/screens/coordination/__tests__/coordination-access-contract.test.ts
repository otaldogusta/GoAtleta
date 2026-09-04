import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const screen = readFileSync(resolve(__dirname, "../../../../app/coordination.tsx"), "utf8");
const workspace = readFileSync(resolve(__dirname, "../CoordinationPeopleWorkspace.tsx"), "utf8");

describe("coordination permission and failure boundaries", () => {
  it("uses unmodified server memberships instead of preview privileges", () => {
    expect(screen).toContain("hasCoordinationAccess(organizations, activeOrganization)");
    expect(screen).toContain("if (!organizationId || !isAdmin)");
  });
  it("does not turn failed critical queries into empty dashboards", () => {
    expect(screen).not.toContain("adminListOrgMembers(organizationId).catch");
    expect(screen).not.toContain(".catch(() => [] as TrainerInviteItem[])");
    expect(screen).toContain("{!error ? <CoordinationPeopleWorkspace");
    expect(screen).toContain("Tentar carregar coordenação novamente");
  });
  it("renders a friendly invite error", () => {
    expect(workspace).toContain('getFriendlyErrorMessage(error, "Tente novamente em instantes.")');
  });
});
