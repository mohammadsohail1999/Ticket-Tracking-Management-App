import express from "express";
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

export default app;
