"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface RunCost {
  runId: string;
  title: string;
  status: string;
  createdAt: string;
  durationSec: number | null;
  geminiUsd: number;
  aiImageUsd: number;
  voiceUsd: number;
  alignUsd: number;
  totalUsd: number;
  costPerMin: number | null;
}
interface CostsResp {
  currency: string;
  note: string;
  overview: {
    totalUsd: number;
    totalThisMonthUsd: number;
    byProvider: Record<string, number>;
    blendedPerMin: number | null;
  };
  runs: RunCost[];
}

function money(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n > 0 && n < 0.01) return `$${n.toFixed(4)}`; // sub-cent rows shouldn't read $0.00
  return `$${n.toFixed(2)}`;
}
function fmtDate(iso: string): string {
  // stored "YYYY-MM-DD HH:MM:SS" (UTC) — show the date part, no TZ math
  const d = (iso || "").slice(0, 10).split("-");
  return d.length === 3 ? `${d[2]}.${d[1]}.${d[0]}` : iso;
}
function fmtDur(sec: number | null): string {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function CostsPage() {
  const [data, setData] = useState<CostsResp | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/costs")
        .then((r) => r.json())
        .then((d) => { if (alive) { setData(d); setErr(false); } })
        .catch(() => { if (alive) setErr(true); });
    load();
    const t = setInterval(load, 5000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  if (!data) {
    return (
      <div>
        <h1>Costs</h1>
        <p className="muted">{err ? "Could not load costs." : "Loading…"}</p>
      </div>
    );
  }

  const ov = data.overview;

  return (
    <div>
      <h1>Costs</h1>
      <p className="muted" style={{ marginBottom: 20, fontSize: 14 }}>
        Estimated API cost per video, from provider list prices. Stock footage (Pexels, Pixabay, Openverse,
        Wikimedia) is free — cost comes from Gemini, AI image generation, voice, and Whisper alignment.
      </p>

      {/* Overview cards */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        {[
          { label: "Total (all time)", val: money(ov.totalUsd) },
          { label: "This month", val: money(ov.totalThisMonthUsd) },
          { label: "Per finished minute", val: ov.blendedPerMin != null ? money(ov.blendedPerMin) : "—" },
        ].map((c) => (
          <div key={c.label} className="card" style={{ flex: "1 1 180px", minWidth: 160 }}>
            <div style={{ fontSize: 12.5, color: "var(--fg-muted)", marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--accent-hover)" }}>{c.val}</div>
          </div>
        ))}
      </div>

      {/* Per-run table */}
      <div className="card" style={{ overflowX: "auto" }}>
        <h2 style={{ marginBottom: 10 }}>Per video</h2>
        {data.runs.length === 0 ? (
          <p className="faint" style={{ fontSize: 13 }}>No runs yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--fg-muted)", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "6px 8px" }}>Date</th>
                <th style={{ padding: "6px 8px" }}>Video</th>
                <th style={{ padding: "6px 8px" }}>Length</th>
                <th style={{ padding: "6px 8px", textAlign: "right" }}>Gemini</th>
                <th style={{ padding: "6px 8px", textAlign: "right" }}>AI img</th>
                <th style={{ padding: "6px 8px", textAlign: "right" }}>Voice</th>
                <th style={{ padding: "6px 8px", textAlign: "right" }}>Align</th>
                <th style={{ padding: "6px 8px", textAlign: "right" }}>Total</th>
                <th style={{ padding: "6px 8px", textAlign: "right" }}>$/min</th>
              </tr>
            </thead>
            <tbody>
              {data.runs.map((r) => (
                <tr key={r.runId} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "6px 8px", color: "var(--fg-muted)", whiteSpace: "nowrap" }}>{fmtDate(r.createdAt)}</td>
                  <td style={{ padding: "6px 8px", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <Link href={`/runs/${r.runId}`} style={{ color: "var(--fg)", textDecoration: "none" }}>{r.title}</Link>
                  </td>
                  <td style={{ padding: "6px 8px", color: "var(--fg-muted)" }}>{fmtDur(r.durationSec)}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", color: "var(--fg-muted)" }}>{money(r.geminiUsd)}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", color: "var(--fg-muted)" }}>{money(r.aiImageUsd)}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", color: "var(--fg-muted)" }}>{money(r.voiceUsd)}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", color: "var(--fg-muted)" }}>{money(r.alignUsd)}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>{money(r.totalUsd)}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", color: "var(--fg-muted)" }}>{money(r.costPerMin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="faint" style={{ fontSize: 11.5, marginTop: 10 }}>
          Voice on GenAIPro and images on GenAIPro are credit-based (no public per-unit price) so they show $0.00 —
          set a rate in the COST_* settings to include them.
        </p>
      </div>
    </div>
  );
}
