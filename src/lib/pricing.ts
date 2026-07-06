import { getSetting, type SettingKey } from "./settings";

/**
 * Pure pricing math for the /costs tab — no DB, no side effects. All rates are
 * operator-overridable list prices (USD) from settings; see COST_* keys.
 * Verified against 2026 published prices for Ori's providers only (no HeyGen /
 * 69labs / subscription layer — those are VIP-specific and dropped).
 */

function num(key: SettingKey, fallback: number): number {
  const v = parseFloat(getSetting(key) || "");
  return Number.isFinite(v) ? v : fallback;
}

/** Convert a USD amount to the display currency (default 1.0 = keep USD). */
export function usdToDisplay(usd: number): number {
  return usd * num("COST_USD_TO_EUR", 1.0);
}

/** gemini-2.5-flash text/vision — billed per token (usageMetadata). */
export function priceGeminiTokens(promptTokens: number, outputTokens: number): number {
  const inUsd = (Math.max(0, promptTokens) / 1_000_000) * num("COST_GEMINI_IN_USD_PER_1M", 0.3);
  const outUsd = (Math.max(0, outputTokens) / 1_000_000) * num("COST_GEMINI_OUT_USD_PER_1M", 2.5);
  return inUsd + outUsd;
}

/** gemini-2.5-flash-image — flat per image (response carries no usageMetadata). */
export function priceGeminiImage(images: number): number {
  return Math.max(0, images) * num("COST_GEMINI_IMAGE_USD", 0.039);
}

/** kie.ai nano-banana — flat per image. */
export function priceKieImage(images: number): number {
  return Math.max(0, images) * num("COST_KIE_IMAGE_USD", 0.02);
}

/** GenAIPro nano_banana_pro image — credit-based, $0 until an operator sets a rate. */
export function priceGenaiproImage(images: number): number {
  return Math.max(0, images) * num("COST_GENAIPRO_IMAGE_USD", 0);
}

/** ElevenLabs — per character. flash/turbo v2.5 models bill at half credit/char. */
export function priceElevenlabs(chars: number, model = ""): number {
  const perK = num("COST_ELEVENLABS_USD_PER_1K_CHARS", 0.22);
  const halved = /flash|turbo/i.test(model) ? 0.5 : 1;
  return (Math.max(0, chars) / 1000) * perK * halved;
}

/** GenAIPro voice — credit-based per task, $0 until an operator sets a rate. */
export function priceGenaiproTts(tasks: number): number {
  return Math.max(0, tasks) * num("COST_GENAIPRO_TTS_USD_PER_TASK", 0);
}

/** Groq whisper-large-v3 — per audio-hour. */
export function priceGroqWhisper(audioSeconds: number): number {
  return (Math.max(0, audioSeconds) / 3600) * num("COST_GROQ_WHISPER_USD_PER_HOUR", 0.111);
}
