import { NextResponse } from "next/server";
import db from "@/lib/db";
import { ensureInit } from "@/lib/init";
import { summarizeRun, overview } from "@/lib/services/cost-ledger";
import { usdToDisplay } from "@/lib/pricing";

// Exact-match the runs list handler in db.ts (JSON store — string must match verbatim).
const listRuns = db.prepare(
  "SELECT id, title, folder_name, status, created_at, updated_at, output_path FROM runs ORDER BY created_at DESC LIMIT 50"
);

interface RunRow {
  id: string;
  title: string | null;
  folder_name: string;
  status: string;
  created_at: string;
}

/** GET → per-run cost breakdown + all-time / this-month overview (display currency). */
export async function GET() {
  ensureInit();
  const fx = usdToDisplay(1); // 1.0 = USD
  const rows = listRuns.all() as RunRow[];

  const runs = rows.map((r) => {
    const c = summarizeRun(r.id);
    const perMinUsd = c.durationSec && c.durationSec > 0 ? c.totalUsd / (c.durationSec / 60) : null;
    return {
      runId: r.id,
      title: r.title || r.folder_name || r.id.slice(0, 8),
      status: r.status,
      createdAt: r.created_at,
      durationSec: c.durationSec,
      geminiUsd: usdToDisplay(c.geminiUsd),
      aiImageUsd: usdToDisplay(c.aiImageUsd),
      voiceUsd: usdToDisplay(c.voiceUsd),
      alignUsd: usdToDisplay(c.alignUsd),
      totalUsd: usdToDisplay(c.totalUsd),
      costPerMin: perMinUsd != null ? usdToDisplay(perMinUsd) : null,
    };
  });

  const ov = overview();
  const totalMinutes = runs.reduce((a, r) => a + (r.durationSec ? r.durationSec / 60 : 0), 0);

  return NextResponse.json({
    currency: fx === 1 ? "USD" : "cur",
    note: "Estimates from provider list prices (see COST_* settings). Pexels/Pixabay/Openverse/Wikimedia are free.",
    overview: {
      totalUsd: usdToDisplay(ov.totalUsd),
      totalThisMonthUsd: usdToDisplay(ov.totalThisMonthUsd),
      byProvider: Object.fromEntries(Object.entries(ov.byProvider).map(([k, v]) => [k, usdToDisplay(v)])),
      blendedPerMin: totalMinutes > 0 ? usdToDisplay(ov.totalUsd) / totalMinutes : null,
    },
    runs,
  });
}
