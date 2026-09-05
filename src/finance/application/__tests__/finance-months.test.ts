import { financeMonthOptions } from "../finance-months";

describe("financial month navigation", () => {
  it("keeps months that have only imported Asaas history", () => {
    expect(financeMonthOptions([], ["2026-08", "2026-07"], "2026-09", "2026-09"))
      .toEqual(["2026-09", "2026-08", "2026-07"]);
  });
  it("keeps the selected month and deduplicates local/provider history", () => {
    expect(financeMonthOptions(["2026-08", "2026-07"], ["2026-08", "invalid"], "2026-06", "2026-09"))
      .toEqual(["2026-09", "2026-08", "2026-07", "2026-06"]);
  });
});
