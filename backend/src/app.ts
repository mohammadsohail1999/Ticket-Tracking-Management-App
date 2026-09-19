import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import auth from "./lib/auth.ts";
import healthRouter from "./routes/health.ts";
import adminRouter from "./routes/admin.ts";
import { errorHandler } from "./middleware/errorHandler.ts";

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

// Must be mounted last — catches everything forwarded above, including
// express.json()'s malformed-body SyntaxError. Full detail in development,
// generic messages in production — see middleware/errorHandler.ts.
app.use(errorHandler);

export default app;
