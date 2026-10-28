import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import type { APIRequestContext } from "@playwright/test";
import { BACKEND_ENV, TEST_DATABASE_URL } from "./env.ts";
import { uniqueEmail } from "./auth.ts";

export const INBOUND_SECRET = BACKEND_ENV.INBOUND_EMAIL_SECRET;
export const SUPPORT_ADDRESS = BACKEND_ENV.SUPPORT_EMAIL_ADDRESS;

export type InboundPayload = Record<string, unknown>;

export function uniqueMessageId() {
  return `<${Date.now()}.${randomBytes(4).toString("hex")}@mail.example.com>`;
}

export function inboundEmail(overrides: InboundPayload = {}): InboundPayload {
  return {
    messageId: uniqueMessageId(),
    from: { email: uniqueEmail("student"), name: "Student" },
    subject: "Cannot access my course",
    text: "Hello, I cannot open the course page.",
    ...overrides,
  };
}

export function postInbound(
  api: APIRequestContext,
  payload: InboundPayload,
  headers: Record<string, string> = { "X-Inbound-Secret": INBOUND_SECRET },
) {
  return api.post("/api/inbound/email", { data: payload, headers });
}

// The test DB has no ticket API yet, so ticket state is read/written directly
// with psql (same approach as reset-token.ts). Test DB only; ids are uuids from
// the webhook response, never user-controlled text.
function psql(sql: string): string {
  return execFileSync("psql", [TEST_DATABASE_URL.replace(/\?.*$/, ""), "-v", "ON_ERROR_STOP=1", "-tA"], {
    encoding: "utf8",
    input: sql,
  }).trim();
}

const uuid = /^[0-9a-f-]{36}$/;
function assertUuid(id: string) {
  if (!uuid.test(id)) throw new Error(`Not a ticket id: ${id}`);
}

export function setTicketStatus(ticketId: string, status: "open" | "pending" | "resolved" | "closed") {
  assertUuid(ticketId);
  psql(`UPDATE ticket SET status = '${status}' WHERE id = '${ticketId}';`);
}

export function getTicketStatus(ticketId: string): string {
  assertUuid(ticketId);
  return psql(`SELECT status FROM ticket WHERE id = '${ticketId}';`);
}

export function countTicketMessages(ticketId: string): number {
  assertUuid(ticketId);
  return Number(psql(`SELECT count(*) FROM ticket_message WHERE "ticketId" = '${ticketId}';`));
}

export function getFirstMessageBody(ticketId: string): string {
  assertUuid(ticketId);
  return psql(`SELECT body FROM ticket_message WHERE "ticketId" = '${ticketId}' ORDER BY "createdAt", id LIMIT 1;`);
}

export function countTicketsBySender(email: string): number {
  return Number(psql(`SELECT count(*) FROM ticket WHERE "senderEmail" = '${email.replaceAll("'", "''")}';`));
}
