import express from "express";
import type { NextFunction, Request, Response } from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import auth from "./lib/auth.ts";
import healthRouter from "./routes/health.ts";
import adminRouter from "./routes/admin.ts";

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  }),
);

// Must be mounted before express.json() — needs the raw request stream.
app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());

app.use("/api/health", healthRouter);
app.use("/api/admin", adminRouter);

// Must be mounted last. Always returns a generic error with no stack trace,
// regardless of NODE_ENV — prevents Express's default error handler from
// leaking internal file paths/dependency details (e.g. on a malformed JSON
// body, which reaches here before any route's requireAuth runs).
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  const status =
    err && typeof err === "object" && "statusCode" in err && typeof err.statusCode === "number"
      ? err.statusCode
      : 500;
  res.status(status).json({ error: status === 400 ? "Bad request" : "Internal server error" });
});

export default app;
