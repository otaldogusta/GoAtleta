const { defineConfig } = require("@playwright/test");

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8081";

module.exports = defineConfig({
  testDir: "./e2e/web",
  timeout: 30_000,
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
});
