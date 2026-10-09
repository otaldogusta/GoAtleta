describe("browser settings draft navigation", () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  let listener: (event: { stopImmediatePropagation: jest.Mock }) => void;
  let register: typeof import("../browser-pending-edits").registerBrowserPendingEdits;
  let browser: { location: { href: string }; navigation: { currentEntry: { index: number } }; history: { go: jest.Mock }; addEventListener: jest.Mock };

  beforeEach(() => {
    browser = {
      location: { href: "http://localhost/coord/profile/settings" },
      navigation: { currentEntry: { index: 3 } },
      history: { go: jest.fn() },
      addEventListener: jest.fn((_name, callback) => { listener = callback; }),
    };
    Object.defineProperty(globalThis, "window", { configurable: true, value: browser });
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- exercise module initialization against each browser fixture.
      register = require("../browser-pending-edits").registerBrowserPendingEdits;
    });
  });

  afterEach(() => {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  });

  function pop(href: string, index: number) {
    browser.location.href = href;
    browser.navigation.currentEntry.index = index;
    const event = { stopImmediatePropagation: jest.fn() };
    listener(event);
    return event;
  }

  it("leaves ordinary browser navigation untouched", () => {
    expect(pop("http://localhost/coord/profile", 2).stopImmediatePropagation).not.toHaveBeenCalled();
    expect(browser.history.go).not.toHaveBeenCalled();
  });

  it.each([undefined, {}])("does not register browser navigation in a native runtime (%p)", (nativeWindow) => {
    Object.defineProperty(globalThis, "window", { configurable: true, value: nativeWindow });
    expect(() => {
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- native module initialization regression.
        const nativeRegister = require("../browser-pending-edits").registerBrowserPendingEdits;
        const onLeave = jest.fn();
        nativeRegister(onLeave)();
        expect(onLeave).not.toHaveBeenCalled();
      });
    }).not.toThrow();
  });

  it("restores the URL before asking and preserves the draft when editing continues", () => {
    const confirm = jest.fn();
    register(confirm);
    expect(pop("http://localhost/coord/profile", 2).stopImmediatePropagation).toHaveBeenCalled();
    expect(browser.history.go).toHaveBeenCalledWith(1);
    expect(confirm).not.toHaveBeenCalled();
    pop("http://localhost/coord/profile/settings", 3);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(browser.history.go).toHaveBeenCalledTimes(1);
    pop("http://localhost/coord/profile", 2);
    expect(browser.history.go).toHaveBeenCalledTimes(2);
  });

  it("replays the exact history traversal only after discard", () => {
    const confirm = jest.fn();
    register(confirm);
    pop("http://localhost/coord/home", 1);
    expect(browser.history.go).toHaveBeenCalledWith(2);
    pop("http://localhost/coord/profile/settings", 3);
    confirm.mock.calls[0][0]();
    expect(browser.history.go).toHaveBeenLastCalledWith(-2);
    expect(pop("http://localhost/coord/home", 1).stopImmediatePropagation).not.toHaveBeenCalled();
  });

  it("restores forward navigation without deleting history entries", () => {
    const cleanup = register(jest.fn());
    pop("http://localhost/coord/home", 4);
    expect(browser.history.go).toHaveBeenCalledWith(-1);
    pop("http://localhost/coord/profile/settings", 3);
    cleanup();
    expect(pop("http://localhost/coord/home", 4).stopImmediatePropagation).not.toHaveBeenCalled();
  });

  it("does not let cleanup of an older screen clear the focused draft guard", () => {
    const cleanup = register(jest.fn());
    const current = jest.fn();
    register(current);
    cleanup();
    pop("http://localhost/coord/profile", 2);
    pop("http://localhost/coord/profile/settings", 3);
    expect(current).toHaveBeenCalledTimes(1);
  });
});
