import {
  getConfirmedPhone,
  getPhoneVerificationTarget,
  getPhoneVerificationRetrySeconds,
  hasConfirmedPhone,
} from "../phone-verification";

describe("phone verification", () => {
  it("accepts the phone promoted by Supabase after the phone-change OTP", () => {
    const user = {
      phone: "5541933008130",
      app_metadata: { providers: ["email", "phone"] },
    };

    expect(getConfirmedPhone(user)).toBe("+5541933008130");
    expect(hasConfirmedPhone(user, "+5541933008130")).toBe(true);
  });

  it("rejects a pending, missing or different phone", () => {
    expect(getConfirmedPhone({ phone: "+5541933008130", app_metadata: { providers: ["email"] } })).toBe("");
    expect(hasConfirmedPhone(null, "+5541933008130")).toBe(false);
    expect(hasConfirmedPhone({
      phone: "+5541999999999",
      phone_confirmed_at: "2026-09-24T16:03:51Z",
    }, "+5541933008130")).toBe(false);
  });

  it("counts down the resend window without returning negative seconds", () => {
    expect(getPhoneVerificationRetrySeconds(61_000, 1_500)).toBe(60);
    expect(getPhoneVerificationRetrySeconds(61_000, 61_000)).toBe(0);
    expect(getPhoneVerificationRetrySeconds(61_000, 70_000)).toBe(0);
  });

  it("accepts valid international targets and rejects invalid E.164 lengths", () => {
    expect(getPhoneVerificationTarget("+55", "(41) 93300-8130")).toBe("+5541933008130");
    expect(getPhoneVerificationTarget("+1", "202-555-0147")).toBe("+12025550147");
    expect(getPhoneVerificationTarget("+55", "93300")).toBe("");
    expect(getPhoneVerificationTarget("+999", "123456789012345")).toBe("");
  });
});
