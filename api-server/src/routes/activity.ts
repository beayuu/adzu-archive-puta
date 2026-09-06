import { Router, type IRouter } from "express";
import { ActivityInput, ListActivityResponse, RecordActivityBody, RecordActivityResponse } from "@workspace/api-zod";
import { db } from "@workspace/db";
import { activityLogsTable } from "@workspace/db/schema";
import { desc } from "drizzle-orm";
import { getArchiveSession } from "../lib/archive-session";

const router: IRouter = Router();

function requireSession(req: Parameters<IRouter["use"]>[0] extends never ? never : any, res: any) {
  const session = getArchiveSession(req);
  if (!session) {
    res.status(401).json({ error: "No active archive session." });
    return null;
  }
  return session;
}

router.get("/activity", async (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  if (session.role !== "Admin") {
    res.status(403).json({ error: "Admin access required." });
    return;
  }
  const rows = await db.select().from(activityLogsTable).orderBy(desc(activityLogsTable.timestamp)).limit(500);
  res.json(ListActivityResponse.parse(rows.map((row) => ({
    ...row,
    id: Number(row.id),
    timestamp: row.timestamp.toISOString(),
  }))));
});

router.post("/activity", async (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  const parsed = RecordActivityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid activity payload." });
    return;
  }
  const input = parsed.data;
  const [created] = await db.insert(activityLogsTable).values({
    action: input.action,
    subject: input.subject,
    actor: session.displayName,
    userId: session.userId,
    role: session.role,
    folder: input.folder ?? null,
    document: input.document ?? null,
    status: input.status,
  }).returning();
  res.status(201).json(RecordActivityResponse.parse({
    ...created,
    id: Number(created.id),
    timestamp: created.timestamp.toISOString(),
  }));
});

export default router;