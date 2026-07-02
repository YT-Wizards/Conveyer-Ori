import fs from "node:fs";
import { getSetting } from "../settings";

/**
 * ElevenLabs DIRECT text-to-speech (your own ElevenLabs account key).
 *
 * Unlike GenAIPro (an async reseller queue that can take hours), ElevenLabs
 * returns the audio SYNCHRONOUSLY from one request — fast and stable. Uses the
 * unified TTS_VOICE_ID (the same field every engine uses) and the account key
 * ELEVENLABS_API_KEY. Speed is native (voice_settings.speed), so dispatchTts
 * must NOT re-apply tempo afterward.
 */

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export async function elevenLabsTts(_runId: string, text: string, outFile: string): Promise<void> {
  const apiKey = getSetting("ELEVENLABS_API_KEY").trim();
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set (Settings → Voice → ElevenLabs key)");
  // Strip a pasted "elevenlabs_" prefix — the direct API wants the bare voice id.
  const voiceId = (getSetting("TTS_VOICE_ID") || "").trim().replace(/^elevenlabs_/i, "");
  if (!voiceId) throw new Error("No Voice ID set — paste your ElevenLabs Voice ID into Settings → Voice → Voice ID");
  const model = getSetting("TTS_MODEL") || "eleven_multilingual_v2";
  const speed = clamp(parseFloat(getSetting("TTS_SPEED")) || 1.0, 0.7, 1.2);

  const body = JSON.stringify({
    text,
    model_id: model,
    voice_settings: { stability: 0.5, similarity_boost: 0.75, speed },
  });

  let lastErr = "";
  for (let attempt = 0; attempt <= 4; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 180_000);
    let resp: Response;
    try {
      resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body,
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(timer);
      lastErr = `ElevenLabs network error: ${e instanceof Error ? e.message : String(e)}`;
      if (attempt === 4) throw new Error(lastErr);
      await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
      continue;
    }
    clearTimeout(timer);

    if (resp.ok) {
      fs.writeFileSync(outFile, Buffer.from(await resp.arrayBuffer()));
      return;
    }
    lastErr = `ElevenLabs ${resp.status}: ${(await resp.text()).slice(0, 300)}`;
    // 401 (bad key) / 422 (bad voice or params) aren't worth retrying.
    if (![429, 500, 502, 503, 504].includes(resp.status) || attempt === 4) throw new Error(lastErr);
    await new Promise((r) => setTimeout(r, (resp.status === 429 ? 5000 : 1500) * 2 ** attempt));
  }
  throw new Error(lastErr);
}
