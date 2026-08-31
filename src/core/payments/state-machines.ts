import type {
  InvoiceStateEvent,
  InvoiceStatus,
  PaymentStateEvent,
  PaymentStatus,
  SubscriptionStateEvent,
  SubscriptionStatus,
} from "./types";

type BillingMachine = "invoice" | "payment" | "subscription";

export class InvalidBillingTransitionError extends Error {
  readonly machine: BillingMachine;
  readonly currentState: string;
  readonly eventType: string;

  constructor(machine: BillingMachine, currentState: string, eventType: string) {
    super(`Invalid ${machine} transition: ${currentState} + ${eventType}.`);
    this.name = "InvalidBillingTransitionError";
    this.machine = machine;
    this.currentState = currentState;
    this.eventType = eventType;
  }
}

export function transitionInvoiceState(
  current: InvoiceStatus,
  event: InvoiceStateEvent,
): InvoiceStatus {
  switch (event.type) {
    case "issue":
      if (current === "draft") return "open";
      break;
    case "payment_started":
      if (current === "open" || current === "overdue") {
        return "awaiting_payment";
      }
      break;
    case "partial_payment":
      if (
        current === "open" ||
        current === "awaiting_payment" ||
        current === "partially_paid" ||
        current === "overdue"
      ) {
        return "partially_paid";
      }
      break;
    case "payment_succeeded":
      if (
        current === "open" ||
        current === "awaiting_payment" ||
        current === "partially_paid" ||
        current === "overdue"
      ) {
        return "paid";
      }
      break;
    case "mark_overdue":
      if (
        current === "open" ||
        current === "awaiting_payment" ||
        current === "partially_paid"
      ) {
        return "overdue";
      }
      break;
    case "cancel":
      if (
        current === "draft" ||
        current === "open" ||
        current === "awaiting_payment" ||
        current === "partially_paid" ||
        current === "overdue"
      ) {
        return "canceled";
      }
      break;
    case "partial_refund":
      if (current === "paid" || current === "partially_refunded") {
        return "partially_refunded";
      }
      break;
    case "refund":
      if (current === "paid" || current === "partially_refunded") {
        return "refunded";
      }
      break;
    case "dispute_opened":
      if (current === "paid" || current === "partially_refunded") {
        return "disputed";
      }
      break;
    case "dispute_won":
      if (current === "disputed") return "paid";
      break;
    case "dispute_lost":
      if (current === "disputed") return "refunded";
      break;
  }

  throw new InvalidBillingTransitionError("invoice", current, event.type);
}

export function transitionPaymentState(
  current: PaymentStatus,
  event: PaymentStateEvent,
): PaymentStatus {
  switch (event.type) {
    case "submit":
      if (current === "created") return "pending";
      break;
    case "authorize":
      if (current === "pending") return "authorized";
      break;
    case "confirm":
      if (current === "pending" || current === "authorized") return "paid";
      break;
    case "fail":
      if (current === "pending" || current === "authorized") return "failed";
      break;
    case "cancel":
      if (
        current === "created" ||
        current === "pending" ||
        current === "authorized"
      ) {
        return "canceled";
      }
      break;
    case "partial_refund":
      if (current === "paid" || current === "partially_refunded") {
        return "partially_refunded";
      }
      break;
    case "refund":
      if (current === "paid" || current === "partially_refunded") {
        return "refunded";
      }
      break;
    case "dispute_opened":
      if (current === "paid" || current === "partially_refunded") {
        return "disputed";
      }
      break;
    case "dispute_won":
      if (current === "disputed") return "paid";
      break;
    case "dispute_lost":
      if (current === "disputed") return "refunded";
      break;
  }

  throw new InvalidBillingTransitionError("payment", current, event.type);
}

export function transitionSubscriptionState(
  current: SubscriptionStatus,
  event: SubscriptionStateEvent,
): SubscriptionStatus {
  switch (event.type) {
    case "start_trial":
      if (current === "incomplete") return "trialing";
      break;
    case "activate":
      if (
        current === "incomplete" ||
        current === "trialing" ||
        current === "past_due" ||
        current === "paused"
      ) {
        return "active";
      }
      break;
    case "payment_failed":
      if (current === "trialing" || current === "active") return "past_due";
      break;
    case "pause":
      if (
        current === "trialing" ||
        current === "active" ||
        current === "past_due"
      ) {
        return "paused";
      }
      break;
    case "resume":
      if (current === "paused") return "active";
      break;
    case "cancel":
      if (
        current === "incomplete" ||
        current === "trialing" ||
        current === "active" ||
        current === "past_due" ||
        current === "paused"
      ) {
        return "canceled";
      }
      break;
    case "expire":
      if (
        current === "incomplete" ||
        current === "trialing" ||
        current === "past_due" ||
        current === "paused"
      ) {
        return "expired";
      }
      break;
  }

  throw new InvalidBillingTransitionError("subscription", current, event.type);
}
