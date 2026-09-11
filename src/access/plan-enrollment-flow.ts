export type PlanEnrollmentStep = 1 | 2 | 3;
export type PlanPaymentPreference = "Pix" | "Boleto" | "Cartão";

const DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

const atLocalNoon = (year: number, month: number, day: number) =>
  new Date(year, month, day, 12, 0, 0, 0);

export function getPlanBillingPreview(referenceDate: Date, billingDay: number) {
  const enrollmentDueDate = atLocalNoon(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate() + 1
  );
  const firstCandidate = atLocalNoon(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    billingDay
  );
  const firstMonthlyDueDate = firstCandidate > referenceDate
    ? firstCandidate
    : atLocalNoon(referenceDate.getFullYear(), referenceDate.getMonth() + 1, billingDay);
  const monthlyDueDates = Array.from({ length: 3 }, (_, index) =>
    atLocalNoon(
      firstMonthlyDueDate.getFullYear(),
      firstMonthlyDueDate.getMonth() + index,
      billingDay
    )
  );

  return {
    enrollmentDueDate,
    enrollmentDueLabel: DATE_FORMATTER.format(enrollmentDueDate),
    monthlyDueDates,
    monthlyDueLabels: monthlyDueDates.map((date) => DATE_FORMATTER.format(date)),
  };
}
