import { defineConfig, devices } from "@playwright/test";
import {
  BACKEND_ENV,
  BACKEND_URL,
  FRONTEND_PORT,
  FRONTEND_URL,
} from "./support/env.ts";

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./global-setup.ts",

  // One shared test database, so run serially until tests are isolated.
  fullyParallel: false,
  workers: 1,

  reporter: [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: FRONTEND_URL,
    trace: "on-first-retry",
  },

  projects: [
    // Signs in once per run and saves storageState for the admin and agent roles.
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],

  // reuseExistingServer is false on purpose: attaching to a `npm run dev`
  // server would run tests against the dev database. Fail loudly instead.
  webServer: [
    {
      name: "backend",
      command: "node src/index.ts",
      cwd: "../backend",
      url: `${BACKEND_URL}/api/health`,
      env: BACKEND_ENV,
      reuseExistingServer: false,
    },
    {
      name: "frontend",
      command: `npx vite --port ${FRONTEND_PORT} --strictPort`,
      cwd: "../frontend",
      url: FRONTEND_URL,
      env: { API_PROXY_TARGET: BACKEND_URL },
      reuseExistingServer: false,
    },
  ],
});
