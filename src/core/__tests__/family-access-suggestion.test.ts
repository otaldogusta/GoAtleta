import { suggestFamilyAthlete } from "../family-access-suggestion";
const lucas = { id: "1", name: "Lucas Ribeiro" };
it("suggests only a unique exact normalized name", () => {
  expect(suggestFamilyAthlete("  LUCAS   Ribeiro ", [lucas])).toEqual(lucas);
});
it("does not choose between namesakes", () => {
  expect(suggestFamilyAthlete("Lucas Ribeiro", [lucas, { ...lucas, id: "2" }])).toBeNull();
});
it("does not infer from partial or missing names", () => {
  expect(suggestFamilyAthlete("Lucas", [lucas])).toBeNull();
  expect(suggestFamilyAthlete(null, [lucas])).toBeNull();
});
