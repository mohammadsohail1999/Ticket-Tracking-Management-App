import { test, expect } from "../support/fixtures.ts";
import { uniqueEmail } from "../support/auth.ts";
import {
  INBOUND_SECRET,
  SUPPORT_ADDRESS,
  countTicketMessages,
  countTicketsBySender,
  getFirstMessageBody,
  getTicketStatus,
  inboundEmail,
  postInbound,
  setTicketStatus,
  uniqueMessageId,
} from "../support/inbound.ts";

type Created = { ticketId: string; ticketNumber: number; created: true };

test.describe("Inbound email webhook: shared-secret guard", () => {
  test("rejects a request with no secret header", async ({ anonApi }) => {
    const res = await postInbound(anonApi, inboundEmail(), {});
    expect(res.status()).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  test("rejects a wrong secret, including one of a different length", async ({ anonApi }) => {
    for (const secret of ["wrong-secret", `${INBOUND_SECRET}x`, INBOUND_SECRET.slice(0, -1)]) {
      const res = await postInbound(anonApi, inboundEmail(), { "X-Inbound-Secret": secret });
      expect(res.status(), secret).toBe(401);
      expect(await res.json()).toEqual({ error: "Unauthorized" });
    }
  });

  test("a signed-in admin session does not substitute for the secret", async ({ adminApi }) => {
    const res = await postInbound(adminApi, inboundEmail(), {});
    expect(res.status()).toBe(401);
  });

  test("an unauthorized request creates no ticket", async ({ anonApi }) => {
    const sender = uniqueEmail("unauth");
    await postInbound(anonApi, inboundEmail({ from: { email: sender } }), { "X-Inbound-Secret": "nope" });
    expect(countTicketsBySender(sender)).toBe(0);
  });

  test("the secret is checked before the body is validated", async ({ anonApi }) => {
    const res = await postInbound(anonApi, { nonsense: true }, {});
    expect(res.status()).toBe(401);
  });
});

test.describe("Inbound email webhook: new tickets", () => {
  test("a valid new email creates a ticket", async ({ anonApi }) => {
    const sender = uniqueEmail("student");
    const res = await postInbound(anonApi, inboundEmail({ from: { email: sender, name: "Sam" } }));

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body).toEqual({
      ticketId: expect.any(String),
      ticketNumber: expect.any(Number),
      created: true,
    });
    expect(countTicketsBySender(sender)).toBe(1);
  });

  test("two new emails get distinct tickets with increasing numbers", async ({ anonApi }) => {
    const first = (await (await postInbound(anonApi, inboundEmail())).json()) as Created;
    const second = (await (await postInbound(anonApi, inboundEmail())).json()) as Created;

    expect(second.ticketId).not.toBe(first.ticketId);
    expect(second.ticketNumber).toBeGreaterThan(first.ticketNumber);
  });

  test("an HTML-only body is accepted and stored as plain text", async ({ anonApi }) => {
    const res = await postInbound(
      anonApi,
      inboundEmail({
        text: undefined,
        html: "<p>Hello <b>team</b></p><script>alert(1)</script><p>Need help &amp; fast</p>",
      }),
    );

    expect(res.status()).toBe(201);
    const { ticketId } = (await res.json()) as Created;
    const stored = getFirstMessageBody(ticketId);
    expect(stored).toContain("Hello team");
    expect(stored).toContain("Need help & fast");
    expect(stored).not.toMatch(/<|alert\(1\)/);
  });

  test("a missing subject falls back to a placeholder and still creates a ticket", async ({ anonApi }) => {
    const res = await postInbound(anonApi, inboundEmail({ subject: undefined }));
    expect(res.status()).toBe(201);
  });

  test("an email from the support address (any casing) is ignored", async ({ anonApi }) => {
    for (const address of [SUPPORT_ADDRESS, SUPPORT_ADDRESS.toUpperCase(), "Support@Example.com"]) {
      const res = await postInbound(anonApi, inboundEmail({ from: { email: address } }));
      expect(res.status(), address).toBe(202);
      expect(await res.json()).toEqual({ ignored: true });
    }
    expect(countTicketsBySender(SUPPORT_ADDRESS)).toBe(0);
  });
});

test.describe("Inbound email webhook: idempotency", () => {
  test("resending the same messageId is a duplicate on the same ticket", async ({ anonApi }) => {
    const payload = inboundEmail();
    const first = (await (await postInbound(anonApi, payload)).json()) as Created;

    const res = await postInbound(anonApi, payload);
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({
      ticketId: first.ticketId,
      ticketNumber: first.ticketNumber,
      created: false,
      duplicate: true,
    });
    expect(countTicketMessages(first.ticketId)).toBe(1);
  });

  test("a duplicate messageId from a different sender still maps to the original ticket", async ({ anonApi }) => {
    const payload = inboundEmail();
    const first = (await (await postInbound(anonApi, payload)).json()) as Created;

    const res = await postInbound(anonApi, { ...payload, from: { email: uniqueEmail("other") } });
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ ticketId: first.ticketId, duplicate: true });
  });
});

test.describe("Inbound email webhook: threading", () => {
  test("a reply with inReplyTo joins the original ticket", async ({ anonApi }) => {
    const original = inboundEmail();
    const first = (await (await postInbound(anonApi, original)).json()) as Created;

    const res = await postInbound(
      anonApi,
      inboundEmail({ from: original.from, subject: "Re: Cannot access my course", inReplyTo: original.messageId }),
    );

    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({
      ticketId: first.ticketId,
      ticketNumber: first.ticketNumber,
      created: false,
    });
    expect(countTicketMessages(first.ticketId)).toBe(2);
  });

  test("a reply whose references list contains the original messageId joins the ticket", async ({ anonApi }) => {
    const original = inboundEmail();
    const first = (await (await postInbound(anonApi, original)).json()) as Created;

    const res = await postInbound(
      anonApi,
      inboundEmail({ from: original.from, references: [uniqueMessageId(), original.messageId] }),
    );

    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ ticketId: first.ticketId, created: false });
  });

  test("an unknown inReplyTo starts a new ticket", async ({ anonApi }) => {
    const res = await postInbound(anonApi, inboundEmail({ inReplyTo: uniqueMessageId() }));
    expect(res.status()).toBe(201);
  });

  test("a [#N] subject token from the original sender (any email casing) joins that ticket", async ({ anonApi }) => {
    const sender = uniqueEmail("student");
    const first = (await (
      await postInbound(anonApi, inboundEmail({ from: { email: sender } }))
    ).json()) as Created;

    const res = await postInbound(
      anonApi,
      inboundEmail({
        from: { email: sender.toUpperCase() },
        subject: `Re: [#${first.ticketNumber}] Cannot access my course`,
      }),
    );

    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({
      ticketId: first.ticketId,
      ticketNumber: first.ticketNumber,
      created: false,
    });
    expect(countTicketMessages(first.ticketId)).toBe(2);
  });

  test("a [#N] subject token from a different sender opens a new ticket instead of hijacking", async ({ anonApi }) => {
    const first = (await (await postInbound(anonApi, inboundEmail())).json()) as Created;

    const res = await postInbound(
      anonApi,
      inboundEmail({
        from: { email: uniqueEmail("attacker") },
        subject: `Re: [#${first.ticketNumber}] anything`,
        text: "injected",
      }),
    );

    expect(res.status()).toBe(201);
    const second = (await res.json()) as Created;
    expect(second.ticketId).not.toBe(first.ticketId);
    expect(countTicketMessages(first.ticketId)).toBe(1);
  });

  test("a [#N] token for a nonexistent or out-of-range ticket opens a new ticket", async ({ anonApi }) => {
    for (const token of ["[#2147483647]", "[#99999999999999999999]"]) {
      const res = await postInbound(anonApi, inboundEmail({ subject: `Re: ${token} help` }));
      expect(res.status(), token).toBe(201);
    }
  });
});

test.describe("Inbound email webhook: ticket status on reply", () => {
  for (const status of ["resolved", "closed"] as const) {
    test(`a reply reopens a ${status} ticket`, async ({ anonApi }) => {
      const original = inboundEmail();
      const { ticketId } = (await (await postInbound(anonApi, original)).json()) as Created;
      setTicketStatus(ticketId, status);
      expect(getTicketStatus(ticketId)).toBe(status);

      const res = await postInbound(
        anonApi,
        inboundEmail({ from: original.from, inReplyTo: original.messageId, text: "Still broken" }),
      );

      expect(res.status()).toBe(200);
      expect(getTicketStatus(ticketId)).toBe("open");
      expect(countTicketMessages(ticketId)).toBe(2);
    });
  }

  test("a reply leaves a pending ticket pending", async ({ anonApi }) => {
    const original = inboundEmail();
    const { ticketId } = (await (await postInbound(anonApi, original)).json()) as Created;
    setTicketStatus(ticketId, "pending");

    await postInbound(anonApi, inboundEmail({ from: original.from, inReplyTo: original.messageId }));

    expect(getTicketStatus(ticketId)).toBe("pending");
  });
});

test.describe("Inbound email webhook: payload validation", () => {
  test("rejects a body with neither text nor html", async ({ anonApi }) => {
    const res = await postInbound(anonApi, inboundEmail({ text: undefined, html: undefined }));
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.details.fieldErrors.text).toEqual([expect.stringMatching(/text or html/i)]);
    expect(typeof body.error).toBe("string");
  });

  test("rejects an invalid sender email", async ({ anonApi }) => {
    const res = await postInbound(anonApi, inboundEmail({ from: { email: "not-an-email" } }));
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/from\.email/);
    expect(body.details.fieldErrors.from).toBeDefined();
  });

  test("rejects a missing messageId", async ({ anonApi }) => {
    const res = await postInbound(anonApi, inboundEmail({ messageId: undefined }));
    expect(res.status()).toBe(400);
    expect((await res.json()).details.fieldErrors.messageId).toBeDefined();
  });

  test("rejects a malformed receivedAt", async ({ anonApi }) => {
    const res = await postInbound(anonApi, inboundEmail({ receivedAt: "yesterday" }));
    expect(res.status()).toBe(400);
  });

});
