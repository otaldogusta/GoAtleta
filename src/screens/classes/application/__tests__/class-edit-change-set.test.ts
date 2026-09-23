import type { ClassStaffAssignment } from "../../../../api/class-responsibles";
import { getClassEditChangeSet } from "../class-edit-change-set";

const head = (userId: string): ClassStaffAssignment => ({
  classId: "class-1",
  userId,
  staffRole: "head",
  displayName: userId,
});

describe("getClassEditChangeSet", () => {
  it("stays clean until the editor baseline is ready", () => {
    expect(getClassEditChangeSet({
      baseline: null,
      current: { name: "Ohayō" },
      baselineStaff: [],
      currentStaff: [head("gustavo")],
    })).toEqual({ detailsChanged: false, staffChanged: false, dirty: false });
  });

  it("separates a staff-only change from class details", () => {
    const result = getClassEditChangeSet({
      baseline: { name: "Ohayō", unit: "Rede" },
      current: { name: "Ohayō", unit: "Rede" },
      baselineStaff: [head("gustavo")],
      currentStaff: [head("andre")],
    });

    expect(result).toEqual({ detailsChanged: false, staffChanged: true, dirty: true });
  });

  it("separates a details-only change from staff", () => {
    const result = getClassEditChangeSet({
      baseline: { name: "Ohayō" },
      current: { name: "Ohayō 2" },
      baselineStaff: [head("gustavo")],
      currentStaff: [head("gustavo")],
    });

    expect(result).toEqual({ detailsChanged: true, staffChanged: false, dirty: true });
  });
});
