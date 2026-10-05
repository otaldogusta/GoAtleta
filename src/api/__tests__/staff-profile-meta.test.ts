import { getInstitutionLocation, getMemberJoinedAt } from "../staff-profile-meta";
import { supabaseRestGet } from "../rest";

jest.mock("../rest", () => ({ supabaseRestGet: jest.fn() }));
const get = supabaseRestGet as jest.Mock;

beforeEach(() => get.mockReset());

it("reads only the active workspace location for the selected organization", async () => {
  get.mockResolvedValueOnce([{ city: " Pinhais ", state: " PR " }]);
  await expect(getInstitutionLocation("org-1")).resolves.toBe("Pinhais, PR");
  expect(get).toHaveBeenCalledWith(expect.stringContaining("organization_id=eq.org-1&scope_type=eq.workspace&active=is.true"));
});

it("omits location when the institution has no city", async () => {
  get.mockResolvedValueOnce([{ city: null, state: "PR" }]);
  await expect(getInstitutionLocation("org-1")).resolves.toBeNull();
});

it("reads the joining date for one member in one organization", async () => {
  get.mockResolvedValueOnce([{ created_at: "2024-03-10T12:00:00Z" }]);
  await expect(getMemberJoinedAt("org-1", "user-1")).resolves.toBe("2024-03-10T12:00:00Z");
  expect(get).toHaveBeenCalledWith(expect.stringContaining("organization_id=eq.org-1&user_id=eq.user-1"));
});
