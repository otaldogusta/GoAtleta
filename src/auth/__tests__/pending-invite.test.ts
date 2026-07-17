import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  clearPendingInvite,
  clearPendingTrainerInvite,
  getPendingInvite,
  getPendingTrainerInvite,
  resolvePendingInviteRedirect,
  resolvePendingTrainerCode,
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

  test.each([
    {
      pendingStudentToken: "student-token",
      pendingTrainerCode: "",
      expected: "/pending",
    },
    {
      pendingStudentToken: "",
      pendingTrainerCode: "TRAINER-CODE",
      expected: "/pending",
    },
    {
      pendingStudentToken: "",
      pendingTrainerCode: "",
      expected: "/prof/home",
    },
  ])(
    "routes pending invitations before the default post-login target",
    ({ pendingStudentToken, pendingTrainerCode, expected }) => {
      expect(
        resolvePendingInviteRedirect({
          pendingStudentToken,
          pendingTrainerCode,
          defaultTarget: "/prof/home",
        })
      ).toBe(expected);
    }
  );

  test("prioritizes the trainer invite in the login route over delayed storage", () => {
    expect(
      resolvePendingTrainerCode({
        routeCode: " route-code ",
        storedCode: "stale-code",
      })
    ).toBe("ROUTE-CODE");
  });

  test("falls back to the stored trainer invite when the route has none", () => {
    expect(
      resolvePendingTrainerCode({
        storedCode: " stored-code ",
      })
    ).toBe("STORED-CODE");
  });
});
