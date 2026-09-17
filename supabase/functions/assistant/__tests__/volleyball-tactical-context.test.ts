import { VOLLEYBALL_5X1_RECEPTION_CONTEXT } from "../volleyball-tactical-context";

describe("volleyball 5x1 tactical context", () => {
  it("keeps reception organization distinct from the transition after serve", () => {
    expect(VOLLEYBALL_5X1_RECEPTION_CONTEXT).toContain("P1, P6, P5, P4, P3 e P2");
    expect(VOLLEYBALL_5X1_RECEPTION_CONTEXT).toContain("Organização da recepção");
    expect(VOLLEYBALL_5X1_RECEPTION_CONTEXT).toContain("Após o saque");
    expect(VOLLEYBALL_5X1_RECEPTION_CONTEXT).toContain("partindo exatamente dessa organização");
  });
});
