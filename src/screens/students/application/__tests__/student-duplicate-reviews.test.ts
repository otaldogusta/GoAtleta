import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  loadReviewedDuplicateSignatures,
  saveReviewedDuplicateSignature,
} from "../student-duplicate-reviews";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

describe("student duplicate reviews", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads only valid stored signatures", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify(["ana:s1,s2", "", 42])
    );

    await expect(
      loadReviewedDuplicateSignatures({ organizationId: "org_1", classId: "class_1" })
    ).resolves.toEqual(new Set(["ana:s1,s2"]));
  });

  it("persists a reviewed signature without removing previous decisions", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(["bia:s3,s4"]));

    await saveReviewedDuplicateSignature({
      organizationId: "org_1",
      classId: "class_1",
      signature: "ana:s1,s2",
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      "student_duplicate_reviews_v1:org_1:class_1",
      JSON.stringify(["ana:s1,s2", "bia:s3,s4"])
    );
  });
});
