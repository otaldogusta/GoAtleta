import { supabaseRestGet } from "../../../../api/rest";
import { listClassStaffIdentitiesByClassIds } from "../../../../api/class-responsibles";
import { loadClassAssignmentDetails } from "../class-assignment-details";

jest.mock("../../../../api/rest", () => ({ supabaseRestGet: jest.fn() }));
jest.mock("../../../../api/class-responsibles", () => ({ listClassStaffIdentitiesByClassIds: jest.fn() }));

const get = jest.mocked(supabaseRestGet);
const staff = jest.mocked(listClassStaffIdentitiesByClassIds);
beforeEach(() => jest.resetAllMocks());

it("counts each student once, scopes reads and identifies current staff roles", async () => {
  get.mockResolvedValueOnce([{ id: "a", classid: "c1" }, { id: "a", classid: "c1" }, { id: "b", classid: "c1" }, { id: "x", classid: "other" }]).mockResolvedValueOnce([{ id: "e1", student_id: "a", class_id: "c1" }, { id: "e2", student_id: "b", class_id: "c2" }, { id: "e3", student_id: "inactive", class_id: "c2" }]);
  staff.mockResolvedValue([
    { classId: "c1", userId: "teacher", staffRole: "head", displayName: "Ana" },
    { classId: "c1", userId: "intern", staffRole: "intern", displayName: "Bia" },
  ]);
  expect(await loadClassAssignmentDetails("org", ["c1", "c2"])).toEqual({
    c1: { studentCount: 2, teachers: ["Ana"], interns: ["Bia"] },
    c2: { studentCount: 1, teachers: [], interns: [] },
  });
  expect(get.mock.calls[0][0]).toContain("organization_id=eq.org&membership_status=eq.active");
  expect(get.mock.calls[0][0]).toContain("select=id,classid");
  expect(staff).toHaveBeenCalledWith({ organizationId: "org", classIds: ["c1", "c2"] });
});

it("paginates rather than silently truncating counts", async () => {
  get.mockResolvedValueOnce(Array.from({ length: 500 }, (_, id) => ({ id: String(id), classid: "c1" }))).mockResolvedValueOnce([{ id: "last", classid: "c1" }]).mockResolvedValueOnce([]);
  staff.mockResolvedValue([]);
  expect((await loadClassAssignmentDetails("org", ["c1"])).c1.studentCount).toBe(501);
  expect(get.mock.calls[1][0]).toContain("offset=500");
});

it("keeps failed data unavailable rather than claiming an empty class or staff", async () => {
  get.mockRejectedValue(new Error("offline"));
  staff.mockRejectedValue(new Error("denied"));
  expect((await loadClassAssignmentDetails("org", ["c1"])).c1).toEqual({ studentCount: null, teachers: null, interns: null });
});

it("does not query without an institution or classes", async () => {
  expect(await loadClassAssignmentDetails("", ["c1"])).toEqual({});
  expect(await loadClassAssignmentDetails("org", [])).toEqual({});
  expect(get).not.toHaveBeenCalled();
  expect(staff).not.toHaveBeenCalled();
});
