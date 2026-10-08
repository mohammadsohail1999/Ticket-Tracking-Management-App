import type { Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import auth from "../lib/auth.ts";
import prisma from "../lib/prisma.ts";
import { AppError } from "../lib/errors.ts";
import type { CreateUserBody, UpdateUserBody } from "../../../core/schema/user.ts";

// Explicit select mirrors frontend/src/types/user.ts.
const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  banned: true,
  createdAt: true,
} as const;

// req.body is already parsed by validate(createUserSchema) on the route.
export async function createUser(req: Request<unknown, unknown, CreateUserBody>, res: Response) {
  const { email, password, name, role } = req.body;

  // The admin plugin's createUser doesn't enforce the password policy that
  // sign-up, reset-password and set-user-password do, so apply it here using
  // Better Auth's own limits to keep the two in sync.
  const { minPasswordLength, maxPasswordLength } = (await auth.$context).password.config;
  if (password.length < minPasswordLength || password.length > maxPasswordLength) {
    throw new AppError(
      `password must be between ${minPasswordLength} and ${maxPasswordLength} characters`,
      400,
    );
  }

  const result = await auth.api.createUser({
    body: {
      email,
      password,
      name,
      // The admin plugin types roles as "admin" | "user" because no custom
      // access-control roles are registered, but "agent" is our default role.
      role: role as "admin",
      // Admin-created users skip the self-serve verification email flow,
      // so mark them verified up front or they can never sign in under
      // requireEmailVerification: true.
      data: { emailVerified: true },
    },
    // Forwards the calling admin's session so the admin plugin's own
    // permission check passes.
    headers: fromNodeHeaders(req.headers),
  });
  res.status(201).json({ user: result.user });
}

export async function listUsers(req: Request, res: Response) {
  // Read-only, and requireAuth + requireRole("admin") already guard the route,
  // so query Prisma directly rather than round-tripping through the admin
  // plugin.
  const users = await prisma.user.findMany({
    select: publicUserSelect,
    orderBy: { createdAt: "asc" },
  });
  res.status(200).json({ users });
}

const duplicateEmailError = () => new AppError("A user with this email already exists", 409);

// req.body is already parsed by validate(updateUserSchema): only name and
// email can be present, role changes are rejected there with a 400. Goes
// straight to Prisma (like listUsers) so every guard below is ours, rather
// than the admin plugin's.
export async function updateUser(req: Request<{ id: string }, unknown, UpdateUserBody>, res: Response) {
  const { id } = req.params;
  const { name } = req.body;
  // Better Auth stores and looks up emails lowercased, so match that.
  const email = req.body.email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { id }, select: publicUserSelect });
  if (!existing) throw new AppError("User not found", 404);

  if (existing.name === name && existing.email === email) {
    res.status(200).json({ user: existing });
    return;
  }

  if (email !== existing.email) {
    const taken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (taken) throw duplicateEmailError();
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: { name, email },
      select: publicUserSelect,
    });
    res.status(200).json({ user });
  } catch (err) {
    // Lost a race with another write to the same email (unique constraint).
    if (typeof err === "object" && err !== null && "code" in err && err.code === "P2002") {
      throw duplicateEmailError();
    }
    throw err;
  }
}
