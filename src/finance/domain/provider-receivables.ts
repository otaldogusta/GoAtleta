export type OrganizationProviderReceivable = {
  id: string;
  customerName: string;
  providerStatus: string;
  billingType: string;
  amountCents: number;
  netAmountCents: number;
  dueDate: string | null;
  paidAt: string | null;
  matchStatus: "matched" | "ambiguous" | "unmatched";
  invoiceId: string | null;
  importedAt: string;
};

export type ProviderReceivablesSummary = {
  totalCount: number;
  receivedCount: number;
  receivedGrossCents: number;
  receivedNetCents: number;
  identifiedCustomerCount: number;
  reconciliationCount: number;
};

export type OrganizationProviderReceivablesPage = {
  connectionId: string | null;
  items: OrganizationProviderReceivable[];
  summary: ProviderReceivablesSummary;
  months: string[];
  quarantinedCount: number;
};
