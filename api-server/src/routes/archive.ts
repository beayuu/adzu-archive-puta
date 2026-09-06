import { Router, type IRouter } from "express";
import { GetArchiveSettingsResponse, UpdateArchiveSettingsBody, UpdateArchiveSettingsResponse } from "@workspace/api-zod";
import { db } from "@workspace/db";
import { archiveSettingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getArchiveSession } from "../lib/archive-session";

const router: IRouter = Router();

const DEFAULT_SETTINGS = {
  archiveActive: true,
  autoIndex: true,
  retention: "Permanent",
  destination: "/Users/registrar/Documents/adzu-archive",
  folderNamingFormat: "{Student ID} - {Student Name}",
  requiredUploadDetails: "Student ID, student name, document type",
  requiredFolderDetails: "Student ID, student name, program",
};

async function readSettings() {
  const [row] = await db.select().from(archiveSettingsTable).limit(1);
  if (!row) {
    await db.insert(archiveSettingsTable).values({
      archiveActive: "true",
      autoIndex: "true",
      retention: DEFAULT_SETTINGS.retention,
      destination: DEFAULT_SETTINGS.destination,
      folderNamingFormat: DEFAULT_SETTINGS.folderNamingFormat,
      requiredUploadDetails: DEFAULT_SETTINGS.requiredUploadDetails,
      requiredFolderDetails: DEFAULT_SETTINGS.requiredFolderDetails,
    });
    const [created] = await db.select().from(archiveSettingsTable).limit(1);
    return { id: created.id, settings: DEFAULT_SETTINGS };
  }
  return {
    id: row.id,
    settings: {
      archiveActive: row.archiveActive === "true",
      autoIndex: row.autoIndex === "true",
      retention: row.retention,
      destination: row.destination,
    folderNamingFormat: row.folderNamingFormat,
    requiredUploadDetails: row.requiredUploadDetails,
    requiredFolderDetails: row.requiredFolderDetails,
    },
  };
}

router.get("/archive/settings", async (req, res) => {
  if (!getArchiveSession(req)) {
    res.status(401).json({ error: "No active archive session." });
    return;
  }
  const stored = await readSettings();
  res.json(GetArchiveSettingsResponse.parse(stored.settings));
});

router.patch("/archive/settings", async (req, res) => {
  const session = getArchiveSession(req);
  if (!session) {
    res.status(401).json({ error: "No active archive session." });
    return;
  }
  if (session.role !== "Admin") {
    res.status(403).json({ error: "Admin access required." });
    return;
  }
  const parsed = UpdateArchiveSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid archive settings." });
    return;
  }
  const stored = await readSettings();
  const next = { ...stored.settings, ...parsed.data };
  await db.update(archiveSettingsTable).set({
    archiveActive: next.archiveActive ? "true" : "false",
    autoIndex: next.autoIndex ? "true" : "false",
    retention: next.retention,
    destination: next.destination,
    folderNamingFormat: next.folderNamingFormat,
    requiredUploadDetails: next.requiredUploadDetails,
    requiredFolderDetails: next.requiredFolderDetails,
  }).where(eq(archiveSettingsTable.id, stored.id));
  res.json(UpdateArchiveSettingsResponse.parse(next));
});

router.post("/admin/archive", async (req, res) => {
  const session = getArchiveSession(req);
  if (!session) {
    res.status(401).json({ error: "No active archive session." });
    return;
  }
  if (session.role !== "Admin") {
    res.status(403).json({ error: "Admin access required." });
    return;
  }
  const stored = await readSettings();
  if (!stored.settings.archiveActive) {
    res.status(409).json({ error: "Archive is paused." });
    return;
  }
  if (!Array.isArray(req.body?.documents) || req.body.documents.length === 0) {
    res.status(400).json({ error: "At least one document is required." });
    return;
  }
  res.status(202).json({ accepted: true, count: req.body.documents.length, destination: stored.settings.destination });
});

export default router;