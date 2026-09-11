import { getPlanBillingPreview } from "../plan-enrollment-flow";

it("builds enrollment and monthly due dates from the selected billing day", () => {
  const preview = getPlanBillingPreview(new Date(2026, 8, 10, 12), 10);

  expect(preview.enrollmentDueLabel).toBe("11 de setembro de 2026");
  expect(preview.monthlyDueLabels).toEqual([
    "10 de outubro de 2026",
    "10 de novembro de 2026",
    "10 de dezembro de 2026",
  ]);
});

it("uses the current month when the selected day is still ahead", () => {
  const preview = getPlanBillingPreview(new Date(2026, 8, 10, 12), 15);
  expect(preview.monthlyDueLabels[0]).toBe("15 de setembro de 2026");
});
