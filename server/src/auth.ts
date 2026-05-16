import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { db } from "./db.js";
import { users } from "./db.js";
import { eq } from "drizzle-orm";

const SECRET = process.env.SESSION_SECRET ?? "dev-secret-change-in-production";

export function signToken(payload: { userId: number; email: string }) {
  return jwt.sign(payload, SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, SECRET) as { userId: number; email: string };
  } catch {
    return null;
  }
}

export interface AuthenticatedRequest extends Request {
  user?: { id: number; email: string; name: string };
}

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const decoded = verifyToken(token);
  if (!decoded) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }
  const userRows = await db.select().from(users).where(eq(users.id, decoded.userId));
  const user = userRows[0];
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  req.user = { id: user.id, email: user.email, name: user.name };
  next();
}
