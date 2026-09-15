import { mergeAthleteModalities, updatePersonalModalities } from "../athlete-modalities";

describe("athlete modalities", () => {
  it("merges multiple plans and personal sports without duplicates", () => {
    expect(mergeAthleteModalities(["voleibol", "futebol", "voleibol"], ["voleibol", "basquete"]))
      .toEqual(["voleibol", "futebol", "basquete"]);
  });
  it("does not turn automatic sports into personal declarations", () => {
    expect(updatePersonalModalities(["voleibol"], [], ["voleibol", "futsal"])) .toEqual(["futsal"]);
  });
  it("removes only the personal selection, preserving overlapping declarations", () => {
    expect(updatePersonalModalities(["voleibol"], ["voleibol", "basquete"], ["voleibol"])) .toEqual(["voleibol"]);
  });
  it("preserves personal sports after the plan ends", () => {
    expect(mergeAthleteModalities([], ["voleibol"])) .toEqual(["voleibol"]);
  });
});
