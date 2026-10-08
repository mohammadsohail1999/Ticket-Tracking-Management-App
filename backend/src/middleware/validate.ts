import type { NextFunction, Request, Response } from "express";
import * as z from "zod";
import { ValidationError } from "../lib/errors.ts";

// Validates req.body against `schema` and replaces it with the parsed value,
// so controllers see trimmed/defaulted data. Mount after requireAuth/requireRole
// so unauthenticated callers get 401/403 before a 400.
export function validate(schema: z.ZodType) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues
        .map((issue) =>
          issue.path.length ? `${issue.path.join(".")}: ${issue.message}` : issue.message,
        )
        .join("; ");
      next(new ValidationError(message, z.flattenError(result.error)));
      return;
    }
    req.body = result.data;
    next();
  };
}
