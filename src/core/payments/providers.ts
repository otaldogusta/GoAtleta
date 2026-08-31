import type {
  InvoiceStatus,
  Money,
  PaymentMethod,
  PaymentProviderId,
  PaymentStatus,
  SubscriptionStatus,
} from "./types";

export type ProviderExecutionMetadata = Readonly<{
  provider: PaymentProviderId;
  providerReference: string;
  livemode: boolean;
  realMoney: boolean;
}>;

export type HostedProviderAction = ProviderExecutionMetadata &
  Readonly<{
    url: string;
    expiresAt?: string;
  }>;

export type ProviderWebhookRequest = Readonly<{
  headers: Readonly<Record<string, string | undefined>>;
  body: string;
  receivedAt: string;
}>;

export type CanonicalProviderEvent = ProviderExecutionMetadata &
  Readonly<{
    eventId: string;
    eventType: string;
    occurredAt: string;
    subject: Readonly<{
      type: "invoice" | "payment" | "subscription" | "merchant";
      id: string;
    }>;
    data: Readonly<Record<string, unknown>>;
  }>;

export type PlatformBillingCapabilities = Readonly<{
  subscriptions: boolean;
  customerPortal: boolean;
  webhooks: boolean;
  paymentMethods: readonly PaymentMethod[];
}>;

export type InstitutionReceivablesCapabilities = Readonly<{
  merchantOnboarding: boolean;
  splitSettlement: boolean;
  refunds: boolean;
  webhooks: boolean;
  paymentMethods: readonly PaymentMethod[];
}>;

export type CreateSubscriptionCheckoutInput = Readonly<{
  organizationId: string;
  customerId: string;
  planCode: string;
  successUrl: string;
  cancelUrl: string;
}>;

export type SubscriptionCheckoutResult = HostedProviderAction &
  Readonly<{
    checkoutId: string;
    subscriptionReference: string;
    status: SubscriptionStatus;
  }>;

export type CreateCustomerPortalInput = Readonly<{
  organizationId: string;
  customerId: string;
  returnUrl: string;
}>;

export type CancelSubscriptionInput = Readonly<{
  organizationId: string;
  subscriptionReference: string;
  cancelAtPeriodEnd: boolean;
}>;

export type SubscriptionOperationResult = ProviderExecutionMetadata &
  Readonly<{
    subscriptionReference: string;
    status: SubscriptionStatus;
    cancelAtPeriodEnd: boolean;
  }>;

export interface PlatformBillingProvider {
  readonly provider: PaymentProviderId;
  readonly capabilities: PlatformBillingCapabilities;

  createSubscriptionCheckout(
    input: CreateSubscriptionCheckoutInput,
  ): Promise<SubscriptionCheckoutResult>;

  createCustomerPortal(
    input: CreateCustomerPortalInput,
  ): Promise<HostedProviderAction>;

  cancelSubscription(
    input: CancelSubscriptionInput,
  ): Promise<SubscriptionOperationResult>;

  parseWebhook(input: ProviderWebhookRequest): Promise<CanonicalProviderEvent>;
}

export type MerchantAccountStatus =
  | "pending"
  | "enabled"
  | "restricted"
  | "disabled";

export type CreateMerchantAccountInput = Readonly<{
  organizationId: string;
  legalName: string;
  returnUrl: string;
}>;

export type MerchantAccountResult = ProviderExecutionMetadata &
  Readonly<{
    organizationId: string;
    merchantReference: string;
    status: MerchantAccountStatus;
    onboardingUrl?: string;
  }>;

export type CreateReceivablesCustomerInput = Readonly<{
  organizationId: string;
  externalCustomerId: string;
  name: string;
  email?: string;
  taxId?: string;
}>;

export type ReceivablesCustomerResult = ProviderExecutionMetadata &
  Readonly<{
    customerReference: string;
  }>;

export type CreateChargeInput = Readonly<{
  organizationId: string;
  merchantReference: string;
  customerReference: string;
  externalInvoiceId: string;
  amount: Money;
  dueAt: string;
  method: PaymentMethod;
  description: string;
  returnUrl: string;
}>;

export type ChargeResult = ProviderExecutionMetadata &
  Readonly<{
    chargeReference: string;
    externalInvoiceId: string;
    amount: Money;
    status: InvoiceStatus;
    hostedPaymentUrl?: string;
  }>;

export type CancelChargeInput = Readonly<{
  organizationId: string;
  chargeReference: string;
}>;

export type RefundPaymentInput = Readonly<{
  organizationId: string;
  paymentReference: string;
  amount: Money;
  reason?: string;
}>;

export type RefundPaymentResult = ProviderExecutionMetadata &
  Readonly<{
    paymentReference: string;
    refundReference: string;
    amount: Money;
    status: PaymentStatus;
  }>;

export interface InstitutionReceivablesProvider {
  readonly provider: PaymentProviderId;
  readonly capabilities: InstitutionReceivablesCapabilities;

  createMerchantAccount(
    input: CreateMerchantAccountInput,
  ): Promise<MerchantAccountResult>;

  getMerchantStatus(
    organizationId: string,
    merchantReference: string,
  ): Promise<MerchantAccountResult>;

  createCustomer(
    input: CreateReceivablesCustomerInput,
  ): Promise<ReceivablesCustomerResult>;

  createCharge(input: CreateChargeInput): Promise<ChargeResult>;

  cancelCharge(input: CancelChargeInput): Promise<ChargeResult>;

  refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult>;

  parseWebhook(input: ProviderWebhookRequest): Promise<CanonicalProviderEvent>;
}
