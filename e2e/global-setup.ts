import { prepareTestDatabase } from "./support/db.ts";

// Runs once before every `playwright test`, after the webServers are up
// (Playwright starts them first; the backend connects to the DB lazily).
export default function globalSetup() {
  prepareTestDatabase();
}
