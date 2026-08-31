import {
  createMoney,
  InvalidBillingTransitionError,
  transitionInvoiceState,
  transitionPaymentState,
  transitionSubscriptionState,
} from "..";

describe("payment state machines", () => {
  it("moves an invoice through issue, partial payment and settlement", () => {
    const open = transitionInvoiceState("draft", { type: "issue" });
    const partiallyPaid = transitionInvoiceState(open, {
      type: "partial_payment",
    });
    const paid = transitionInvoiceState(partiallyPaid, {
      type: "payment_succeeded",
    });

    expect([open, partiallyPaid, paid]).toEqual([
      "open",
      "partially_paid",
      "paid",
    ]);
  });

  it("moves a payment through authorization and refund", () => {
    const pending = transitionPaymentState("created", { type: "submit" });
    const authorized = transitionPaymentState(pending, { type: "authorize" });
    const paid = transitionPaymentState(authorized, { type: "confirm" });
    const refunded = transitionPaymentState(paid, { type: "refund" });

    expect([pending, authorized, paid, refunded]).toEqual([
      "pending",
      "authorized",
      "paid",
      "refunded",
    ]);
  });

  it("moves a subscription through trial, delinquency and recovery", () => {
    const trialing = transitionSubscriptionState("incomplete", {
      type: "start_trial",
    });
    const active = transitionSubscriptionState(trialing, { type: "activate" });
    const pastDue = transitionSubscriptionState(active, {
      type: "payment_failed",
    });
    const recovered = transitionSubscriptionState(pastDue, {
      type: "activate",
    });

    expect([trialing, active, pastDue, recovered]).toEqual([
      "trialing",
      "active",
      "past_due",
      "active",
    ]);
  });

  it("rejects invalid transitions from terminal states", () => {
    expect(() =>
      transitionInvoiceState("canceled", { type: "payment_succeeded" }),
    ).toThrow(InvalidBillingTransitionError);
    expect(() =>
      transitionPaymentState("refunded", { type: "confirm" }),
    ).toThrow("Invalid payment transition");
    expect(() =>
      transitionSubscriptionState("canceled", { type: "activate" }),
    ).toThrow("Invalid subscription transition");
  });
});

describe("canonical money", () => {
  it("stores BRL values only in integer minor units", () => {
    expect(createMoney(12990)).toEqual({ amountMinor: 12990, currency: "BRL" });
  });

  it("rejects negative, fractional and unsafe values", () => {
    expect(() => createMoney(-1)).toThrow(RangeError);
    expect(() => createMoney(10.5)).toThrow(RangeError);
    expect(() => createMoney(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
  });
});
