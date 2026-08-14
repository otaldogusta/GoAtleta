import { getMemberDisplayLabel } from "../member-display-label";

const member = {
  userId: "current-user",
  displayName: "Gustavo Ribeiro",
};

describe("getMemberDisplayLabel", () => {
  it("identifies the member from the current session as Você", () => {
    expect(getMemberDisplayLabel(member, "current-user")).toBe("Você");
  });

  it("keeps the real name for another member", () => {
    expect(getMemberDisplayLabel(member, "another-user")).toBe("Gustavo Ribeiro");
  });

  it("keeps the real name when there is no authenticated session", () => {
    expect(getMemberDisplayLabel(member, null)).toBe("Gustavo Ribeiro");
  });
});
