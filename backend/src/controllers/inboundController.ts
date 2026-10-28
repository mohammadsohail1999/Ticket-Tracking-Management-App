import type { Request, Response } from "express";
import prisma from "../lib/prisma.ts";
import { Prisma } from "../generated/prisma/client.ts";
import type { InboundEmailBody } from "../../../core/schema/inboundEmail.ts";

type TicketRef = { id: string; number: number };

// req.body is already parsed by validate(inboundEmailSchema) on the route.
export async function receiveEmail(req: Request<unknown, unknown, InboundEmailBody>, res: Response) {
  const email = req.body;
  const fromEmail = email.from.email.toLowerCase();

  // Our own outbound mail bouncing back in must not open tickets.
  const supportAddress = process.env.SUPPORT_EMAIL_ADDRESS?.toLowerCase();
  if (supportAddress && fromEmail === supportAddress) {
    res.status(202).json({ ignored: true });
    return;
  }

  // Providers retry webhooks, so a Message-ID we've already stored is a no-op.
  const existing = await findTicketByMessageId(email.messageId);
  if (existing) {
    res.status(200).json(duplicateResponse(existing));
    return;
  }

  const body = email.text?.trim() || htmlToText(email.html ?? "");
  const createdAt = email.receivedAt ? new Date(email.receivedAt) : undefined;
  const message = {
    authorType: "student" as const,
    fromEmail,
    body,
    messageId: email.messageId,
    createdAt,
  };

  try {
    const thread = await findThread(email, fromEmail);
    if (thread) {
      await prisma.$transaction([
        prisma.ticketMessage.create({ data: { ...message, ticketId: thread.id } }),
        // A reply on a finished ticket means the student still needs help.
        prisma.ticket.updateMany({
          where: { id: thread.id, status: { in: ["resolved", "closed"] } },
          data: { status: "open" },
        }),
      ]);
      res.status(200).json({ ticketId: thread.id, ticketNumber: thread.number, created: false });
      return;
    }

    const ticket = await prisma.ticket.create({
      data: {
        subject: email.subject,
        senderEmail: fromEmail,
        senderName: email.from.name || null,
        createdAt,
        messages: { create: message },
      },
      select: { id: true, number: true },
    });
    res.status(201).json({ ticketId: ticket.id, ticketNumber: ticket.number, created: true });
  } catch (err) {
    // A concurrent retry of the same email won the race on the unique messageId.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const winner = await findTicketByMessageId(email.messageId);
      if (winner) {
        res.status(200).json(duplicateResponse(winner));
        return;
      }
    }
    throw err;
  }
}

async function findTicketByMessageId(messageId: string): Promise<TicketRef | null> {
  const message = await prisma.ticketMessage.findUnique({
    where: { messageId },
    select: { ticket: { select: { id: true, number: true } } },
  });
  return message?.ticket ?? null;
}

function duplicateResponse(ticket: TicketRef) {
  return { ticketId: ticket.id, ticketNumber: ticket.number, created: false, duplicate: true };
}

// Threads a reply onto an existing ticket: first by mail headers, then by a
// "[#42]" subject token. The subject token is only trusted from the ticket's
// original sender, so nobody can append to another student's ticket by
// guessing its number.
async function findThread(email: InboundEmailBody, fromEmail: string): Promise<TicketRef | null> {
  const headerIds = [email.inReplyTo, ...email.references].filter((id): id is string => !!id);
  if (headerIds.length) {
    const message = await prisma.ticketMessage.findFirst({
      where: { messageId: { in: headerIds } },
      select: { ticket: { select: { id: true, number: true } } },
    });
    if (message) return message.ticket;
  }

  const token = /\[#(\d+)\]/.exec(email.subject);
  if (token) {
    const number = Number(token[1]);
    if (Number.isSafeInteger(number) && number <= 2_147_483_647) {
      const ticket = await prisma.ticket.findUnique({
        where: { number },
        select: { id: true, number: true, senderEmail: true },
      });
      if (ticket && ticket.senderEmail === fromEmail) {
        return { id: ticket.id, number: ticket.number };
      }
    }
  }

  return null;
}

// Fallback for HTML-only emails. The stored body is plain text; nothing here
// is ever rendered as HTML.
function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
