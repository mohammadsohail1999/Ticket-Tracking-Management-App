import type { Request, Response } from "express";
import prisma from "../lib/prisma.ts";

export async function getHealth(req: Request, res: Response) {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "connected" });
  } catch (err) {
    res.status(503).json({ status: "error", database: "unreachable" });
  }
}
