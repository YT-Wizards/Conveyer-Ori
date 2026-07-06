import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { ensureInit } from "@/lib/init";
import { getSetting, setSetting } from "@/lib/settings";
import { styleDir, listStyleImages, safeStyleName, MAX_STYLE_IMAGES } from "@/lib/services/style";

/** GET → current style state (enabled, text, profile, image list). */
export async function GET() {
  ensureInit();
  return NextResponse.json({
    enabled: (getSetting("STYLE_ENABLED") || "on") !== "off",
    text: getSetting("STYLE_TEXT") || "",
    profile: getSetting("STYLE_PROFILE") || "",
    images: listStyleImages(),
    max: MAX_STYLE_IMAGES,
  });
}

/**
 * POST multipart/form-data (files) → upload reference images.
 * POST application/json { text?, enabled? } → save the written description / toggle.
 */
export async function POST(req: Request) {
  ensureInit();
  const ct = req.headers.get("content-type") || "";

  if (ct.includes("multipart/form-data")) {
    const fd = await req.formData();
    const existing = listStyleImages();
    const saved: string[] = [];
    for (const entry of fd.getAll("files")) {
      if (!(entry instanceof File)) continue;
      if (existing.length + saved.length >= MAX_STYLE_IMAGES) break;
      const name = safeStyleName(entry.name);
      if (!name) continue; // unsupported extension
      // De-collide: ref.jpg → ref_2.jpg
      let final = name;
      let n = 2;
      while (fs.existsSync(path.join(styleDir(), final))) {
        const ext = path.extname(name);
        final = `${path.basename(name, ext)}_${n}${ext}`;
        n++;
      }
      const buf = Buffer.from(await entry.arrayBuffer());
      if (buf.byteLength === 0 || buf.byteLength > 15 * 1024 * 1024) continue;
      fs.writeFileSync(path.join(styleDir(), final), buf);
      saved.push(final);
    }
    return NextResponse.json({ saved, images: listStyleImages() });
  }

  const body = (await req.json()) as { text?: string; enabled?: boolean };
  if (typeof body.text === "string") setSetting("STYLE_TEXT", body.text.slice(0, 2000));
  if (typeof body.enabled === "boolean") setSetting("STYLE_ENABLED", body.enabled ? "on" : "off");
  return NextResponse.json({ ok: true });
}

/** DELETE ?name=<file> → remove one reference image. */
export async function DELETE(req: Request) {
  ensureInit();
  const name = new URL(req.url).searchParams.get("name") || "";
  // Only allow deleting files that are actually in the style dir listing.
  if (!listStyleImages().includes(name)) {
    return NextResponse.json({ error: "unknown image" }, { status: 404 });
  }
  try {
    fs.unlinkSync(path.join(styleDir(), name));
  } catch {
    /* already gone */
  }
  return NextResponse.json({ images: listStyleImages() });
}
