import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getSetting } from "../settings";
import { log } from "../logger";
import type { Scene } from "./scene-split";

/**
 * AI image FALLBACK for the footage layer.
 *
 * The stock cascade always tries REAL footage first. Only when no real photo is
 * relevant enough (the best real match falls below the lowest vision tier) does
 * this kick in: it GENERATES an image, RE-SCORES it with the same Gemini vision
 * check, and REGENERATES (different composition each time) until it clears the
 * bar or attempts run out — then keeps the best. This is the Patrice-style
 * fallback, but gated so AI is a last resort (no "AI slop").
 *
 * Two providers, both on keys the client already has:
 *  - "gemini"  (default): gemini-2.5-flash-image via GOOGLE_API_KEY (already
 *               required for scene-split + relevance — zero extra setup).
 *  - "genaipro": nano_banana_pro via GENAIPRO_API_KEY (the same GenAIPro account
 *               that serves the voice; uses its Veo image credits).
 */

function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ── providers ─────────────────────────────────────────────────────────────────

/** Gemini image generation (gemini-2.5-flash-image). Returns raw bytes. */
async function geminiImage(prompt: string): Promise<Buffer> {
  const apiKey = getSetting("GOOGLE_API_KEY").trim();
  if (!apiKey) throw new Error("GOOGLE_API_KEY is not set");
  const model = getSetting("IMAGE_MODEL") || "gemini-2.5-flash-image";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "16:9" } },
  });

  let lastErr = "";
  for (let attempt = 0; attempt <= 4; attempt++) {
    let resp: Response;
    try {
      resp = await fetchWithTimeout(url, { method: "POST", headers: { "Content-Type": "application/json" }, body }, 180_000);
    } catch (e) {
      lastErr = `Gemini image network error: ${e instanceof Error ? e.message : String(e)}`;
      if (attempt === 4) throw new Error(lastErr);
      await sleep(1500 * 2 ** attempt);
      continue;
    }
    if (resp.ok) {
      const json = (await resp.json()) as {
        candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[];
      };
      for (const part of json.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data) return Buffer.from(part.inlineData.data, "base64");
      }
      lastErr = "Gemini image: response had no image (prompt may have been blocked)";
      if (attempt === 4) throw new Error(lastErr);
      await sleep(1500 * 2 ** attempt);
      continue;
    }
    lastErr = `Gemini image ${resp.status}: ${(await resp.text()).slice(0, 200)}`;
    if (![429, 500, 502, 503, 504].includes(resp.status) || attempt === 4) throw new Error(lastErr);
    await sleep((resp.status === 429 ? 5000 : 1500) * 2 ** attempt);
  }
  throw new Error(lastErr);
}

/** GenAIPro image generation (nano_banana_pro via /v2/veo/create-image). */
async function genaiproImage(prompt: string, outFile: string): Promise<void> {
  const apiKey = getSetting("GENAIPRO_API_KEY").trim();
  if (!apiKey) throw new Error("GENAIPRO_API_KEY is not set");
  const BASE = "https://genaipro.io/api";
  const model = getSetting("GENAIPRO_IMAGE_MODEL") || "nano_banana_pro";
  const auth = { Authorization: `Bearer ${apiKey}` };

  let taskId = "";
  for (let attempt = 0; attempt <= 4; attempt++) {
    const form = new FormData();
    form.append("prompt", prompt);
    form.append("aspect_ratio", "IMAGE_ASPECT_RATIO_LANDSCAPE");
    form.append("number_of_images", "1");
    form.append("model", model);
    const resp = await fetchWithTimeout(`${BASE}/v2/veo/create-image`, { method: "POST", headers: auth, body: form }, 60_000);
    if (resp.ok) {
      const json = (await resp.json()) as { id?: string };
      if (!json.id) throw new Error("GenAIPro image: response without task id");
      taskId = json.id;
      break;
    }
    const err = `GenAIPro image ${resp.status}: ${(await resp.text()).slice(0, 200)}`;
    if (![429, 500, 502, 503, 504].includes(resp.status) || attempt === 4) throw new Error(err);
    await sleep((resp.status === 429 ? 20_000 : 3000) * (attempt + 1));
  }

  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    await sleep(6000);
    const resp = await fetchWithTimeout(`${BASE}/v2/veo/tasks/${encodeURIComponent(taskId)}`, { headers: auth }, 60_000);
    if (resp.status === 429) { await sleep(20_000); continue; }
    if (!resp.ok) throw new Error(`GenAIPro image poll ${resp.status}`);
    const task = (await resp.json()) as { status?: string; file_urls?: string[]; error?: string };
    if (task.status === "completed") {
      const url = task.file_urls?.[0];
      if (!url) throw new Error("GenAIPro image: completed but no file URL");
      const dl = await fetchWithTimeout(url, {}, 120_000);
      if (!dl.ok) throw new Error(`GenAIPro image download ${dl.status}`);
      fs.writeFileSync(outFile, Buffer.from(await dl.arrayBuffer()));
      return;
    }
    if (task.status === "failed") throw new Error(`GenAIPro image failed: ${task.error || "unknown"}`);
  }
  throw new Error("GenAIPro image: timed out");
}

/** kie.ai nano-banana image generation (the Patrice-lineage default provider). */
async function kieImage(prompt: string, outFile: string): Promise<void> {
  const key = getSetting("KIE_API_KEY").trim();
  if (!key) throw new Error("KIE_API_KEY is not set");
  const BASE = "https://api.kie.ai";
  const model = getSetting("KIE_IMAGE_MODEL") || "google/nano-banana";
  const auth = { Authorization: `Bearer ${key}` };

  // kie.ai returns app-level errors as HTTP 200 with a non-200 `code` in the body.
  const created = await (async () => {
    const r = await fetchWithTimeout(`${BASE}/api/v1/jobs/createTask`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ model, input: { prompt: prompt.slice(0, 5000), output_format: "png", aspect_ratio: "16:9", nsfw_checker: false } }),
    }, 60_000);
    const text = await r.text();
    if (!r.ok) throw new Error(`kie.ai createTask ${r.status}: ${text.slice(0, 160)}`);
    const j = JSON.parse(text) as { code?: number; msg?: string; data?: { taskId?: string } };
    if (typeof j.code === "number" && j.code !== 200) throw new Error(`kie.ai createTask code ${j.code}: ${j.msg || ""}`);
    return j;
  })();
  const taskId = created.data?.taskId;
  if (!taskId) throw new Error("kie.ai: createTask returned no taskId");

  const deadline = Date.now() + 5 * 60 * 1000;
  let delay = 4000;
  while (Date.now() < deadline) {
    await sleep(delay);
    delay = Math.min(delay + 1500, 12000);
    const r = await fetchWithTimeout(`${BASE}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, { headers: auth }, 60_000);
    if (!r.ok) { if (r.status === 429 || r.status >= 500) continue; throw new Error(`kie.ai recordInfo ${r.status}`); }
    const j = JSON.parse(await r.text()) as { data?: { state?: string; resultJson?: string; failMsg?: string; failCode?: string } };
    const state = j.data?.state;
    if (state === "success" && j.data?.resultJson) {
      const url = (JSON.parse(j.data.resultJson) as { resultUrls?: string[] }).resultUrls?.[0];
      if (!url) throw new Error("kie.ai: success but no resultUrls");
      const dl = await fetchWithTimeout(url, {}, 120_000);
      if (!dl.ok) throw new Error(`kie.ai download ${dl.status}`);
      fs.writeFileSync(outFile, Buffer.from(await dl.arrayBuffer()));
      return;
    }
    if (state === "fail") throw new Error(`kie.ai failed: ${j.data?.failMsg || j.data?.failCode || "unknown"}`);
  }
  throw new Error("kie.ai: timed out");
}

function imageProvider(): "gemini" | "genaipro" | "kie" {
  const p = (getSetting("IMAGE_PROVIDER") || "genaipro").trim().toLowerCase();
  return p === "genaipro" ? "genaipro" : p === "kie" ? "kie" : "gemini";
}

/** Generate one AI image to `outFile`. Throws on failure. */
async function generateAiImage(prompt: string, outFile: string): Promise<void> {
  const provider = imageProvider();
  if (provider === "genaipro") await genaiproImage(prompt, outFile);
  else if (provider === "kie") await kieImage(prompt, outFile);
  else fs.writeFileSync(outFile, await geminiImage(prompt));
}

// ── prompt + scoring ────────────────────────────────────────────────────────

/** Composition variants appended per regen attempt to nudge a fresh result. */
const VARIANTS = [
  "",
  "alternative composition, different camera angle",
  "another realistic shot, cleaner simple framing",
  "wider establishing shot",
  "tighter close-up detail",
];

function buildAiPrompt(base: string, videoContext: string, variant: string): string {
  const noText =
    "absolutely no text, no captions, no words, no letters, no numbers, no labels, no logos, no signs, no writing on any object, no watermark";
  const realism =
    "photorealistic, real-world, high quality, sharp focus, natural lighting, documentary photography. " +
    "NOT fantasy, NOT sci-fi, NOT surreal, NOT abstract, NOT illustration, NOT 3D render, no glowing magic, no neon";
  // Faceless channel — the AI fallback must not reintroduce the stranger faces the
  // real-footage path filters out. Show the object / place / detail only.
  const faceless =
    "no people, no person, no face, no portrait, no crowd — show ONLY the object, place, artifact, or close-up detail (hands only if truly unavoidable)";
  const topic = (videoContext || "").trim().slice(0, 160);
  const contextAnchor = topic ? `in a documentary about: ${topic}` : "";
  const style = getSetting("AI_IMAGE_STYLE").trim();
  return [base, contextAnchor, style, realism, faceless, noText, variant].filter(Boolean).join(", ");
}

/** Vision-score a generated image 0..1 (photorealism + on-topic + no baked text).
 *  Returns 1 if scoring is unavailable so a generated image is never blocked. */
async function scoreAiImage(sceneText: string, videoContext: string, imagePath: string, wantedVisual = ""): Promise<number> {
  const apiKey = getSetting("GOOGLE_API_KEY").trim();
  if (!apiKey) return 1;
  let bytes: Buffer;
  try { bytes = fs.readFileSync(imagePath); } catch { return 0; }
  const model = getSetting("GEMINI_VISION_MODEL") || "gemini-2.5-flash";
  const instr =
    `You are quality-checking ONE AI-generated image for a FACELESS documentary scene.\n` +
    `OVERALL VIDEO TOPIC: "${(videoContext || sceneText).slice(0, 300)}"\n` +
    `THIS SCENE: "${sceneText.slice(0, 200)}"\n` +
    (wantedVisual ? `WANTED VISUAL (the specific on-topic subject): "${wantedVisual.slice(0, 140)}"\n` : "") +
    `Score 0-100: does the IMAGE show the WANTED VISUAL / fit this scene AND the topic, look photorealistic and high quality, ` +
    `and contain NO readable text/letters/captions/fake labels? Score LOW (below 40) if it is off-subject, an illustration / 3D-render / cartoon, has baked-in or gibberish text, OR shows a PERSON or FACE as a main subject (this is a faceless channel — objects, places, and details only). Return STRICTLY JSON {"score":<int>}.`;
  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: instr }, { inlineData: { mimeType: "image/jpeg", data: bytes.toString("base64") } }] }],
    generationConfig: { responseMimeType: "application/json", temperature: 0, maxOutputTokens: 2000, thinkingConfig: { thinkingBudget: 0 } },
  });
  try {
    const r = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body },
      60_000
    );
    if (!r.ok) return 1;
    const json = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text || "").join("");
    const obj = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? text) as { score?: number };
    return Math.max(0, Math.min(100, Number(obj.score))) / 100;
  } catch {
    return 1;
  }
}

// ── public fallback ───────────────────────────────────────────────────────────

export function aiFallbackEnabled(): boolean {
  return (getSetting("AI_FALLBACK_ENABLED") || "on").trim().toLowerCase() !== "off";
}

export interface AiPhotoResult {
  author: string | null;
  sourceUrl: string;
  source: string;
  dedupeId: string;
}

/**
 * Generate a relevant AI photo to `outPath` when real footage was too weak.
 * Regenerates (different composition) until it clears AI_MATCH_THRESHOLD or
 * AI_REGEN_ATTEMPTS run out, keeps the best, and only uses it if it scores at
 * least as well as the weak real match (`bestRealScore`, 0..1). Returns a
 * synthetic descriptor (source "ai") on success, or null to fall back to real.
 */
export async function tryAiPhotoFallback(
  runId: string,
  scene: Scene,
  videoContext: string,
  outPath: string,
  bestRealScore: number
): Promise<AiPhotoResult | null> {
  if (!aiFallbackEnabled()) return null;
  const provider = imageProvider();
  if (provider === "gemini" && !getSetting("GOOGLE_API_KEY").trim()) return null;
  if (provider === "genaipro" && !getSetting("GENAIPRO_API_KEY").trim()) return null;
  if (provider === "kie" && !getSetting("KIE_API_KEY").trim()) return null;

  const threshold = Math.max(0, Math.min(100, Number(getSetting("AI_MATCH_THRESHOLD") || "60"))) / 100;
  const maxAttempts = Math.max(1, Math.min(8, Number(getSetting("AI_REGEN_ATTEMPTS") || "3")));
  const base = (scene.visual_queries?.[0] || scene.visual_prompt || scene.text).slice(0, 200);

  log(runId, "info", `Scene #${scene.index}: no relevant real photo (best ${(bestRealScore * 100).toFixed(0)}%) — generating AI (${provider})`, { stage: "animate" });

  let best: { tmp: string; score: number } | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const prompt = buildAiPrompt(base, videoContext, VARIANTS[attempt % VARIANTS.length]);
    const tmp = path.join(os.tmpdir(), `aiimg_${runId.slice(0, 8)}_${scene.index}_${attempt}.jpg`);
    try {
      await generateAiImage(prompt, tmp);
    } catch (e) {
      log(runId, "warn", `Scene #${scene.index}: AI image gen failed (${(e as Error).message.slice(0, 120)})`, { stage: "animate" });
      continue;
    }
    const score = await scoreAiImage(scene.text, videoContext, tmp, base);
    if (!best || score > best.score) {
      if (best) { try { fs.unlinkSync(best.tmp); } catch { /* ignore */ } }
      best = { tmp, score };
    } else {
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    }
    log(runId, "debug", `Scene #${scene.index}: AI image attempt ${attempt + 1}/${maxAttempts} scored ${(score * 100).toFixed(0)}%`, { stage: "animate" });
    if (score >= threshold) break;
  }

  if (!best) return null; // every generation failed → fall back to real
  if (best.score < bestRealScore) {
    // The weak real photo was still at least as relevant — keep it, drop the AI.
    try { fs.unlinkSync(best.tmp); } catch { /* ignore */ }
    return null;
  }
  try {
    fs.copyFileSync(best.tmp, outPath);
    fs.unlinkSync(best.tmp);
  } catch (e) {
    log(runId, "warn", `Scene #${scene.index}: could not save AI image (${(e as Error).message.slice(0, 100)})`, { stage: "animate" });
    return null;
  }
  log(runId, "success", `Scene #${scene.index}: AI fallback image used (${(best.score * 100).toFixed(0)}% vs real ${(bestRealScore * 100).toFixed(0)}%)`, { stage: "animate" });
  return { author: null, sourceUrl: "", source: "ai", dedupeId: `ai_${scene.index}_${attemptStamp()}` };
}

// avoids Math.random/Date.now determinism concerns elsewhere; here Date.now is fine
function attemptStamp(): number {
  return Date.now();
}
