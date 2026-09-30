import { execFileSync } from "node:child_process";
import { TEST_DATABASE_URL } from "./env.ts";

// Password-reset emails are console.log stubs, so there is no inbox. Better
// Auth stores the token in plain text as `reset-password:<token>` in the
// `verification` table (value = user id), so tests read it straight from the
// test DB (read-only SELECT). Only valid while the app keeps plain identifiers.
export function readPasswordResetToken(email: string): string {
  const out = execFileSync(
    "psql",
    [TEST_DATABASE_URL.replace(/\?.*$/, ""), "-v", "ON_ERROR_STOP=1", "-v", `email=${email}`, "-tA"],
    {
      encoding: "utf8",
      input: `SELECT v.identifier FROM verification v JOIN "user" u ON u.id = v.value
              WHERE u.email = :'email' AND v.identifier LIKE 'reset-password:%'
              ORDER BY v."createdAt" DESC LIMIT 1;`,
    },
  ).trim();
  if (!out) throw new Error(`No password-reset token found for ${email}`);
  return out.slice("reset-password:".length);
}
