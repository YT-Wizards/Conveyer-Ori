"use client";
import { useEffect, useRef, useState } from "react";

interface StyleState {
  enabled: boolean;
  text: string;
  profile: string;
  images: string[];
  max: number;
}

export default function StylePage() {
  const [state, setState] = useState<StyleState | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedTick, setSavedTick] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function refresh() {
    const r = await fetch("/api/style");
    const s = (await r.json()) as StyleState;
    setState(s);
    setText(s.text);
  }
  useEffect(() => {
    refresh().catch(() => setError("Could not load style state"));
  }, []);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy("upload");
    setError(null);
    try {
      const fd = new FormData();
      for (const f of Array.from(files)) fd.append("files", f);
      await fetch("/api/style", { method: "POST", body: fd });
      await refresh();
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function removeImage(name: string) {
    setBusy(`del:${name}`);
    try {
      await fetch(`/api/style?name=${encodeURIComponent(name)}`, { method: "DELETE" });
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  async function saveText() {
    setBusy("save");
    try {
      await fetch("/api/style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 1800);
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  async function toggleEnabled() {
    if (!state) return;
    await fetch("/api/style", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !state.enabled }),
    });
    await refresh();
  }

  async function analyze() {
    setBusy("analyze");
    setError(null);
    try {
      // Save the text first so the analysis sees the latest description.
      await fetch("/api/style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const r = await fetch("/api/style/analyze", { method: "POST" });
      const j = (await r.json()) as { profile?: string; error?: string };
      if (!r.ok || j.error) setError(j.error || "Analysis failed");
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  if (!state) {
    return (
      <div>
        <h1>Channel Style</h1>
        <p className="muted">Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <h1>Channel Style</h1>
      <p className="muted" style={{ marginBottom: 20, fontSize: 14 }}>
        Define your channel&apos;s visual identity ONCE — upload reference images and describe the look you want.
        The app applies it everywhere: AI-generated images copy this style, and stock footage that
        doesn&apos;t match it (wrong era, modern look) is rejected during selection.
      </p>

      {/* Enabled toggle */}
      <div className="card" style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <input type="checkbox" checked={state.enabled} onChange={toggleEnabled} id="style-on" />
        <label htmlFor="style-on" style={{ fontSize: 14 }}>
          <strong>Apply channel style</strong>
          <span className="muted" style={{ marginLeft: 8, fontSize: 13 }}>
            {state.enabled ? "on — AI images + stock selection follow the style below" : "off — topic matching only, no style filter"}
          </span>
        </label>
      </div>

      {/* Reference images */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginBottom: 6 }}>Reference images</h2>
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
          5–8 images showing the exact look you want (screenshots from videos you admire work great). {state.images.length}/{state.max} uploaded.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
          {state.images.map((name) => (
            <div key={name} style={{ position: "relative", width: 148 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/style/file/${encodeURIComponent(name)}`}
                alt={name}
                style={{ width: 148, height: 92, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }}
              />
              <button
                className="btn"
                onClick={() => removeImage(name)}
                disabled={busy !== null}
                title="Remove"
                style={{ position: "absolute", top: 4, right: 4, padding: "1px 7px", fontSize: 12, lineHeight: 1.6 }}
              >
                ✕
              </button>
            </div>
          ))}
          {state.images.length === 0 && (
            <span className="faint" style={{ fontSize: 13 }}>No reference images yet.</span>
          )}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".jpg,.jpeg,.png,.webp"
          multiple
          onChange={(e) => upload(e.target.files)}
          disabled={busy !== null || state.images.length >= state.max}
        />
      </div>

      {/* Written description */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginBottom: 6 }}>Style description (your own words)</h2>
        <textarea
          className="textarea"
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='e.g. "aged black-and-white period engraving, film grain, museum lighting, no modern objects"'
        />
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <button className="btn" onClick={saveText} disabled={busy !== null}>
            {savedTick ? "Saved ✓" : "Save description"}
          </button>
          <button className="btn" onClick={analyze} disabled={busy !== null}>
            {busy === "analyze" ? "Analyzing…" : "Analyze style →"}
          </button>
        </div>
        {error && (
          <p style={{ color: "var(--accent)", fontSize: 13, marginTop: 10 }}>{error}</p>
        )}
      </div>

      {/* The derived profile */}
      <div className="card">
        <h2 style={{ marginBottom: 6 }}>Style profile (what the app will apply)</h2>
        <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
          Built by AI from your references + description when you click &quot;Analyze style&quot;. This exact
          text steers image generation and filters stock picks. Re-analyze after changing references.
        </p>
        {state.profile ? (
          <p style={{ fontSize: 13.5, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{state.profile}</p>
        ) : (
          <p className="faint" style={{ fontSize: 13 }}>
            No profile yet — {state.text ? "your written description above is used as-is until you analyze." : "add references and click Analyze."}
          </p>
        )}
      </div>
    </div>
  );
}
