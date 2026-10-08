import { Router } from "express";
import { createUser, listUsers } from "../controllers/adminController.ts";
import { requireAuth, requireRole } from "../middleware/auth.ts";
import { validate } from "../middleware/validate.ts";
import { createUserBody } from "../schemas/adminSchemas.ts";

const router = Router();

router.get("/users", requireAuth, requireRole("admin"), listUsers);
router.post("/users", requireAuth, requireRole("admin"), validate(createUserBody), createUser);

export default router;
