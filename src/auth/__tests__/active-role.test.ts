import AsyncStorage from "@react-native-async-storage/async-storage";

import { getActiveRolePreference, setActiveRolePreference } from "../active-role";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

describe("active role preference", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("persists the selected role per authenticated user", async () => {
    await setActiveRolePreference("user-1", "student");

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      "goatleta:active-role:user-1",
      "student"
    );
  });

  it("returns only supported persisted roles", async () => {
    (AsyncStorage.getItem as jest.Mock)
      .mockResolvedValueOnce("trainer")
      .mockResolvedValueOnce("invalid");

    await expect(getActiveRolePreference("user-1")).resolves.toBe("trainer");
    await expect(getActiveRolePreference("user-1")).resolves.toBeNull();
  });
});
