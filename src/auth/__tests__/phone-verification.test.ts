import { getConfirmedPhone, hasConfirmedPhone } from "../phone-verification";

describe("phone verification", () => {
  it("accepts the phone promoted by Supabase after the phone-change OTP", () => {
    const user = {
      phone: "+5541933008130",
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
});
