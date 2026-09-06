import crypto from "node:crypto";
import type { Request, Response } from "express";

export type ArchiveRole = "Admin" | "Regular User";

export type ArchiveSession = {
  userId: string;
  email: string;
  displayName: string;
  role: ArchiveRole;
  expiresAt: number;
};

const COOKIE_NAME = "adzu_session";
const MAX_AGE_MS = 8 * 60 * 60 * 1000;

function secret() {
  return process.env.SESSION_SECRET ?? "development-only-session-secret";
}

function signature(payload: string) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function setArchiveSession(res: Response, user: Omit<ArchiveSession, "expiresAt">) {
  const payload = Buffer.from(
    JSON.stringify({ ...user, expiresAt: Date.now() + MAX_AGE_MS }),
    "utf8",
  ).toString("base64url");
  res.cookie(COOKIE_NAME, `${payload}.${signature(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE_MS,
    path: "/",
  });
}

export function clearArchiveSession(res: Response) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: "lax", path: "/" });
}

export function getArchiveSession(req: Request): ArchiveSession | null {
  const raw = req.cookies?.[COOKIE_NAME];
  if (typeof raw !== "string") return null;
  const [payload, receivedSignature] = raw.split(".");
  if (!payload || !receivedSignature || signature(payload) !== receivedSignature) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as ArchiveSession;
    if (parsed.expiresAt <= Date.now()) return null;
    if (parsed.role !== "Admin" && parsed.role !== "Regular User") return null;
    return parsed;
  } catch {
    return null;
  }
}