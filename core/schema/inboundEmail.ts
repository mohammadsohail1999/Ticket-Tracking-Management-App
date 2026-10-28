import * as z from "zod";

// Normalized inbound email accepted by POST /api/inbound/email. Provider
// webhooks (Postmark, SendGrid, ...) are mapped onto this shape by an adapter,
// so the ticket logic never sees provider-specific payloads.
// Same TS rules as core/schema/user.ts: `.ts` extensions, no enum/namespace.

export const inboundEmailSchema = z
  .object({
    messageId: z.string().trim().min(1, "messageId is required."),
    from: z.object({
      email: z.email("Enter a valid email address."),
      name: z.string().trim().optional(),
    }),
    subject: z
      .string()
      .trim()
      .default("")
      .transform((subject) => subject || "(no subject)"),
    text: z.string().optional(),
    html: z.string().optional(),
    inReplyTo: z.string().trim().optional(),
    references: z.array(z.string().trim()).default([]),
    receivedAt: z.iso.datetime({ offset: true }).optional(),
  })
  .refine((email) => email.text?.trim() || email.html?.trim(), {
    message: "Either text or html body is required.",
    path: ["text"],
  });

export type InboundEmailBody = z.infer<typeof inboundEmailSchema>;
