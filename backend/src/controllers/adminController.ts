import type { Request, Response } from "express";
import { APIError } from "better-auth";
import { fromNodeHeaders } from "better-auth/node";
import auth from "../lib/auth.ts";

export async function createUser(req: Request, res: Response) {
  const { email, password, name, role } = req.body;

  if (!email || !password || !name) {
    res.status(400).json({ error: "email, password, and name are required" });
    return;
  }
  if (role && role !== "admin" && role !== "agent") {
    res.status(400).json({ error: 'role must be "admin" or "agent"' });
    return;
  }

  try {
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
  } catch (err) {
    if (err instanceof APIError) {
      res.status(err.statusCode || 400).json({ error: err.body?.message || "Could not create user" });
      return;
    }
    res.status(500).json({ error: "Could not create user" });
  }
}

export async function listUsers(req: Request, res: Response) {
  try {
    const result = await auth.api.listUsers({
      // No pagination UI yet; explicit high limit avoids the admin plugin's
      // default page size silently truncating the list.
      query: { limit: 1000 },
      headers: fromNodeHeaders(req.headers),
    });
    res.status(200).json({ users: result.users });
  } catch (err) {
    if (err instanceof APIError) {
      res.status(err.statusCode || 400).json({ error: err.body?.message || "Could not list users" });
      return;
    }
    res.status(500).json({ error: "Could not list users" });
  }
}
