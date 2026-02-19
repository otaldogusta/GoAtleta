import { shouldIgnoreContinuousScanError } from "../nfc-hooks";

describe("nfc continuous hooks", () => {
  test("ignores cancelled NFC errors", () => {
    expect(shouldIgnoreContinuousScanError({ code: "NFC_CANCELLED" })).toBe(true);
    expect(shouldIgnoreContinuousScanError({ code: "NFC_READ_FAILED" })).toBe(false);
    expect(shouldIgnoreContinuousScanError(new Error("generic"))).toBe(false);
  });
});
