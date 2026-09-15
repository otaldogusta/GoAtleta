import { registerPendingEditsNavigation, requestPendingEditsNavigation } from "../pending-edits-navigation";

describe("pending edits navigation", () => {
  it("does not change tabs before the focused screen releases navigation", () => {
    const navigate = jest.fn();
    let release: (() => void) | undefined;
    const cleanup = registerPendingEditsNavigation((action) => { release = action; });
    requestPendingEditsNavigation(navigate);
    expect(navigate).not.toHaveBeenCalled();
    release?.();
    expect(navigate).toHaveBeenCalledTimes(1);
    cleanup();
  });
  it("continuing editing keeps the route unchanged and cleanup restores navigation", () => {
    const navigate = jest.fn();
    const cleanup = registerPendingEditsNavigation(() => {});
    requestPendingEditsNavigation(navigate);
    expect(navigate).not.toHaveBeenCalled();
    cleanup();
    requestPendingEditsNavigation(navigate);
    expect(navigate).toHaveBeenCalledTimes(1);
  });
});
