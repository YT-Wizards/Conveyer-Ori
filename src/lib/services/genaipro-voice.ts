import fs from "node:fs";
import { getSetting } from "../settings";
import { log } from "../logger";
import { checkCancelled } from "../cancellation";

/**
 * GenAIPro (Labs) text-to-speech — one continuous take of `text` → `outFile`.
 *
 * GenAIPro is one account/key for voice AND images (Veo). Voice uses the Labs
 * task API: POST /v1/labs/task -> {task_id}; poll GET /v1/labs/task/{id} until
 * status "completed" -> result mp3 url -> download. Auth: Bearer GENAIPRO_API_KEY.
 *
 * Voice id comes from the unified TTS_VOICE_ID setting (the same field the other
 * engines use), so the user pastes ONE Voice ID regardless of engine.
 */

const BASE = "https://genaipro.io/api";
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function apiKey(): string {
  const k = getSetting("GENAIPRO_API_KEY").trim();
  if (!k) throw new Error("GENAIPRO_API_KEY is not set (Settings → Voice → GenAIPro key)");
  return k;
}

function gapFetch(path: string, init: RequestInit = {}, timeoutMs = 60_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${apiKey()}`, ...(init.headers ?? {}) },
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));
}

async function errText(r: Response): Promise<string> {
  try { return (await r.text()).slice(0, 300); } catch { return ""; }
}

interface LabsTask { status?: string; result?: string; error?: string }

async function createTtsTask(body: string): Promise<string> {
  let lastErr = "";
  for (let attempt = 0; attempt <= 4; attempt++) {
    const resp = await gapFetch("/v1/labs/task", { method: "POST", headers: { "Content-Type": "application/json" }, body });
    if (resp.ok) {
      const json = (await resp.json()) as { task_id?: string };
      if (!json.task_id) throw new Error("GenAIPro TTS: response without task_id");
      return json.task_id;
    }
    lastErr = `GenAIPro TTS ${resp.status}: ${await errText(resp)}`;
    if (![429, 500, 502, 503, 504].includes(resp.status) || attempt === 4) throw new Error(lastErr);
    await sleep((resp.status === 429 ? 10_000 : 2000) * (attempt + 1));
  }
  throw new Error(lastErr);
}

async function pollTtsTask(taskId: string, runId: string): Promise<string> {
  // By DEFAULT (GENAIPRO_TTS_TIMEOUT_MIN = 0) we keep waiting until GenAIPro
  // RESOLVES the task — either "completed" (download the audio) or "failed"
  // (surface the error). The credit is already spent the moment the task is
  // created, so giving up on a still-processing task just throws away a result
  // we already paid for. Set a positive number only if you want a hard cap.
  // The user can always Cancel the run, which breaks out via checkCancelled().
  const capMin = Math.max(0, Number(getSetting("GENAIPRO_TTS_TIMEOUT_MIN") || "0"));
  const deadline = capMin > 0 ? Date.now() + capMin * 60 * 1000 : Infinity;
  while (Date.now() < deadline) {
    checkCancelled(runId); // lets the user stop a stuck task from the run page
    await sleep(6000);
    const resp = await gapFetch(`/v1/labs/task/${encodeURIComponent(taskId)}`);
    if (resp.status === 429) { await sleep(10_000); continue; }
    // Transient network/5xx — keep waiting rather than killing a paid task.
    if (!resp.ok) { await sleep(8000); continue; }
    const task = (await resp.json()) as LabsTask;
    const status = (task.status || "").toLowerCase();
    if (status === "completed") {
      if (!task.result) throw new Error("GenAIPro TTS: completed but no result url");
      return task.result;
    }
    if (status === "failed" || status === "error") {
      throw new Error(`GenAIPro TTS failed: ${task.error || "unknown error"}`);
    }
    // still processing / queued — keep waiting (GenAIPro holds the task server-side).
  }
  throw new Error(`GenAIPro TTS: task exceeded the ${capMin}-min cap (set GENAIPRO_TTS_TIMEOUT_MIN=0 in Settings to wait until it finishes)`);
}

async function downloadToFile(url: string, outFile: string): Promise<void> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`GenAIPro TTS download ${r.status}`);
  fs.writeFileSync(outFile, Buffer.from(await r.arrayBuffer()));
}

/** Synthesize one piece of text to `outFile` (mp3) via GenAIPro. Speed is applied
 *  natively here, so dispatchTts must NOT re-apply tempo afterward. */
export async function genaiproTts(runId: string, text: string, outFile: string): Promise<void> {
  const voiceId = (getSetting("TTS_VOICE_ID") || "").trim();
  if (!voiceId) {
    throw new Error("No Voice ID set — paste your GenAIPro Voice ID into Settings → Voice → Voice ID");
  }
  const model = getSetting("GENAIPRO_TTS_MODEL") || "eleven_multilingual_v2";
  const speed = clamp(parseFloat(getSetting("TTS_SPEED")) || 1.0, 0.7, 1.2);
  const body = JSON.stringify({
    input: text,
    voice_id: voiceId,
    model_id: model,
    stability: 0.5,
    similarity: 0.75,
    speed,
    use_speaker_boost: true,
  });

  const taskId = await createTtsTask(body);
  log(runId, "debug", `GenAIPro TTS task ${taskId.slice(0, 8)}… (voice ${voiceId}, ${model})`, { stage: "tts" });
  const url = await pollTtsTask(taskId, runId);
  await downloadToFile(url, outFile);
}
