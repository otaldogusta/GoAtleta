import { hasConfirmedPhone } from "../phone-verification";

describe("phone verification", () => {
  it("accepts the phone promoted by Supabase after the phone-change OTP", () => {
    expect(hasConfirmedPhone({ phone: "+5541933008130" }, "+5541933008130")).toBe(true);
  });

  it("rejects a missing or different phone", () => {
    expect(hasConfirmedPhone(null, "+5541933008130")).toBe(false);
    expect(hasConfirmedPhone({ phone: "+5541999999999" }, "+5541933008130")).toBe(false);
  });
});
