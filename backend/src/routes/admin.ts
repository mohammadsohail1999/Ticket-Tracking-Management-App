import { Router } from "express";
import { createUser, listUsers, updateUser } from "../controllers/adminController.ts";
import { requireAuth, requireRole } from "../middleware/auth.ts";
import { validate } from "../middleware/validate.ts";
import { createUserSchema, updateUserSchema } from "../../../core/schema/user.ts";

const router = Router();

router.get("/users", requireAuth, requireRole("admin"), listUsers);
router.post("/users", requireAuth, requireRole("admin"), validate(createUserSchema), createUser);
router.patch("/users/:id", requireAuth, requireRole("admin"), validate(updateUserSchema), updateUser);

export default router;
