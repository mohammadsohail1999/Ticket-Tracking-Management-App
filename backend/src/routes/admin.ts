import { Router } from "express";
import { createUser } from "../controllers/adminController.ts";
import { requireAuth, requireRole } from "../middleware/auth.ts";

const router = Router();

router.post("/users", requireAuth, requireRole("admin"), createUser);

export default router;
