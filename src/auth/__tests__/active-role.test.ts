import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  getActiveFamilyStudentPreference,
  getActiveRolePreference,
  setActiveFamilyStudentPreference,
  setActiveRolePreference,
} from "../active-role";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
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
      .mockResolvedValueOnce("family")
      .mockResolvedValueOnce("invalid");

    await expect(getActiveRolePreference("user-1")).resolves.toBe("trainer");
    await expect(getActiveRolePreference("user-1")).resolves.toBe("family");
    await expect(getActiveRolePreference("user-1")).resolves.toBeNull();
  });

  it("stores the selected family athlete per authenticated user", async () => {
    await setActiveFamilyStudentPreference("user-1", " student-1 ");

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      "goatleta:active-family-student:user-1",
      "student-1",
    );
  });

  it("clears an empty family athlete preference", async () => {
    await setActiveFamilyStudentPreference("user-1", " ");

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      "goatleta:active-family-student:user-1",
    );
  });

  it("normalizes the selected family athlete on read", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(" student-1 ");

    await expect(getActiveFamilyStudentPreference("user-1")).resolves.toBe(
      "student-1",
    );
  });
});
