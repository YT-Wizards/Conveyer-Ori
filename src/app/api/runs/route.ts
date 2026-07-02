import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import db from "@/lib/db";
import { ensureInit } from "@/lib/init";
import { runPipeline } from "@/lib/pipeline";
import { sanitizeFolderName, pickAvailableFolderName } from "@/lib/run-paths";

const insertRun = db.prepare(
  "INSERT INTO runs (id, title, folder_name, status, script, config_json) VALUES (?, ?, ?, 'pending', ?, ?)"
);
const listRuns = db.prepare(
  "SELECT id, title, folder_name, status, created_at, updated_at, output_path FROM runs ORDER BY created_at DESC LIMIT 50"
);

export async function GET() {
  ensureInit();
  return NextResponse.json(listRuns.all());
}

export async function POST(req: Request) {
  ensureInit();
  const body = (await req.json()) as {
    title?: string;
    script?: string;
    introScript?: string;
    bodyScript?: string;
  };
  const introScript = (body.introScript ?? "").trim();
  const bodyScript = (body.bodyScript ?? "").trim();
  // Two-zone BY FIELDS when both intro and body are supplied — the boundary is
  // then exact (the user told us) and the "intro:/body:" labels are never voiced.
  // Otherwise fall back to a single combined script (explicit `script`, or
  // whichever single field was filled) → time-based zone split.
  const useFields = introScript.length > 0 && bodyScript.length > 0;
  const combinedScript = useFields
    ? `${introScript}\n\n${bodyScript}`
    : (body.script ?? "").trim() || introScript || bodyScript;
  if (!combinedScript) {
    return NextResponse.json({ error: "script is empty" }, { status: 400 });
  }

  const id = randomUUID();
  const baseFolderName = sanitizeFolderName(body.title ?? "", id.slice(0, 8));
  const folderName = pickAvailableFolderName(baseFolderName);

  const configJson = JSON.stringify(
    useFields ? { zoneMode: "fields", introChars: introScript.length, bodyChars: bodyScript.length } : {}
  );
  insertRun.run(id, body.title ?? null, folderName, combinedScript, configJson);

  // Запускаємо пайплайн у фоні. На локалі цього досить.
  runPipeline(id, combinedScript, useFields ? { introScript, bodyScript } : undefined).catch((e) => {
    // eslint-disable-next-line no-console
    console.error("pipeline crash", e);
  });

  return NextResponse.json({ id, folderName });
}
