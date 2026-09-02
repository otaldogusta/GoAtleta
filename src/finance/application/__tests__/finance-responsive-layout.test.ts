import { resolveFinanceScrollBottomPadding } from "../finance-responsive-layout";

describe("finance responsive layout", () => {
  it("reserves the bottom navigation clearance on mobile", () => {
    expect(
      resolveFinanceScrollBottomPadding({
        usesWorkspaceShell: false,
        bottomInset: 0,
      }),
    ).toBe(148);
    expect(
      resolveFinanceScrollBottomPadding({
        usesWorkspaceShell: false,
        bottomInset: 34,
      }),
    ).toBe(166);
  });

  it("keeps only the normal page gutter in the workspace shell", () => {
    expect(
      resolveFinanceScrollBottomPadding({
        usesWorkspaceShell: true,
        bottomInset: 0,
      }),
    ).toBe(24);
  });

  it("normalizes invalid safe-area values", () => {
    expect(
      resolveFinanceScrollBottomPadding({
        usesWorkspaceShell: false,
        bottomInset: Number.NaN,
      }),
    ).toBe(148);
  });
});
