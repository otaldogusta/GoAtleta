import type { ClassStaffAssignment } from "../../../../api/class-responsibles";
import { planClassStaffRoleTransition } from "../class-staff-role-transition";

const assignments: ClassStaffAssignment[] = [
  { classId: "class-1", userId: "gustavo", staffRole: "head", displayName: "Gustavo Santos" },
  { classId: "class-1", userId: "andre", staffRole: "intern", displayName: "André Muniz" },
  { classId: "class-1", userId: "angel", staffRole: "assistant", displayName: "Angel Moraes" },
];

describe("planClassStaffRoleTransition", () => {
  it("promotes the selected professional and keeps the former head as assistant", () => {
    const transition = planClassStaffRoleTransition({ assignments, userId: "andre", nextRole: "head" });

    expect(transition.nextAssignments).toEqual([
      expect.objectContaining({ userId: "gustavo", staffRole: "assistant" }),
      expect.objectContaining({ userId: "andre", staffRole: "head" }),
      expect.objectContaining({ userId: "angel", staffRole: "assistant" }),
    ]);
    expect(transition.requiresConfirmation).toBe(true);
    expect(transition.confirmationMessage).toContain("André Muniz passará de Estagiário(a) para Professor responsável");
    expect(transition.confirmationMessage).toContain("Gustavo Santos deixará a responsabilidade e continuará como Auxiliar");
    expect(transition.confirmationMessage).toContain("Histórico da equipe");
  });

  it("requires confirmation when defining a head in a class that has none", () => {
    const transition = planClassStaffRoleTransition({
      assignments: assignments.filter((assignment) => assignment.userId !== "gustavo"),
      userId: "angel",
      nextRole: "head",
    });

    expect(transition.confirmationTitle).toBe("Definir professor responsável?");
    expect(transition.requiresConfirmation).toBe(true);
    expect(transition.nextAssignments.find((assignment) => assignment.userId === "angel")?.staffRole).toBe("head");
  });

  it("does not change the draft when the selected role is already active", () => {
    const transition = planClassStaffRoleTransition({ assignments, userId: "gustavo", nextRole: "head" });

    expect(transition.changed).toBe(false);
    expect(transition.requiresConfirmation).toBe(false);
    expect(transition.nextAssignments).toEqual(assignments);
  });

  it("changes non-head roles without affecting the current head", () => {
    const transition = planClassStaffRoleTransition({ assignments, userId: "andre", nextRole: "assistant" });

    expect(transition.requiresConfirmation).toBe(false);
    expect(transition.nextAssignments.find((assignment) => assignment.userId === "gustavo")?.staffRole).toBe("head");
    expect(transition.nextAssignments.find((assignment) => assignment.userId === "andre")?.staffRole).toBe("assistant");
  });
});
