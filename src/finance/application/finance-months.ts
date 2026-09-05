export const financeMonthOptions = (
  localInvoiceMonths: string[],
  providerMonths: string[],
  selectedMonth: string,
  currentMonth: string,
) => Array.from(new Set([
  ...localInvoiceMonths, ...providerMonths, selectedMonth, currentMonth,
])).filter((month) => /^\d{4}-(0[1-9]|1[0-2])$/.test(month))
  .sort((left, right) => right.localeCompare(left));
