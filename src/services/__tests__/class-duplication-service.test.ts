import type { ClassGroup } from "../../core/models";
import { duplicateClassWithCurrentStaff } from "../class-duplication-service";
import { deleteClass, duplicateClass } from "../../db/classes";
import {
  listClassStaffIdentitiesByClassIds,
  replaceClassStaffAssignments,
} from "../../api/class-responsibles";
import {
  applyClassStaffAssignmentsWithHistory,
  getClassStaffVersion,
  isClassStaffHistoryUnavailable,
} from "../../api/class-staff-history";

jest.mock("../../db/classes", () => ({
  duplicateClass: jest.fn(),
  deleteClass: jest.fn(),
}));
jest.mock("../../api/class-responsibles", () => ({
  listClassStaffIdentitiesByClassIds: jest.fn(),
  replaceClassStaffAssignments: jest.fn(),
}));
jest.mock("../../api/class-staff-history", () => ({
  applyClassStaffAssignmentsWithHistory: jest.fn(),
  getClassStaffVersion: jest.fn(),
  isClassStaffHistoryUnavailable: jest.fn(),
}));

const sourceClass = {
  id: "class-source",
  organizationId: "org-1",
  name: "Turma teste",
} as ClassGroup;

describe("duplicateClassWithCurrentStaff", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(duplicateClass).mockResolvedValue("class-copy");
    jest.mocked(deleteClass).mockResolvedValue(undefined);
    jest.mocked(getClassStaffVersion).mockResolvedValue(0);
    jest.mocked(applyClassStaffAssignmentsWithHistory).mockResolvedValue({
      classId: "class-copy",
      version: 1,
      appliedAt: "2026-09-22T10:00:00Z",
    });
    jest.mocked(isClassStaffHistoryUnavailable).mockReturnValue(false);
  });

  it("copies the current team with roles and starts fresh history on the duplicated class", async () => {
    jest.mocked(listClassStaffIdentitiesByClassIds).mockResolvedValue([
      { classId: "class-source", userId: "head-1", staffRole: "head", displayName: "Titular" },
      { classId: "class-source", userId: "assistant-1", staffRole: "assistant", displayName: "Auxiliar" },
      { classId: "class-source", userId: "staff-profile:profile-1", staffProfileId: "profile-1", isPlaceholder: true, staffRole: "intern", displayName: "Estagiário" },
    ]);

    await expect(duplicateClassWithCurrentStaff(sourceClass)).resolves.toBe("class-copy");

    expect(applyClassStaffAssignmentsWithHistory).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: "org-1",
      classId: "class-copy",
      expectedVersion: 0,
      assignments: [
        expect.objectContaining({ userId: "head-1", staffRole: "head" }),
        expect.objectContaining({ userId: "assistant-1", staffRole: "assistant" }),
        expect.objectContaining({ userId: null, staffProfileId: "profile-1", isPlaceholder: true, staffRole: "intern" }),
      ],
    }));
    expect(replaceClassStaffAssignments).not.toHaveBeenCalled();
    expect(deleteClass).not.toHaveBeenCalled();
  });

  it("uses the compatible current-team projection when staff history is unavailable", async () => {
    jest.mocked(listClassStaffIdentitiesByClassIds).mockResolvedValue([
      { classId: "class-source", userId: "head-1", staffRole: "head", displayName: "Titular" },
    ]);
    jest.mocked(getClassStaffVersion).mockRejectedValue(new Error("class_staff_tenures missing"));
    jest.mocked(isClassStaffHistoryUnavailable).mockReturnValue(true);

    await expect(duplicateClassWithCurrentStaff(sourceClass)).resolves.toBe("class-copy");
    expect(replaceClassStaffAssignments).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: "org-1",
      classId: "class-copy",
      assignments: [expect.objectContaining({ userId: "head-1", staffRole: "head" })],
    }));
  });

  it("removes the incomplete copy when the team cannot be copied", async () => {
    jest.mocked(listClassStaffIdentitiesByClassIds).mockRejectedValue(new Error("Failed to fetch"));

    await expect(duplicateClassWithCurrentStaff(sourceClass)).rejects.toThrow(
      "Não foi possível copiar a equipe da turma. A duplicação foi cancelada."
    );
    expect(deleteClass).toHaveBeenCalledWith("class-copy");
  });
});
