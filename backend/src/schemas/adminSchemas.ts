import * as z from "zod";

// Password length bounds are not checked here: they come from Better Auth's
// async config, so createUser enforces them to stay in sync with it.
export const createUserBody = z.object({
  name: z.string().trim().min(1),
  email: z.email(),
  password: z.string().min(1),
  role: z.enum(["admin", "agent"]).default("agent"),
});

export type CreateUserBody = z.infer<typeof createUserBody>;
