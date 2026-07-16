import { canSafelyUnlinkProvider } from "../identity-linking";

describe("canSafelyUnlinkProvider", () => {
  it("blocks unlinking when Google is the only login identity", () => {
    expect(canSafelyUnlinkProvider([{ id: "google-1", provider: "google" }], "google"))
      .toBe(false);
  });

  it("allows unlinking Google when another login identity exists", () => {
    expect(
      canSafelyUnlinkProvider(
        [
          { id: "google-1", provider: "google" },
          { id: "email-1", provider: "email" },
        ],
        "google"
      )
    ).toBe(true);
  });

  it("does not mistake duplicated Google records for another login method", () => {
    expect(
      canSafelyUnlinkProvider(
        [
          { id: "google-1", provider: "google" },
          { identity_id: "google-1", provider: "GOOGLE" },
        ],
        "google"
      )
    ).toBe(false);
  });
});
