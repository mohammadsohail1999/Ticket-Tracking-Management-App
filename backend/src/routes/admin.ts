import { Router } from "express";
import { createUser, listUsers } from "../controllers/adminController.ts";
import { requireAuth, requireRole } from "../middleware/auth.ts";

const router = Router();

router.get("/users", requireAuth, requireRole("admin"), listUsers);
router.post("/users", requireAuth, requireRole("admin"), createUser);

export default router;
