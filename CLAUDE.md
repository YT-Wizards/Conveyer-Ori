# CLAUDE.md — project context for Claude Code

Auto-loaded by Claude Code. Full picture of **Conveyer Ori**.

> ⚠️ **Trust the CODE, not prose docs.** This file and README can drift. When a
> claim here disagrees with `src/`, the code wins. (The previous CLAUDE.md, from
> the Guilherme parent, was badly stale — e.g. it claimed "no photos / MiniMax
> only / no multi-TTS"; all three were false. Don't repeat that mistake.)

---

## What this is

A **local web app** for making **long-form (≈1 hour) faceless-YouTube videos**.
Runs entirely on the user's machine (Next.js dev server + local store + local
FFmpeg) — no hosted backend, no cloud.

One mode: paste a script → Gemini splits it into scenes → each scene gets a
visual (real stock footage or a Ken-Burns photo) + one continuous AI voiceover →
FFmpeg assembles `final.mp4`. Optional Google Drive backup of finished runs.

**Client:** Ori Moyal (referred by Andrew). **Niche:** firearms / weapons from a
**historical** angle (ref channels: Fallen Firearms Empires, The Pistol
Archives, ForgottenArsenal). EN, 16:9 1080p, **no speech captions**. He writes
the scripts and runs the app himself.

**Must run on BOTH macOS and Windows** (see "Cross-platform" below).

---

## Origin / fork lineage

Forked from **Conveyer Guilherme** (`relevance-fix` branch @ e5cabcb) — chosen
because it already has, working and client-accepted: real-footage relevance
(Gemini Vision cascade), photo Ken-Burns, single continuous voiceover, text
overlays, and **no avatar**. We add Ori's **two-zone** structure on top.

---

## THE headline feature — Two-Zone timeline (status: TO BUILD)

Ori wants one ~1h video split into two pacing zones on a single continuous VO:

- **Zone A — Intro** (first ~2–3 min): *engaging.* Visual changes ~every **5 s**,
  a **mix of real stock VIDEO + photos**, relevance-matched to the script (the
  Guilherme Vision cascade). This is where the channels-he-copies put real
  footage.
- **Zone B — Body** (rest of the hour): *slow.* Visual changes ~every **15 s**,
  **PHOTOS ONLY** with slow Ken-Burns zoom. Cheaper (no video search, little
  Gemini), and the look he wants for the bulk of the video.

**How it maps onto the existing single-shot pipeline (the levers already exist):**
- Zone boundary = new setting `INTRO_SECONDS` (~150). After Whisper alignment we
  know each scene/sub-clip's start time → tag it intro vs body by that boundary.
- Per-zone pacing = make the sub-clip splitter's `MAX_CLIP_SECONDS` **zone-aware**
  (`INTRO_CLIP_SECONDS≈5`, `BODY_CLIP_SECONDS≈15`). How often the picture changes
  IS this value (`runSingleShot` splits a scene's audio range into ≤maxClip
  sub-clips, each getting its own visual).
- Per-zone lane = make the `pickPhotoScenes()` set **zone-aware**: body scenes are
  ALWAYS `mode:"photo"` (→ Ken-Burns), intro scenes keep the normal video+photo
  routing.
- Keep single-shot VO + Whisper align + **mux assembler (never xfade under a
  master VO)**. Captions OFF (`TEXT_OVERLAY_MODE=off`).

**Phase 2 (later):** "text animation" — a title overlay in the intro + a caption
every ~5 min. Build on `assignTextOverlays` / `detectAndAssignStepOverlays`,
zone-aware. Needs ONE concrete example from Ori before building.

---

## Stack

- **Next.js 16** (App Router, Turbopack) · React 19 · TypeScript · Tailwind 4 · Node ≥20.
- **fluent-ffmpeg** → system FFmpeg (must be installed; `FFMPEG_PATH` override).
- Persistence: **local store outside the repo** at `~/.conveyer-ori/`.
  Currently `better-sqlite3` (`ori.db`) — **being replaced with JSON, see below.**
- Dev server: `npm run dev` (port 3000).

---

## Cross-platform (macOS + Windows) — IMPORTANT, IN PROGRESS

The app must install + run on Windows too. `better-sqlite3` ships a native
`.node` binary that **Windows Defender truncates during `npm install`**, breaking
the app. The Guilherme/Kelvin "fix-native-binaries.mjs" hack copies the binary
from hardcoded `C:/Users/cupak/...` sibling projects — **useless on a client
machine.** So the real fix = **remove the native dependency**: replace the
`better-sqlite3` layer in `src/lib/db.ts` (+ its callers) with a **JSON-file
store** (the Treso/Hub pattern), same interface. **TODO — not done yet.** Until
then the app is Mac-only.

---

## Pipeline — end to end (single-shot mode = default)

Orchestrator: `src/lib/pipeline.ts` `runPipeline(runId, script)`.

1. **Scene split** — `services/scene-split.ts` `splitScript()` (Gemini
   `gemini-2.5-flash`). Returns `Scene[]` with `visual_prompt`, 2–3 query
   candidates, `MAX_SCENE_WORDS` guard.
2. **Single-shot voiceover + align** — `services/tts-align.ts`
   `synthesizeAndAlign()`: one continuous TTS take (chunked at sentence
   boundaries) → **Groq Whisper** word timestamps → `alignScenesToTranscript`
   gives each scene a `[startMs,endMs]` on the global audio. 30 s/scene cap, tail
   proportional, last scene pinned to EOF.
3. **Per-sub-clip visuals** — a scene's audio range is split into ≤`MAX_CLIP_SECONDS`
   sub-clips; each calls `services/img2vid.ts` `animateScene(scene, mode)`:
   - `mode:"video"` → `pexelsClip()`, `mode:"photo"` → `pexelsPhoto()` + Ken-Burns.
   - Real-footage relevance: `services/stock-footage.ts`, Gemini **Vision cascade**
     `VISION_TIERS [0.8,0.7,0.6,0.5]` over thumbnail pixels (wrong-domain ≤20);
     **scene never fails** (falls to best available). 7-day vision cache,
     Pexels/Pixabay/Openverse multi-source, mpdecimate freeze-guard.
   - Lane choice today: `pickPhotoScenes()` from `SCENE_PHOTO_RATIO` + `SCENE_MIX_MODE`
     (global). ← **two-zone build makes this zone-aware.**
4. **Assembly** — `services/video-assemble.ts` `assembleSingleShot()`: render each
   visual SILENT to exact frames → `concatSimple` (NO xfade) → mux the ONE master
   VO. Ken-Burns: `renderSilentKenBurns()` (zoompan, duration-configurable).
   - Legacy per-scene mode uses **chunked xfade** (`concatWithCrossfadeChunked`,
     `MAX_CLIPS_PER_PASS=50`) — required for long videos (a monolithic xfade with
     hundreds of inputs dies EAGAIN/221). **Don't regress.** Single-shot doesn't
     use it.

No avatar / HeyGen in the pipeline (settings exist but are orphaned). Output =
local `final.mp4` + optional Drive backup (`GDRIVE_SYNC_ENABLED`).

---

## Voice / TTS — OWNED BY VLAD'S ASSISTANT (do not build)

Ori uses **GenAIPro** (Gemini API + a manually-typed Voice ID, same voice every
video) because ElevenLabs credits cost more. **Vlad's assistant wires the
GenAIPro TTS provider** (a new case in `services/tts.ts` `resolveTtsProvider` +
a `genaipro` client; reference impl exists in Conveyer Treso
`services/genaipro.ts` + `voice.ts`). It arrives via `git pull`.

→ **To avoid merge collisions: Claude (two-zone work) does NOT edit
`services/tts.ts` / `services/tts-align.ts` provider logic.** Two-zone touches
`pipeline.ts`, `img2vid.ts`, `video-assemble.ts`, `settings.ts`, `_groups.ts`,
`scene-split.ts`. Voice config is just settings keys (stable API).

> **`GENAIPRO_API_KEY` already exists in settings** — it was added for the AI
> image fallback (`services/ai-image.ts`, GenAIPro `nano_banana_pro` image
> provider). The GenAIPro **voice** wiring must **reuse that same key**, not add a
> duplicate (one key = the whole GenAIPro account: voice + Veo image credits).

## AI image fallback (services/ai-image.ts) — real-first, no "AI slop"

The stock cascade always tries REAL footage first. Only when **no real photo**
clears the lowest vision tier does `tryAiPhotoFallback` kick in (wired into
`stock-footage.ts` `acquireFootage`, **photos only**): generate an image →
re-score with the SAME Gemini vision check → regenerate (different composition)
until it clears `AI_MATCH_THRESHOLD` or `AI_REGEN_ATTEMPTS` run out → keep the
best, and use it only if it scores ≥ the weak real match. Providers (`IMAGE_PROVIDER`):
**genaipro** (default, `nano_banana_pro`, `GENAIPRO_API_KEY`) · **gemini**
(`gemini-2.5-flash-image`, `GOOGLE_API_KEY`) · **kie** (`google/nano-banana`, `KIE_API_KEY`).
Falls back to real if no key / all gens fail.

---

## Key files

```
src/lib/
  pipeline.ts          runPipeline orchestrator + runSingleShot (← two-zone here)
  settings.ts          SETTING_KEYS, DEFAULTS (← add INTRO_SECONDS, *_CLIP_SECONDS)
  db.ts                store (← JSON-swap target for Windows)
  run-paths.ts         DATA_DIR (~/.conveyer-ori) + per-run folders
  services/
    scene-split.ts     script → Scene[] (Gemini 2.5-flash)
    tts-align.ts       single-shot VO + Groq Whisper align   [assistant/voice-adjacent]
    tts.ts             provider switch (ai33pro/69labs/minimax/…) [ASSISTANT OWNS]
    img2vid.ts         animateScene(mode), pickPhotoScenes()  (← zone lane)
    stock-footage.ts   Pexels/etc + Gemini Vision cascade
    video-assemble.ts  renderSilentKenBurns, assembleSingleShot, chunked xfade
src/app/settings/_groups.ts   settings form schema (add fields here too)
```

---

## Keys / services

| Service | Used for | Key |
|---|---|---|
| Google Gemini | scene split + Vision relevance | `GOOGLE_API_KEY` |
| Pexels (+Pixabay/Openverse) | real footage/photos | `PEXELS_API_KEY` |
| Groq Whisper | VO word alignment | (Groq key) |
| GenAIPro | voiceover (assistant-wired) | GenAIPro key + Voice ID |

---

## How to verify a change

1. `npx tsc --noEmit` → 0 errors.
2. `npm run build` → succeeds.
3. `npm run dev` → boots on :3000; exercise the changed page.
4. Pipeline changes: short (~30 s) script end-to-end, watch `/runs/[id]` logs.
   (No keyless smoke-render path exists yet — consider porting one.)

## Conventions

- TypeScript stays clean (`tsc --noEmit`) before committing.
- Settings are schema-driven: add a field in `settings.ts` (`SETTING_KEYS` +
  `DEFAULTS`) AND `src/app/settings/_groups.ts`.
- Project path can contain spaces — always `path.join`.
- Secrets masked in UI (`abcd…wxyz`); save handler skips values containing `…`.
- **Footage relevance: cascade, never hard-gate** (no `REAL_MATCH_THRESHOLD=85`
  Patrice-style floor — that starves real footage to "AI slop"). Keep VISION_TIERS.
