import type { NextFunction, Request, Response } from "express";
import { APIError } from "better-auth";
import { AppError } from "../lib/errors.ts";

const isDev = process.env.NODE_ENV !== "production";

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  console.error(err);

  const { status, message } = resolveResponse(err);

  res.status(status).json({
    error: message,
    ...(isDev && err instanceof Error ? { stack: err.stack } : {}),
  });
}

function resolveResponse(err: unknown): { status: number; message: string } {
  if (err instanceof AppError) {
    return { status: err.statusCode, message: err.message };
  }

  if (err instanceof APIError) {
    return { status: err.statusCode || 400, message: err.body?.message || "Bad request" };
  }

  // body-parser / express.json() malformed-JSON case: a plain SyntaxError
  // with .status/.statusCode 400, thrown before any route's requireAuth runs.
  if (err && typeof err === "object") {
    const statusCode =
      ("statusCode" in err && typeof err.statusCode === "number" && err.statusCode) ||
      ("status" in err && typeof err.status === "number" && err.status) ||
      undefined;
    if (statusCode === 400) {
      return { status: 400, message: "Bad request" };
    }
  }

  // Unexpected/opaque error: never leak internals in production.
  return {
    status: 500,
    message: isDev && err instanceof Error ? err.message : "Internal server error",
  };
}
