import {
  APP_DISPLAY_NAME,
  APP_PRODUCT_LABELS,
  APP_PRO_DISPLAY_NAME,
} from "../brand";

describe("Go Atleta public brand", () => {
  test("keeps the official public name and product labels spaced", () => {
    expect(APP_DISPLAY_NAME).toBe("Go Atleta");
    expect(APP_PRO_DISPLAY_NAME).toBe("Go Atleta Pro");
    expect(APP_PRODUCT_LABELS).toEqual({
      goatleta: "Go Atleta",
      goatleta_pro: "Go Atleta Pro",
    });
  });
});
