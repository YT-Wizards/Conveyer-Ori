import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { DATA_DIR } from "../db";
import { getSetting, setSetting } from "../settings";

/**
 * Channel STYLE — the creator's visual identity, defined once on the /style page.
 *
 * The user uploads 5–8 reference images + writes a short style description
 * (e.g. "aged black-and-white period engraving, film grain, museum lighting,
 * no modern objects"). `analyzeStyle()` has Gemini LOOK at the references and
 * distill everything into one STYLE PROFILE — a compact set of directives that
 * then drives BOTH sides of the visual pipeline:
 *   - AI image generation (ai-image.ts appends it to every generation prompt)
 *   - stock selection (stock-footage.ts scores off-style candidates ≤39)
 * Reference images live in DATA_DIR/style; the profile/text live in settings.
 */

const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);
export const MAX_STYLE_IMAGES = 8;

export function styleDir(): string {
  const d = path.join(DATA_DIR, "style");
  fs.mkdirSync(d, { recursive: true });
  return d;
}

/** Sanitize an uploaded filename to a safe basename (no traversal, sane ext). */
export function safeStyleName(original: string): string | null {
  const ext = path.extname(original).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) return null;
  const stem = path
    .basename(original, path.extname(original))
    .replace(/[^\p{L}\p{N}_-]+/gu, "_")
    .slice(0, 60) || "ref";
  return `${stem}${ext}`;
}

export function listStyleImages(): string[] {
  try {
    return fs
      .readdirSync(styleDir())
      .filter((f) => ALLOWED_EXT.has(path.extname(f).toLowerCase()))
      .sort();
  } catch {
    return [];
  }
}

/**
 * The effective style directive for prompts/scoring — the analyzed profile when
 * available, else the user's raw text. Empty string = style feature inactive.
 */
export function effectiveStyle(): string {
  if ((getSetting("STYLE_ENABLED") || "on").trim().toLowerCase() === "off") return "";
  const profile = (getSetting("STYLE_PROFILE") || "").trim();
  if (profile) return profile;
  return (getSetting("STYLE_TEXT") || "").trim();
}

/** Downscale a reference image to a small JPEG for the Gemini call (base64). */
function thumbForAnalysis(file: string): { data: string; mime: string } | null {
  const src = path.join(styleDir(), file);
  const tmp = path.join(os.tmpdir(), `ori_style_${process.pid}_${Math.random().toString(36).slice(2)}.jpg`);
  try {
    const ffmpeg = (getSetting("FFMPEG_PATH") || "ffmpeg").trim() || "ffmpeg";
    const r = spawnSync(ffmpeg, ["-i", src, "-vf", "scale=512:-2", "-frames:v", "1", "-q:v", "6", "-y", tmp], {
      timeout: 20000,
    });
    if (r.status === 0 && fs.existsSync(tmp) && fs.statSync(tmp).size > 0) {
      const b64 = fs.readFileSync(tmp).toString("base64");
      return { data: b64, mime: "image/jpeg" };
    }
    // ffmpeg unavailable / failed → send the original if it's small enough.
    const buf = fs.readFileSync(src);
    if (buf.byteLength <= 4 * 1024 * 1024) {
      const ext = path.extname(file).toLowerCase();
      const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
      return { data: buf.toString("base64"), mime };
    }
    return null;
  } catch {
    return null;
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
}

/**
 * Gemini looks at the reference images + the user's description and distills a
 * STYLE PROFILE. Saved to STYLE_PROFILE. Throws with a clear message on failure.
 */
export async function analyzeStyle(): Promise<string> {
  const apiKey = getSetting("GOOGLE_API_KEY").trim();
  if (!apiKey) throw new Error("GOOGLE_API_KEY is not set (Settings → Required Keys)");
  const images = listStyleImages().slice(0, MAX_STYLE_IMAGES);
  const userText = (getSetting("STYLE_TEXT") || "").trim();
  if (images.length === 0 && !userText) {
    throw new Error("Add reference images and/or a written style description first");
  }

  const parts: unknown[] = [
    {
      text:
        `You are a visual style director for a faceless documentary YouTube channel. ` +
        `${images.length > 0 ? `${images.length} reference image(s) follow showing the EXACT look the creator wants. ` : ""}` +
        (userText ? `The creator also wrote this style description: "${userText.slice(0, 500)}". ` : "") +
        `Distill everything into ONE compact STYLE PROFILE (120-180 words) usable both to GENERATE images in this style and to JUDGE whether a stock photo/video matches it. Cover: ` +
        `era/period; medium (photograph / engraving / illustration / newsreel); color treatment (b&w, sepia, muted, saturated); grain/texture/aging; lighting; composition tendencies; mood. ` +
        `End with an AVOID list of concrete disqualifiers (e.g. "modern objects, bright contemporary colors, digital-clean look, watermarks"). ` +
        `Write direct, concrete directives — no preamble, no headings, plain text only.`,
    },
  ];
  for (const f of images) {
    const t = thumbForAnalysis(f);
    if (t) parts.push({ inlineData: { mimeType: t.mime, data: t.data } });
  }

  const model = getSetting("GEMINI_VISION_MODEL") || "gemini-2.5-flash";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  let resp: Response;
  try {
    resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: { temperature: 0, maxOutputTokens: 800, thinkingConfig: { thinkingBudget: 0 } },
        }),
        signal: controller.signal,
      }
    );
  } finally {
    clearTimeout(timer);
  }
  if (!resp.ok) throw new Error(`Gemini style analysis failed (HTTP ${resp.status})`);
  const j = (await resp.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const profile = (j.candidates?.[0]?.content?.parts ?? []).map((p) => p.text || "").join("").trim();
  if (!profile) throw new Error("Gemini returned an empty style profile — try again");
  setSetting("STYLE_PROFILE", profile);
  return profile;
}
