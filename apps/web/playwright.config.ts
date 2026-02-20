import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command:
      "NEXT_PUBLIC_STREAM_MODE=offline NEXT_PUBLIC_MAP_MODE=offline NEXT_PUBLIC_E2E_SEED=true npm run dev -- --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: true,
    cwd: __dirname,
    timeout: 120_000,
  },
});
