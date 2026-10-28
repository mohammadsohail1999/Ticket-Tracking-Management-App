import express, { Router } from "express";
import { receiveEmail } from "../controllers/inboundController.ts";
import { requireInboundSecret } from "../middleware/inboundSecret.ts";
import { validate } from "../middleware/validate.ts";
import { inboundEmailSchema } from "../../../core/schema/inboundEmail.ts";

const router = Router();

// The body is parsed only after the secret check, with a larger limit than
// the global 100kb parser because email bodies (especially HTML) run long.
router.post(
  "/email",
  requireInboundSecret,
  express.json({ limit: "1mb" }),
  validate(inboundEmailSchema),
  receiveEmail,
);

export default router;
