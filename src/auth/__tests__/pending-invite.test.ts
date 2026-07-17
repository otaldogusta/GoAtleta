import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  clearPendingInvite,
  clearPendingTrainerInvite,
  getPendingInvite,
  getPendingTrainerInvite,
  savePendingInvite,
  savePendingTrainerInvite,
} from "../pending-invite";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe("pending invite storage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("keeps student and trainer invitations in separate keys", async () => {
    await savePendingInvite(" student-token ");
    await savePendingTrainerInvite(" abcd-1234 ");

    expect(AsyncStorage.setItem).toHaveBeenNthCalledWith(
      1,
      "pending_student_invite_v1",
      "student-token"
    );
    expect(AsyncStorage.setItem).toHaveBeenNthCalledWith(
      2,
      "pending_trainer_invite_v1",
      "ABCD-1234"
    );
  });

  test("reads and clears both invitation types independently", async () => {
    (AsyncStorage.getItem as jest.Mock)
      .mockResolvedValueOnce("student-token")
      .mockResolvedValueOnce("TRAINER-CODE");

    await expect(getPendingInvite()).resolves.toBe("student-token");
    await expect(getPendingTrainerInvite()).resolves.toBe("TRAINER-CODE");

    await clearPendingInvite();
    await clearPendingTrainerInvite();

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      "pending_student_invite_v1"
    );
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      "pending_trainer_invite_v1"
    );
  });
});
