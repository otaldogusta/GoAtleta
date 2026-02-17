import {
  nextBiometricFailureState,
  shouldLockBiometricSession,
  shouldRelockOnForeground,
} from "../biometric-lock";

describe("biometric-lock core", () => {
  test("starts locked only for native + session + enabled", () => {
    expect(
      shouldLockBiometricSession({
        isNative: true,
        sessionActive: true,
        isEnabled: true,
      })
    ).toBe(true);
    expect(
      shouldLockBiometricSession({
        isNative: true,
        sessionActive: false,
        isEnabled: true,
      })
    ).toBe(false);
    expect(
      shouldLockBiometricSession({
        isNative: false,
        sessionActive: true,
        isEnabled: true,
      })
    ).toBe(false);
  });

  test("success path is represented by no failure increments", () => {
    const firstFailure = nextBiometricFailureState(0);
    expect(firstFailure.failedAttempts).toBe(1);
    expect(firstFailure.forceRelogin).toBe(false);
  });

  test("third consecutive failure triggers force relogin", () => {
    const state1 = nextBiometricFailureState(0);
    const state2 = nextBiometricFailureState(state1.failedAttempts);
    const state3 = nextBiometricFailureState(state2.failedAttempts);
    expect(state3.failedAttempts).toBe(3);
    expect(state3.forceRelogin).toBe(true);
  });

  test("relocks when app returns from background or inactive", () => {
    expect(shouldRelockOnForeground("background", "active")).toBe(true);
    expect(shouldRelockOnForeground("inactive", "active")).toBe(true);
    expect(shouldRelockOnForeground("active", "active")).toBe(false);
  });
});
