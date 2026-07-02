"use client";
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePersistedState } from "./_use-persisted-state";

// Rough estimate: TTS narration averages ~150 words per minute
const WORDS_PER_MINUTE = 150;

// Per-job time estimates (in seconds), empirically tuned from production runs
const AVG_TTS_SEC = 4;
const AVG_PEXELS_SEC = 6;
const AVG_CLIP_RENDER_SEC = 8;

interface StatsResp {
  keyConfigured: number;
  ttsConcurrency: number;
  animConcurrency: number;
  assembleConcurrency: number;
}

function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

export default function NewRunPage() {
  const [title, setTitle] = usePersistedState("newrun.title", "");
  // Two-zone input: an engaging INTRO (fast, mostly video) and the slow BODY
  // (photos with Ken-Burns). They are voiced as ONE continuous voiceover, but the
  // visuals use each zone's own pace + photo/video mix. Paste each part in its own
  // box so the label words are never read aloud and the boundary is exact.
  const [introScript, setIntroScript] = usePersistedState("newrun.introScript", "");
  const [bodyScript, setBodyScript] = usePersistedState("newrun.bodyScript", "");
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<StatsResp | null>(null);

  const router = useRouter();

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  const scriptStats = useMemo(() => {
    const introWords = countWords(introScript);
    const bodyWords = countWords(bodyScript);
    const words = introWords + bodyWords;
    const chars = introScript.trim().length + bodyScript.trim().length;
    const seconds = (words / WORDS_PER_MINUTE) * 60;
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return {
      words,
      introWords,
      bodyWords,
      chars,
      duration: words === 0 ? "—" : m > 0 ? `~${m} min ${s} s` : `~${s} s`,
      scenes: Math.max(1, Math.round(seconds / 5)),
    };
  }, [introScript, bodyScript]);

  const timeEstimate = useMemo(() => {
    if (!stats || scriptStats.scenes === 0) return null;
    const N = scriptStats.scenes;
    const ttsMin = (Math.ceil(N / stats.ttsConcurrency) * AVG_TTS_SEC) / 60;
    const animMin = (Math.ceil(N / stats.animConcurrency) * AVG_PEXELS_SEC) / 60;
    const phase1 = Math.max(ttsMin, animMin);
    const phase2 = (Math.ceil(N / stats.assembleConcurrency) * AVG_CLIP_RENDER_SEC) / 60;
    return { total: phase1 + phase2, phase1, phase2, ttsMin, animMin };
  }, [stats, scriptStats]);

  const canRun = bodyScript.trim().length > 0 || introScript.trim().length > 0;

  async function start() {
    setBusy(true);
    try {
      const r = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, introScript, bodyScript }),
      });
      if (!r.ok) {
        alert(`Error: ${await r.text()}`);
        return;
      }
      const data = (await r.json()) as { id: string };
      router.push(`/runs/${data.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>Video Conveyer</h1>
      <p className="muted" style={{ marginBottom: 24, fontSize: 14 }}>
        Paste your script in two parts — a fast, engaging <strong>Intro</strong> (mostly video) and the
        slow <strong>Body</strong> (photos). They are voiced as one continuous voiceover, and each part
        gets its own pacing and photo/video mix automatically.
      </p>

      <div className="card" style={{ display: "grid", gap: 16 }}>
        <div>
          <label className="label">Title (optional)</label>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Jason Becker — Blue Guitar"
          />
        </div>

        <div>
          <label className="label">
            Intro script <span className="faint">— fast, mostly video (~5s per clip)</span>
          </label>
          <textarea
            className="textarea"
            rows={7}
            value={introScript}
            onChange={(e) => setIntroScript(e.target.value)}
            placeholder="Paste the intro / hook here. Leave empty for no intro (whole video = slow photos)."
          />
          <div className="faint" style={{ fontSize: 12.5, marginTop: 6 }}>
            {scriptStats.introWords} words
            {scriptStats.introWords > 0 ? ` · ≈ ${Math.round((scriptStats.introWords / WORDS_PER_MINUTE) * 60)}s` : ""}
          </div>
        </div>

        <div>
          <label className="label">
            Body script <span className="faint">— slow photos, Ken-Burns (~12–15s per photo)</span>
          </label>
          <textarea
            className="textarea"
            rows={12}
            value={bodyScript}
            onChange={(e) => setBodyScript(e.target.value)}
            placeholder="Paste the main body of the script here..."
          />
          <div
            style={{
              display: "flex",
              gap: 18,
              marginTop: 10,
              fontSize: 13,
              color: "var(--fg-muted)",
              flexWrap: "wrap",
            }}
          >
            <span>
              <strong style={{ color: "var(--fg)" }}>{scriptStats.words}</strong> words total
            </span>
            <span>
              <strong style={{ color: "var(--fg)" }}>{scriptStats.chars}</strong> chars
            </span>
            <span>
              ≈ <strong style={{ color: "var(--accent-hover)" }}>{scriptStats.duration}</strong> final video
            </span>
            <span>
              ≈ <strong style={{ color: "var(--fg)" }}>{scriptStats.scenes}</strong> scenes
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn" onClick={start} disabled={busy || !canRun}>
            {busy ? "Starting…" : "Run pipeline"}
          </button>
        </div>
      </div>

      {/* ─── Time estimate ───────────────────────────────────────────────── */}
      {timeEstimate && stats && scriptStats.words > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <h2 style={{ margin: 0 }}>Estimated time</h2>
            <span
              style={{
                color: "var(--accent-hover)",
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: "-0.02em",
              }}
            >
              ~{timeEstimate.total < 1 ? "<1" : Math.round(timeEstimate.total)} min
            </span>
          </div>
          <div style={{ color: "var(--fg-muted)", fontSize: 13, lineHeight: 1.8 }}>
            <div>
              <strong style={{ color: "var(--fg)" }}>Parallel generation</strong>
              {" (TTS + Pexels)"}: ~{Math.round(timeEstimate.phase1)} min
              <span className="faint" style={{ marginLeft: 8 }}>
                {stats.animConcurrency} Pexels / {stats.ttsConcurrency} TTS in parallel
              </span>
            </div>
            <div>
              <strong style={{ color: "var(--fg)" }}>FFmpeg assembly</strong>: ~
              {Math.round(timeEstimate.phase2 * 10) / 10} min
              <span className="faint" style={{ marginLeft: 8 }}>
                {stats.assembleConcurrency} clips at once
              </span>
            </div>
          </div>
          <div className="faint" style={{ fontSize: 11, marginTop: 9 }}>
            Rough numbers — real runs are usually 10–30% faster.
          </div>
        </div>
      )}

      {/* ─── How it works ───────────────────────────────────────────────── */}
      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginBottom: 8 }}>What happens next</h2>
        <ol style={{ paddingLeft: 20, lineHeight: 1.75, margin: 0, color: "var(--fg-muted)", fontSize: 13.5 }}>
          <li>Intro and Body are joined into ONE continuous voiceover (no pause, labels never voiced).</li>
          <li>Gemini splits each part into scenes; the Intro gets fast video+photo, the Body slow photos.</li>
          <li>Footage is matched per scene, then FFmpeg assembles the final MP4.</li>
        </ol>
        <p className="faint" style={{ fontSize: 12.5, marginTop: 10, marginBottom: 0 }}>
          Live logs for every stage stream into the run page in real time.
        </p>
      </div>
    </div>
  );
}
