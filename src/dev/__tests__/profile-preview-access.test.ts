import { canUseProfilePreview } from "../profile-preview-access";

describe("development profile access", () => {
  it("does not enable previews for regular accounts, even on localhost", () => {
    expect(canUseProfilePreview("professor@example.com", true)).toBe(false);
    expect(canUseProfilePreview(null, true)).toBe(false);
  });
  it("retains only the existing development-account exception, never in production", () => {
    expect(canUseProfilePreview("gusantinho753@gmail.com", true)).toBe(true);
    expect(canUseProfilePreview("gusantinho753@gmail.com", false)).toBe(false);
  });
});
