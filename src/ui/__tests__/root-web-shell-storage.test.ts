import { resolveWebLocalStorage } from "../web-local-storage";

describe("RootWebShell storage", () => {
  const storage = {
    getItem: jest.fn(() => null),
    setItem: jest.fn(),
  };

  it("never exposes web localStorage to native runtimes", () => {
    expect(resolveWebLocalStorage("android", storage)).toBeNull();
    expect(resolveWebLocalStorage("ios", storage)).toBeNull();
  });

  it("requires a complete localStorage implementation on web", () => {
    expect(resolveWebLocalStorage("web", undefined)).toBeNull();
    expect(resolveWebLocalStorage("web", { getItem: jest.fn() })).toBeNull();
    expect(resolveWebLocalStorage("web", storage)).toBe(storage);
  });
});
