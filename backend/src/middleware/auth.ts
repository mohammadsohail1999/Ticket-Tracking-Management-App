import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import auth from "../lib/auth.ts";

type SessionResult = Awaited<ReturnType<typeof auth.api.getSession>>;

declare global {
  namespace Express {
    interface Request {
      user?: NonNullable<SessionResult>["user"];
      session?: NonNullable<SessionResult>["session"];
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!result) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    req.user = result.user;
    req.session = result.session;
    next();
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = req.user?.role;
    if (!role || !allowedRoles.includes(role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}
