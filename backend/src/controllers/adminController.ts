import type { Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import auth from "../lib/auth.ts";
import { AppError } from "../lib/errors.ts";

export async function createUser(req: Request, res: Response) {
  const { email, password, name, role } = req.body;

  if (!email || !password || !name) {
    throw new AppError("email, password, and name are required", 400);
  }
  if (role && role !== "admin" && role !== "agent") {
    throw new AppError('role must be "admin" or "agent"', 400);
  }

  // The admin plugin's createUser doesn't enforce the password policy that
  // sign-up, reset-password and set-user-password do, so apply it here using
  // Better Auth's own limits to keep the two in sync.
  const { minPasswordLength, maxPasswordLength } = (await auth.$context).password.config;
  if (
    typeof password !== "string" ||
    password.length < minPasswordLength ||
    password.length > maxPasswordLength
  ) {
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
      role: role || "agent",
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
  const result = await auth.api.listUsers({
    // No pagination UI yet; explicit high limit avoids the admin plugin's
    // default page size silently truncating the list.
    query: { limit: 1000 },
    headers: fromNodeHeaders(req.headers),
  });
  res.status(200).json({ users: result.users });
}
