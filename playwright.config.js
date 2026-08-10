// @ts-check
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  // Comment/guestbook tests share one local D1 database, so keep them
  // sequential rather than racing each other against the same data.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:8799",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run test:e2e:server",
    url: "http://localhost:8799",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
