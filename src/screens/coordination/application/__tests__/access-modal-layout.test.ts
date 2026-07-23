import { resolveAccessModalLayout } from "../access-modal-layout";

describe("resolveAccessModalLayout", () => {
  it("mantém o fluxo empilhado antes de 1200 px", () => {
    expect(resolveAccessModalLayout(1199)).toBe("stacked");
  });

  it("organiza turmas e permissões lado a lado a partir de 1200 px", () => {
    expect(resolveAccessModalLayout(1200)).toBe("split");
  });
});
