import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

// Guards the inbound email webhook, which is called by an email provider
// rather than a signed-in user. An unset INBOUND_EMAIL_SECRET disables the
// endpoint (503) instead of leaving it open.
export function requireInboundSecret(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.INBOUND_EMAIL_SECRET;
  if (!secret) {
    res.status(503).json({ error: "Inbound email is not configured" });
    return;
  }

  const provided = req.get("x-inbound-secret") ?? "";
  const expected = Buffer.from(secret);
  const actual = Buffer.from(provided);
  // timingSafeEqual throws on unequal lengths, so check that first.
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
