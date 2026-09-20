import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TEST_DATABASE_NAME, TEST_DATABASE_URL } from "../support/env.ts";

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../backend");

console.log(`[e2e] opening Prisma Studio on ${TEST_DATABASE_NAME}`);

// prisma7.config.ts reads DATABASE_URL via dotenv, which doesn't override an
// already-set variable, so this points Studio at the test DB, not backend/.env's.
const { status } = spawnSync("npx", ["prisma", "studio"], {
  cwd: backendDir,
  env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  stdio: "inherit",
});

process.exit(status ?? 1);
