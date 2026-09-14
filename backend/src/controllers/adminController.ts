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
