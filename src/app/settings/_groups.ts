/**
 * Single source of truth for the settings form schema.
 *
 * DELIBERATELY MINIMAL: only the settings people actually change are shown —
 * required keys, voice, AI images, the two-zone timeline, and a tiny collapsed
 * "Advanced" group (output folder / ffmpeg / extra source key). EVERYTHING else
 * (vision thresholds, concurrency, caption styling, assembly knobs, models, …)
 * still works via DEFAULTS in src/lib/settings.ts — it just isn't rendered, so
 * the page doesn't drown the user in fields nobody touches. To re-expose a
 * hidden setting, add a Field for its key here; no other change needed.
 * Provider keys/models use `showIf` so only the CHOSEN provider's key is shown.
 */

export interface Field {
  key: string;
  label?: string;
  desc: string;
  examples?: string;
  required?: boolean;
  multiline?: boolean;
  /** Hard character cap for short hint fields. */
  maxLength?: number;
  /** Render as a dropdown with these options instead of a text input. */
  type?: "select";
  options?: { value: string; label: string }[];
  /** Show this field only when one of these conditions matches (e.g. reveal a
   *  provider's key/model only when that provider is selected). Shown always if omitted. */
  showIf?: { key: string; in: string[] }[];
}

export interface Group {
  title: string;
  subtitle?: string;
  required?: boolean;
  /** Render collapsed — advanced/technical settings hidden behind a disclosure. */
  collapsed?: boolean;
  fields: Field[];
}

// Which voice engine uses which key (so we only show the selected one's key).
const VOICE_AI33 = ["ai33pro", "kokoro", "minimax-ai33pro"];

export const ALL_GROUPS: Group[] = [
  // ── 1. REQUIRED ──────────────────────────────────────────────────────────
  {
    title: "Required Keys",
    subtitle: "The three keys the app needs to work at all. Paste each, then click Save.",
    required: true,
    fields: [
      {
        key: "GOOGLE_API_KEY",
        label: "Google (Gemini) key",
        desc: "Splits your script into scenes AND checks that footage matches. Free key.",
        examples: "Get it at https://aistudio.google.com/app/apikey",
        required: true,
      },
      {
        key: "PEXELS_API_KEY",
        label: "Pexels key",
        desc: "The library of real video clips and photos. You can paste several keys (one per line) — the app rotates them. Free.",
        examples: "Get it at https://www.pexels.com/api/",
        required: true,
        multiline: true,
      },
      {
        key: "GROQ_API_KEY",
        label: "Groq key",
        desc: "Lines the voiceover up perfectly with the pictures. Free.",
        examples: "Get it at https://console.groq.com/keys",
        required: true,
      },
    ],
  },

  // ── 2. VOICE ─────────────────────────────────────────────────────────────
  {
    title: "Voice Over",
    subtitle: "Pick the engine that reads your script, then enter only its key + your Voice ID.",
    fields: [
      {
        key: "TTS_PROVIDER",
        label: "Voice engine",
        desc: "Which service generates the narration. GenAIPro covers voice AND images on one key.",
        type: "select",
        options: [
          { value: "elevenlabs", label: "ElevenLabs — direct (fast & stable, recommended)" },
          { value: "genaipro", label: "GenAIPro (voice + images, one key — slower)" },
          { value: "ai33pro", label: "ElevenLabs voices (via ai33.pro)" },
          { value: "69labs", label: "ElevenLabs voices (via 69labs)" },
          { value: "minimax", label: "MiniMax (direct)" },
          { value: "minimax-ai33pro", label: "MiniMax (via ai33.pro)" },
          { value: "kokoro", label: "Kokoro (via ai33.pro)" },
        ],
      },
      {
        key: "ELEVENLABS_API_KEY",
        label: "ElevenLabs key",
        desc: "Your ElevenLabs account API key — used for the direct ElevenLabs voice (fast & stable). Your Voice ID goes in the field below.",
        examples: "Paste locally only; never commit keys.",
        showIf: [{ key: "TTS_PROVIDER", in: ["elevenlabs"] }],
      },
      {
        key: "GENAIPRO_API_KEY",
        label: "GenAIPro key (voice + images)",
        desc: "Your GenAIPro key. One key for the whole GenAIPro account — voice and AI images. Needs Veo credits for images.",
        examples: "Paste locally only; never commit keys.",
        showIf: [{ key: "TTS_PROVIDER", in: ["genaipro"] }],
      },
      {
        key: "AI33PRO_API_KEY",
        label: "ai33.pro key",
        desc: "Used for the ai33.pro / kokoro / MiniMax-via-ai33pro voice engines.",
        examples: "Paste locally only.",
        showIf: [{ key: "TTS_PROVIDER", in: VOICE_AI33 }],
      },
      {
        key: "LABS69_API_KEY",
        label: "69labs key",
        desc: "Used for the 69labs voice engine.",
        examples: "vk_...",
        showIf: [{ key: "TTS_PROVIDER", in: ["69labs"] }],
      },
      {
        key: "MINIMAX_API_KEY",
        label: "MiniMax key",
        desc: "Used for the MiniMax (direct) voice engine.",
        examples: "Paste locally only.",
        showIf: [{ key: "TTS_PROVIDER", in: ["minimax"] }],
      },
      {
        key: "MINIMAX_GROUP_ID",
        label: "MiniMax Group ID",
        desc: "Required by some MiniMax accounts.",
        examples: "From your MiniMax dashboard",
        showIf: [{ key: "TTS_PROVIDER", in: ["minimax"] }],
      },
      {
        key: "TTS_VOICE_ID",
        label: "Voice ID",
        desc: "The voice to use — paste the exact Voice ID from your provider. Same voice every video.",
        examples: "ElevenLabs id · Kokoro voice · MiniMax voice",
      },
      {
        key: "TTS_SPEED",
        label: "Voice speed",
        desc: "Playback tempo. Lower = calmer, slower narration.",
        examples: "1.0 normal · 0.9 calmer",
      },
    ],
  },

  // ── 3. AI IMAGES ─────────────────────────────────────────────────────────
  {
    title: "AI Images (fallback)",
    subtitle: "When NO relevant real photo is found, the app generates an on-topic image instead of using a weak stock photo. Real footage is always tried first.",
    fields: [
      {
        key: "AI_FALLBACK_ENABLED",
        label: "Use AI fallback",
        desc: "On = generate an AI photo only when no real photo is relevant enough. Off = always use the best available real photo (no AI).",
        type: "select",
        options: [
          { value: "on", label: "On — fill gaps with AI (recommended)" },
          { value: "off", label: "Off — real photos only" },
        ],
      },
      {
        key: "IMAGE_PROVIDER",
        label: "AI image provider",
        desc: "Which service generates the AI photo. All produce the same Google nano-banana image family.",
        type: "select",
        options: [
          { value: "genaipro", label: "GenAIPro (same key as voice)" },
          { value: "gemini", label: "Gemini (uses your Google key)" },
          { value: "kie", label: "kie.ai (separate kie.ai key)" },
        ],
        showIf: [{ key: "AI_FALLBACK_ENABLED", in: ["on"] }],
      },
      {
        key: "GENAIPRO_API_KEY",
        label: "GenAIPro key (voice + images)",
        desc: "Your GenAIPro key — same key as the voice. Needs Veo image credits.",
        examples: "Paste locally only.",
        showIf: [{ key: "IMAGE_PROVIDER", in: ["genaipro"] }],
      },
      {
        key: "KIE_API_KEY",
        label: "kie.ai key",
        desc: "Your kie.ai key (only needed if you pick the kie provider).",
        examples: "Paste locally only.",
        showIf: [{ key: "IMAGE_PROVIDER", in: ["kie"] }],
      },
    ],
  },

  // ── 4. TWO-ZONE ──────────────────────────────────────────────────────────
  {
    title: "Two-Zone Timeline (Intro + Body)",
    subtitle: "The video is built in two parts over one continuous voiceover: an engaging INTRO (real video + a few photos, fast) then a slow, photo-only BODY with Ken-Burns zoom.",
    fields: [
      {
        key: "INTRO_SECONDS",
        label: "Intro length (seconds)",
        desc: "How long the fast, engaging intro lasts. Everything after is the slow photo body. Set 0 for no intro (whole video = slow photos). Tip: paste the intro and the body into their own boxes on the New Run page — then this boundary is exact automatically.",
        examples: "150 = 2.5 min (default) · 120 · 180 · 0 = off",
      },
      { key: "INTRO_CLIP_SECONDS", label: "Intro: seconds per visual", desc: "How often the picture changes during the intro.", examples: "5 default" },
      { key: "BODY_CLIP_SECONDS", label: "Body: seconds per photo", desc: "How often the photo changes during the slow body.", examples: "15 default · 12 faster" },
      {
        key: "INTRO_PHOTO_RATIO",
        label: "Intro photo / video mix (%)",
        desc: "Percent of intro visuals that are photos; the rest are video clips. The body is always photos.",
        examples: "20 default (mostly video) · 0 all video",
      },
    ],
  },

  // ── 5. ADVANCED (the only collapsed group) ───────────────────────────────
  {
    title: "Advanced",
    collapsed: true,
    subtitle: "Rarely needed. Everything else (quality thresholds, performance, captions, models) is tuned automatically — no need to touch anything.",
    fields: [
      {
        key: "RUNS_OUTPUT_DIR",
        label: "Output folder",
        desc: "Where finished videos are saved. Empty = default app data folder.",
        examples: "Mac: /Users/you/Documents/Conveyer-Runs · Windows: D:\\YouTube\\Conveyer-Runs",
      },
      {
        key: "FFMPEG_PATH",
        label: "FFmpeg path",
        desc: "Only if FFmpeg is not on your system PATH (the app will tell you if so).",
        examples: "Mac: /opt/homebrew/bin/ffmpeg · Windows: C:\\ffmpeg\\bin\\ffmpeg.exe",
      },
      {
        key: "PIXABAY_API_KEY",
        label: "Pixabay key (optional)",
        desc: "Adds Pixabay as an extra footage source — more candidates for rare subjects. Works fine without it.",
        examples: "Get it at https://pixabay.com/api/docs/",
      },
    ],
  },
];
