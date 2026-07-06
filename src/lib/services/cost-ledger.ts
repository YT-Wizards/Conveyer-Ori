import { pushCostRow, readCostRows } from "../db";
import {
  priceGeminiTokens,
  priceGeminiImage,
  priceKieImage,
  priceGenaiproImage,
  priceElevenlabs,
  priceGenaiproTts,
  priceGroqWhisper,
} from "../pricing";

/**
 * Cost ledger — every paid API call appends ONE row to the JSON store's
 * `run_costs` array. All recorders are FAIL-OPEN (a lost cost row must never
 * break a render) and no-op without a runId. The /costs tab aggregates these.
 *
 * Buckets (category): gemini (scene-split + vision + QC + style, per token) ·
 * aiImage (per image) · voice (ElevenLabs per char / GenAIPro per task) ·
 * align (Groq Whisper per audio-second) · meta (run duration, $0).
 */

export type CostCategory = "gemini" | "aiImage" | "voice" | "align" | "meta";

interface CostRow {
  id: string;
  run_id: string;
  ts: string;
  provider: string;
  category: CostCategory;
  model: string;
  units: number;
  unit_label: string;
  amount_usd: number;
  estimated: boolean;
}

function append(row: Omit<CostRow, "id" | "ts">): void {
  try {
    if (!row.run_id) return;
    pushCostRow({
      id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ts: new Date().toISOString(),
      ...row,
    });
  } catch {
    /* fail-open */
  }
}

/** gemini-2.5-flash text/vision (scene-split, relevance scoring, per-frame QC, style). */
export function recordGemini(runId: string, promptTokens: number, outputTokens: number, model = "gemini-2.5-flash"): void {
  try {
    append({
      run_id: runId,
      provider: `gemini:${model}`,
      category: "gemini",
      model,
      units: (promptTokens || 0) + (outputTokens || 0),
      unit_label: "tokens",
      amount_usd: priceGeminiTokens(promptTokens || 0, outputTokens || 0),
      estimated: false,
    });
  } catch {
    /* fail-open */
  }
}

/** One generated AI image (provider decides the flat rate). */
export function recordAiImage(runId: string, provider: "gemini" | "kie" | "genaipro", model = ""): void {
  try {
    const amount = provider === "kie" ? priceKieImage(1) : provider === "genaipro" ? priceGenaiproImage(1) : priceGeminiImage(1);
    append({
      run_id: runId,
      provider: `ai-image:${provider}`,
      category: "aiImage",
      model,
      units: 1,
      unit_label: "images",
      amount_usd: amount,
      estimated: provider === "genaipro", // credit-based → $0 until operator sets a rate
    });
  } catch {
    /* fail-open */
  }
}

/** One voice synthesis chunk. ElevenLabs = per char; GenAIPro = per task. */
export function recordVoice(runId: string, provider: string, chars: number, model = ""): void {
  try {
    if (provider === "genaipro") {
      append({
        run_id: runId,
        provider: "voice:genaipro",
        category: "voice",
        model,
        units: 1,
        unit_label: "tasks",
        amount_usd: priceGenaiproTts(1),
        estimated: true,
      });
    } else {
      append({
        run_id: runId,
        provider: `voice:${provider}`,
        category: "voice",
        model,
        units: chars || 0,
        unit_label: "chars",
        amount_usd: priceElevenlabs(chars || 0, model),
        estimated: false,
      });
    }
  } catch {
    /* fail-open */
  }
}

/** Groq whisper-large-v3 alignment pass. */
export function recordWhisper(runId: string, audioSeconds: number): void {
  try {
    append({
      run_id: runId,
      provider: "groq:whisper-large-v3",
      category: "align",
      model: "whisper-large-v3",
      units: Math.round(audioSeconds || 0),
      unit_label: "sec",
      amount_usd: priceGroqWhisper(audioSeconds || 0),
      estimated: false,
    });
  } catch {
    /* fail-open */
  }
}

/** Run duration (for $/minute) — a $0 meta row so we don't touch the runs SQL. */
export function recordRunDuration(runId: string, seconds: number): void {
  try {
    append({
      run_id: runId,
      provider: "meta:duration",
      category: "meta",
      model: "",
      units: Math.round(seconds || 0),
      unit_label: "sec",
      amount_usd: 0,
      estimated: false,
    });
  } catch {
    /* fail-open */
  }
}

// ── Aggregation (read side, used by /api/costs) ───────────────────────────────

export interface RunCost {
  geminiUsd: number;
  aiImageUsd: number;
  voiceUsd: number;
  alignUsd: number;
  totalUsd: number;
  durationSec: number | null;
}

export function summarizeRun(runId: string): RunCost {
  const rows = readCostRows().filter((r) => r.run_id === runId);
  const sum = (cat: string) => rows.filter((r) => r.category === cat).reduce((a, r) => a + (Number(r.amount_usd) || 0), 0);
  const durRow = rows.find((r) => r.category === "meta" && r.provider === "meta:duration");
  const g = sum("gemini");
  const ai = sum("aiImage");
  const v = sum("voice");
  const al = sum("align");
  return {
    geminiUsd: g,
    aiImageUsd: ai,
    voiceUsd: v,
    alignUsd: al,
    totalUsd: g + ai + v + al,
    durationSec: durRow ? Number(durRow.units) || null : null,
  };
}

export function overview(): { totalUsd: number; totalThisMonthUsd: number; byProvider: Record<string, number> } {
  const rows = readCostRows();
  const now = new Date();
  const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  let total = 0;
  let month = 0;
  const byProvider: Record<string, number> = {};
  for (const r of rows) {
    const amt = Number(r.amount_usd) || 0;
    total += amt;
    if (typeof r.ts === "string" && r.ts.startsWith(ym)) month += amt;
    const p = String(r.provider || "?").split(":")[0];
    byProvider[p] = (byProvider[p] || 0) + amt;
  }
  return { totalUsd: total, totalThisMonthUsd: month, byProvider };
}
