import { Router, type IRouter } from "express";
import { GetSessionResponse, LoginBody, LoginResponse } from "@workspace/api-zod";
import { clearArchiveSession, getArchiveSession, setArchiveSession } from "../lib/archive-session";

const router: IRouter = Router();

router.post("/session/login", (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Email, password, and role are required." });
    return;
  }

  const email = parsed.data.email.trim();
  const displayName =
    parsed.data.role === "Admin"
      ? "Registrar Admin"
      : email
          .split("@")[0]
          .replace(/[._-]+/g, " ")
          .replace(/\b\w/g, (letter) => letter.toUpperCase());
  const user = { userId: email.toLowerCase(), email, displayName, role: parsed.data.role };
  setArchiveSession(res, user);
  res.json(LoginResponse.parse(user));
});

router.post("/session/logout", (_req, res) => {
  clearArchiveSession(res);
  res.status(204).end();
});

router.get("/session/me", (req, res) => {
  const session = getArchiveSession(req);
  if (!session) {
    res.status(401).json({ error: "No active archive session." });
    return;
  }
  res.json(GetSessionResponse.parse(session));
});

export default router;