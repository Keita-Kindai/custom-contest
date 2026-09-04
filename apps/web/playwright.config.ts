import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command: "pnpm --filter @custom-contest/web start --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100/api/health",
    reuseExistingServer: false,
    timeout: 60_000,
    env: { ...process.env, CUSTOM_CONTEST_ENABLE_FAKE_EVIDENCE: "1" },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
