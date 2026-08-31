export const REAL_MONEY_PAYMENTS_ENABLED = false as const;

export type CurrencyCode = "BRL";

export type Money = Readonly<{
  amountMinor: number;
  currency: CurrencyCode;
}>;

export function createMoney(
  amountMinor: number,
  currency: CurrencyCode = "BRL",
): Money {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
    throw new RangeError("Money must use a non-negative integer amountMinor.");
  }

  return Object.freeze({ amountMinor, currency });
}

export type BillingScope = "platform_saas" | "institution_tuition";

export type PaymentProviderId =
  | "mock"
  | "asaas"
  | "mercado_pago"
  | "stripe";

export type PaymentMethod = "pix" | "boleto" | "card";

export type InvoiceStatus =
  | "draft"
  | "open"
  | "awaiting_payment"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "canceled"
  | "partially_refunded"
  | "refunded"
  | "disputed";

export type PaymentStatus =
  | "created"
  | "pending"
  | "authorized"
  | "paid"
  | "failed"
  | "canceled"
  | "partially_refunded"
  | "refunded"
  | "disputed";

export type SubscriptionStatus =
  | "incomplete"
  | "trialing"
  | "active"
  | "past_due"
  | "paused"
  | "canceled"
  | "expired";

export type InvoiceStateEvent =
  | Readonly<{ type: "issue" }>
  | Readonly<{ type: "payment_started" }>
  | Readonly<{ type: "partial_payment" }>
  | Readonly<{ type: "payment_succeeded" }>
  | Readonly<{ type: "mark_overdue" }>
  | Readonly<{ type: "cancel" }>
  | Readonly<{ type: "partial_refund" }>
  | Readonly<{ type: "refund" }>
  | Readonly<{ type: "dispute_opened" }>
  | Readonly<{ type: "dispute_won" }>
  | Readonly<{ type: "dispute_lost" }>;

export type PaymentStateEvent =
  | Readonly<{ type: "submit" }>
  | Readonly<{ type: "authorize" }>
  | Readonly<{ type: "confirm" }>
  | Readonly<{ type: "fail" }>
  | Readonly<{ type: "cancel" }>
  | Readonly<{ type: "partial_refund" }>
  | Readonly<{ type: "refund" }>
  | Readonly<{ type: "dispute_opened" }>
  | Readonly<{ type: "dispute_won" }>
  | Readonly<{ type: "dispute_lost" }>;

export type SubscriptionStateEvent =
  | Readonly<{ type: "start_trial" }>
  | Readonly<{ type: "activate" }>
  | Readonly<{ type: "payment_failed" }>
  | Readonly<{ type: "pause" }>
  | Readonly<{ type: "resume" }>
  | Readonly<{ type: "cancel" }>
  | Readonly<{ type: "expire" }>;

export type CanonicalInvoice = Readonly<{
  id: string;
  organizationId: string;
  scope: BillingScope;
  status: InvoiceStatus;
  total: Money;
  amountPaid: Money;
  dueAt?: string;
  provider: PaymentProviderId;
  providerReference: string;
  livemode: boolean;
  realMoney: boolean;
}>;

export type CanonicalPayment = Readonly<{
  id: string;
  organizationId: string;
  invoiceId?: string;
  scope: BillingScope;
  status: PaymentStatus;
  grossAmount: Money;
  refundedAmount: Money;
  method: PaymentMethod;
  provider: PaymentProviderId;
  providerReference: string;
  livemode: boolean;
  realMoney: boolean;
}>;

export type CanonicalSubscription = Readonly<{
  id: string;
  organizationId: string;
  customerId: string;
  planCode: string;
  status: SubscriptionStatus;
  currentPeriodEndsAt?: string;
  provider: PaymentProviderId;
  providerReference: string;
  livemode: boolean;
  realMoney: boolean;
}>;
