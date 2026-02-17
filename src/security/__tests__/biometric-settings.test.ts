import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  BIOMETRICS_ENABLED_KEY,
  getBiometricsEnabled,
  setBiometricsEnabled,
} from "../biometric-settings";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe("biometric-settings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("persists enabled flag as true", async () => {
    await setBiometricsEnabled(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(BIOMETRICS_ENABLED_KEY, "true");
  });

  test("removes key when disabling", async () => {
    await setBiometricsEnabled(false);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(BIOMETRICS_ENABLED_KEY);
  });

  test("reads enabled flag", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue("true");
    await expect(getBiometricsEnabled()).resolves.toBe(true);
  });
});
