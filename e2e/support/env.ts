import os from "node:os";

// Single source of truth for the E2E environment. Imported by the Playwright
// config, global setup and the db scripts.

const defaultDatabaseUrl = `postgresql://${encodeURIComponent(os.userInfo().username)}@localhost:5432/ticket_tracking_test?schema=public`;

export const TEST_DATABASE_URL = process.env.E2E_DATABASE_URL ?? defaultDatabaseUrl;
export const TEST_DATABASE_NAME = new URL(TEST_DATABASE_URL).pathname.slice(1);

// Safety guard, evaluated on import: everything here wipes and reseeds the
// database, so refuse to run against anything that isn't clearly a test DB
// (e.g. an E2E_DATABASE_URL accidentally pointing at ticket_tracking_dev).
// The strict charset also makes the name safe to interpolate into CREATE DATABASE.
if (!/^[a-z0-9_]+_test$/.test(TEST_DATABASE_NAME)) {
  throw new Error(
    `Refusing to run E2E against database "${TEST_DATABASE_NAME}": ` +
      `the name must be lowercase letters/digits/underscores and end in "_test".`,
  );
}

// Ports differ from the dev servers (4000 / 5173, and Vite's 5174 fallback)
// so the E2E stack can run alongside `npm run dev`.
export const BACKEND_PORT = 4100;
export const FRONTEND_PORT = 5273;
export const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
export const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`;

export const E2E_USERS = {
  admin: { email: "admin@example.com", password: "Test@123", name: "Admin" },
  agent: { email: "agent@example.com", password: "Test@123", name: "Support Agent" },
} as const;

// Env for every backend-side process (API server, prisma migrate, seed).
// dotenv never overrides variables that are already set, so these win over
// backend/.env and the dev database URL in it.
//
// NODE_ENV=development turns Better Auth's rate limiter off (see
// backend/src/lib/auth.ts) so repeated logins in tests don't hit 429.
export const BACKEND_ENV: Record<string, string> = {
  DATABASE_URL: TEST_DATABASE_URL,
  PORT: String(BACKEND_PORT),
  NODE_ENV: "development",
  BETTER_AUTH_SECRET: "e2e-test-secret-not-used-anywhere-else-0123456789",
  BETTER_AUTH_URL: BACKEND_URL,
  FRONTEND_URL,
  ADMIN_EMAIL: E2E_USERS.admin.email,
  ADMIN_PASSWORD: E2E_USERS.admin.password,
  ADMIN_NAME: E2E_USERS.admin.name,
  AGENT_EMAIL: E2E_USERS.agent.email,
  AGENT_PASSWORD: E2E_USERS.agent.password,
  AGENT_NAME: E2E_USERS.agent.name,
};
