import type {
  CancelChargeInput,
  CancelSubscriptionInput,
  CanonicalProviderEvent,
  ChargeResult,
  CreateChargeInput,
  CreateCustomerPortalInput,
  CreateMerchantAccountInput,
  CreateReceivablesCustomerInput,
  CreateSubscriptionCheckoutInput,
  HostedProviderAction,
  InstitutionReceivablesCapabilities,
  InstitutionReceivablesProvider,
  MerchantAccountResult,
  PlatformBillingCapabilities,
  PlatformBillingProvider,
  ProviderWebhookRequest,
  ReceivablesCustomerResult,
  RefundPaymentInput,
  RefundPaymentResult,
  SubscriptionCheckoutResult,
  SubscriptionOperationResult,
} from "./providers";
import { transitionInvoiceState } from "./state-machines";
import { REAL_MONEY_PAYMENTS_ENABLED } from "./types";

const MOCK_WEBHOOK_HEADER = "x-goatleta-mock-webhook-token";
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export type LocalMockPaymentsConfig = Readonly<{
  mode: "mock";
  origin: string;
  webhookToken: string;
  allowRealMoney?: false;
}>;

export class UnsafePaymentsConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafePaymentsConfigurationError";
  }
}

function normalizeLocalOrigin(config: LocalMockPaymentsConfig): string {
  const runtimeConfig = config as Readonly<{ allowRealMoney?: boolean }>;
  if (
    REAL_MONEY_PAYMENTS_ENABLED !== false ||
    runtimeConfig.allowRealMoney === true
  ) {
    throw new UnsafePaymentsConfigurationError(
      "Real-money payments are disabled in the local mock provider.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(config.origin);
  } catch {
    throw new UnsafePaymentsConfigurationError(
      "Mock payment origin must be a valid localhost URL.",
    );
  }

  if (
    parsed.protocol !== "http:" ||
    !LOCAL_HOSTNAMES.has(parsed.hostname) ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.search !== "" ||
    parsed.hash !== "" ||
    parsed.pathname.replace(/\/+$/, "") !== ""
  ) {
    throw new UnsafePaymentsConfigurationError(
      "Mock payments can run only on a plain http localhost origin.",
    );
  }

  if (config.webhookToken.trim().length < 16) {
    throw new UnsafePaymentsConfigurationError(
      "Mock webhook token must contain at least 16 characters.",
    );
  }

  return parsed.origin;
}

function assertLocalUrl(value: string, expectedOrigin: string, label: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new UnsafePaymentsConfigurationError(`${label} must be a valid URL.`);
  }

  if (parsed.origin !== expectedOrigin) {
    throw new UnsafePaymentsConfigurationError(
      `${label} must stay on the configured localhost origin.`,
    );
  }
}

function getHeader(
  headers: Readonly<Record<string, string | undefined>>,
  expectedName: string,
): string | undefined {
  const entry = Object.entries(headers).find(
    ([name]) => name.toLowerCase() === expectedName,
  );
  return entry?.[1];
}

function parseMockWebhook(
  input: ProviderWebhookRequest,
  webhookToken: string,
): CanonicalProviderEvent {
  if (getHeader(input.headers, MOCK_WEBHOOK_HEADER) !== webhookToken) {
    throw new UnsafePaymentsConfigurationError(
      "Mock webhook authentication failed.",
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(input.body);
  } catch {
    throw new TypeError("Mock webhook body must contain valid JSON.");
  }

  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new TypeError("Mock webhook payload must be an object.");
  }

  const candidate = payload as Record<string, unknown>;
  const subject = candidate.subject;
  const validSubjectTypes = new Set([
    "invoice",
    "payment",
    "subscription",
    "merchant",
  ]);

  if (
    typeof candidate.eventId !== "string" ||
    candidate.eventId.trim() === "" ||
    typeof candidate.eventType !== "string" ||
    candidate.eventType.trim() === "" ||
    typeof candidate.occurredAt !== "string" ||
    typeof subject !== "object" ||
    subject === null ||
    Array.isArray(subject)
  ) {
    throw new TypeError("Mock webhook payload is missing canonical event fields.");
  }

  const subjectCandidate = subject as Record<string, unknown>;
  if (
    typeof subjectCandidate.type !== "string" ||
    !validSubjectTypes.has(subjectCandidate.type) ||
    typeof subjectCandidate.id !== "string" ||
    subjectCandidate.id.trim() === ""
  ) {
    throw new TypeError("Mock webhook subject is invalid.");
  }

  if (candidate.livemode === true || candidate.realMoney === true) {
    throw new UnsafePaymentsConfigurationError(
      "Mock webhooks cannot represent live or real-money operations.",
    );
  }

  const dataCandidate = candidate.data;
  const data =
    typeof dataCandidate === "object" &&
    dataCandidate !== null &&
    !Array.isArray(dataCandidate)
      ? (dataCandidate as Readonly<Record<string, unknown>>)
      : Object.freeze({});

  return Object.freeze({
    provider: "mock",
    providerReference: candidate.eventId,
    livemode: false,
    realMoney: false,
    eventId: candidate.eventId,
    eventType: candidate.eventType,
    occurredAt: candidate.occurredAt,
    subject: Object.freeze({
      type: subjectCandidate.type as CanonicalProviderEvent["subject"]["type"],
      id: subjectCandidate.id,
    }),
    data,
  });
}

abstract class LocalMockProviderBase {
  readonly provider = "mock" as const;
  protected readonly origin: string;
  private readonly webhookToken: string;
  private sequence = 0;

  protected constructor(config: LocalMockPaymentsConfig) {
    this.origin = normalizeLocalOrigin(config);
    this.webhookToken = config.webhookToken;
  }

  protected nextReference(prefix: string): string {
    this.sequence += 1;
    return `mock_${prefix}_${this.sequence}`;
  }

  protected hostedUrl(
    pathname: string,
    parameters: Readonly<Record<string, string>>,
  ): string {
    const target = new URL(pathname, this.origin);
    for (const [key, value] of Object.entries(parameters)) {
      target.searchParams.set(key, value);
    }
    return target.toString();
  }

  protected requireLocalUrl(value: string, label: string): void {
    assertLocalUrl(value, this.origin, label);
  }

  async parseWebhook(
    input: ProviderWebhookRequest,
  ): Promise<CanonicalProviderEvent> {
    return parseMockWebhook(input, this.webhookToken);
  }
}

export class MockPaymentsProvider
  extends LocalMockProviderBase
  implements PlatformBillingProvider
{
  readonly capabilities: PlatformBillingCapabilities = Object.freeze({
    subscriptions: true,
    customerPortal: true,
    webhooks: true,
    paymentMethods: Object.freeze(["pix", "boleto", "card"] as const),
  });

  private readonly subscriptions = new Map<
    string,
    { organizationId: string; status: "incomplete" | "canceled" }
  >();

  constructor(config: LocalMockPaymentsConfig) {
    super(config);
  }

  async createSubscriptionCheckout(
    input: CreateSubscriptionCheckoutInput,
  ): Promise<SubscriptionCheckoutResult> {
    this.requireLocalUrl(input.successUrl, "Subscription successUrl");
    this.requireLocalUrl(input.cancelUrl, "Subscription cancelUrl");

    const checkoutId = this.nextReference("platform_checkout");
    const subscriptionReference = this.nextReference("platform_subscription");
    this.subscriptions.set(subscriptionReference, {
      organizationId: input.organizationId,
      status: "incomplete",
    });

    return Object.freeze({
      provider: "mock",
      providerReference: checkoutId,
      livemode: false,
      realMoney: false,
      checkoutId,
      subscriptionReference,
      status: "incomplete",
      url: this.hostedUrl("/__goatleta/mock-payments/subscription", {
        checkoutId,
        organizationId: input.organizationId,
        planCode: input.planCode,
      }),
    });
  }

  async createCustomerPortal(
    input: CreateCustomerPortalInput,
  ): Promise<HostedProviderAction> {
    this.requireLocalUrl(input.returnUrl, "Customer portal returnUrl");
    const portalReference = this.nextReference("platform_portal");

    return Object.freeze({
      provider: "mock",
      providerReference: portalReference,
      livemode: false,
      realMoney: false,
      url: this.hostedUrl("/__goatleta/mock-payments/portal", {
        organizationId: input.organizationId,
        customerId: input.customerId,
        portalReference,
      }),
    });
  }

  async cancelSubscription(
    input: CancelSubscriptionInput,
  ): Promise<SubscriptionOperationResult> {
    const subscription = this.subscriptions.get(input.subscriptionReference);
    if (
      subscription === undefined ||
      subscription.organizationId !== input.organizationId
    ) {
      throw new Error("Mock subscription was not found for this organization.");
    }

    subscription.status = "canceled";
    return Object.freeze({
      provider: "mock",
      providerReference: input.subscriptionReference,
      livemode: false,
      realMoney: false,
      subscriptionReference: input.subscriptionReference,
      status: "canceled",
      cancelAtPeriodEnd: input.cancelAtPeriodEnd,
    });
  }
}

export class MockReceivablesProvider
  extends LocalMockProviderBase
  implements InstitutionReceivablesProvider
{
  readonly capabilities: InstitutionReceivablesCapabilities = Object.freeze({
    merchantOnboarding: true,
    splitSettlement: false,
    refunds: true,
    webhooks: true,
    paymentMethods: Object.freeze(["pix", "boleto", "card"] as const),
  });

  private readonly merchants = new Map<string, MerchantAccountResult>();
  private readonly customers = new Map<
    string,
    { organizationId: string; result: ReceivablesCustomerResult }
  >();
  private readonly charges = new Map<
    string,
    { organizationId: string; result: ChargeResult }
  >();

  constructor(config: LocalMockPaymentsConfig) {
    super(config);
  }

  async createMerchantAccount(
    input: CreateMerchantAccountInput,
  ): Promise<MerchantAccountResult> {
    this.requireLocalUrl(input.returnUrl, "Merchant onboarding returnUrl");
    const merchantReference = this.nextReference("merchant");
    const result: MerchantAccountResult = Object.freeze({
      provider: "mock",
      providerReference: merchantReference,
      livemode: false,
      realMoney: false,
      organizationId: input.organizationId,
      merchantReference,
      status: "enabled",
      onboardingUrl: this.hostedUrl("/__goatleta/mock-payments/onboarding", {
        merchantReference,
        organizationId: input.organizationId,
      }),
    });
    this.merchants.set(merchantReference, result);
    return result;
  }

  async getMerchantStatus(
    organizationId: string,
    merchantReference: string,
  ): Promise<MerchantAccountResult> {
    const merchant = this.merchants.get(merchantReference);
    if (merchant === undefined || merchant.organizationId !== organizationId) {
      throw new Error("Mock merchant was not found for this organization.");
    }
    return merchant;
  }

  async createCustomer(
    input: CreateReceivablesCustomerInput,
  ): Promise<ReceivablesCustomerResult> {
    const customerReference = this.nextReference("customer");
    const result: ReceivablesCustomerResult = Object.freeze({
      provider: "mock",
      providerReference: customerReference,
      livemode: false,
      realMoney: false,
      customerReference,
    });
    this.customers.set(customerReference, {
      organizationId: input.organizationId,
      result,
    });
    return result;
  }

  async createCharge(input: CreateChargeInput): Promise<ChargeResult> {
    this.requireLocalUrl(input.returnUrl, "Charge returnUrl");
    const merchant = this.merchants.get(input.merchantReference);
    const customer = this.customers.get(input.customerReference);
    if (
      merchant === undefined ||
      merchant.organizationId !== input.organizationId ||
      customer === undefined ||
      customer.organizationId !== input.organizationId
    ) {
      throw new Error(
        "Mock charge requires a merchant and customer from the same organization.",
      );
    }

    const chargeReference = this.nextReference("charge");
    const result: ChargeResult = Object.freeze({
      provider: "mock",
      providerReference: chargeReference,
      livemode: false,
      realMoney: false,
      chargeReference,
      externalInvoiceId: input.externalInvoiceId,
      amount: input.amount,
      status: "open",
      hostedPaymentUrl: this.hostedUrl("/__goatleta/mock-payments/charge", {
        chargeReference,
        externalInvoiceId: input.externalInvoiceId,
        method: input.method,
      }),
    });
    this.charges.set(chargeReference, {
      organizationId: input.organizationId,
      result,
    });
    return result;
  }

  async cancelCharge(input: CancelChargeInput): Promise<ChargeResult> {
    const charge = this.charges.get(input.chargeReference);
    if (
      charge === undefined ||
      charge.organizationId !== input.organizationId
    ) {
      throw new Error("Mock charge was not found for this organization.");
    }

    const canceled: ChargeResult = Object.freeze({
      ...charge.result,
      status: transitionInvoiceState(charge.result.status, { type: "cancel" }),
    });
    this.charges.set(input.chargeReference, {
      organizationId: input.organizationId,
      result: canceled,
    });
    return canceled;
  }

  async refundPayment(
    input: RefundPaymentInput,
  ): Promise<RefundPaymentResult> {
    const refundReference = this.nextReference("refund");
    return Object.freeze({
      provider: "mock",
      providerReference: refundReference,
      livemode: false,
      realMoney: false,
      paymentReference: input.paymentReference,
      refundReference,
      amount: input.amount,
      status: "refunded",
    });
  }
}
