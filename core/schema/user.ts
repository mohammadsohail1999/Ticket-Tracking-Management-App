import * as z from "zod";

// Shared by backend (request validation) and frontend (form validation).
// Imported by both TS setups, so keep to the strictest rules of each: explicit
// `.ts` import extensions, and no enum/namespace/parameter properties.

const name = z.string().trim().min(1, "Name is required.");
const email = z.email("Enter a valid email address.");

// Password length bounds are not checked here: the backend reads them from
// Better Auth's async config, and the create form mirrors them separately.
export const createUserSchema = z.object({
  name,
  email,
  password: z.string().min(1),
  role: z.enum(["admin", "agent"]).default("agent"),
});

// Role is deliberately not editable. `.strict()` turns a stray `role` (or any
// other field) into a 400 instead of silently ignoring it.
export const updateUserSchema = z.object({ name, email }).strict();

export type CreateUserBody = z.infer<typeof createUserSchema>;
export type UpdateUserBody = z.infer<typeof updateUserSchema>;
