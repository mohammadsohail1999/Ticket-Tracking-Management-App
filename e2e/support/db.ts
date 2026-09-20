import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BACKEND_ENV, TEST_DATABASE_NAME, TEST_DATABASE_URL } from "./env.ts";

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../backend");

// Same server as the test DB, but the always-present `postgres` maintenance DB,
// and without Prisma's `?schema=` param (libpq rejects unknown URI parameters).
function maintenanceUrl() {
  const url = new URL(TEST_DATABASE_URL);
  url.pathname = "/postgres";
  url.search = "";
  return url.toString();
}

function ensureDatabaseExists() {
  const psql = (sql: string) =>
    execFileSync("psql", [maintenanceUrl(), "-v", "ON_ERROR_STOP=1", "-tAc", sql], {
      encoding: "utf8",
    }).trim();

  const exists = psql(`SELECT 1 FROM pg_database WHERE datname = '${TEST_DATABASE_NAME}'`);
  if (!exists) {
    console.log(`[e2e] creating database ${TEST_DATABASE_NAME}`);
    psql(`CREATE DATABASE "${TEST_DATABASE_NAME}"`);
  }
}

function runInBackend(command: string, args: string[]) {
  execFileSync(command, args, {
    cwd: backendDir,
    env: { ...process.env, ...BACKEND_ENV },
    stdio: "inherit",
  });
}

// Bring the test database to a known state: created, fully migrated, and
// reseeded with the admin + agent users. Safe to run repeatedly; seed.ts wipes
// the auth tables first. Never touches any other database (see env.ts guard).
export function prepareTestDatabase() {
  ensureDatabaseExists();
  // `migrate deploy`, not `migrate dev` — the only migration command that's
  // non-interactive and never resets/creates migrations.
  runInBackend("npx", ["prisma", "migrate", "deploy"]);
  runInBackend("node", ["prisma/seed.ts"]);
}
