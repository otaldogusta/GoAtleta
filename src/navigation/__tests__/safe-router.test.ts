import { navigateBackOrReplace } from "../safe-router";

describe("navigateBackOrReplace", () => {
  it("uses the real navigation history when one is available", () => {
    const router = {
      back: jest.fn(),
      canGoBack: jest.fn(() => true),
      replace: jest.fn(),
    };

    navigateBackOrReplace({ router, fallback: "/prof/home" });

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("replaces with the fallback when there is no previous destination", () => {
    const router = {
      back: jest.fn(),
      canGoBack: jest.fn(() => false),
      replace: jest.fn(),
    };

    navigateBackOrReplace({ router, fallback: "/prof/home" });

    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith("/prof/home");
  });

  it("uses the fallback when history inspection fails", () => {
    const router = {
      back: jest.fn(),
      canGoBack: jest.fn(() => {
        throw new Error("history unavailable");
      }),
      replace: jest.fn(),
    };

    navigateBackOrReplace({ router, fallback: "/prof/home" });

    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith("/prof/home");
  });
});
