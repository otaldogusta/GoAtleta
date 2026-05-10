import { expect, test } from "@playwright/test";

test("web app loads without fatal error", async ({ page, baseURL }) => {
  await page.goto(baseURL || "http://localhost:8081", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.locator("body")).toBeVisible();
  await expect(page.locator("text=Application error")).toHaveCount(0);
  await expect(page.locator("text=Unexpected error")).toHaveCount(0);
});
