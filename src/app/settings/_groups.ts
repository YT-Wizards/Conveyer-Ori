/**
 * Single source of truth for the settings form schema.
 *
 * Top of the page = the few things that matter (required keys, voice, AI images,
 * the two-zone timeline). Everything technical is in `collapsed` groups so it
 * stays out of the way. Provider keys/models use `showIf` so only the key for
 * the CHOSEN provider is shown (no more wall of every provider's key at once).
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
          { value: "genaipro", label: "GenAIPro (voice + images, one key)" },
          { value: "ai33pro", label: "ElevenLabs voices (via ai33.pro)" },
          { value: "69labs", label: "ElevenLabs voices (via 69labs)" },
          { value: "minimax", label: "MiniMax (direct)" },
          { value: "minimax-ai33pro", label: "MiniMax (via ai33.pro)" },
          { value: "kokoro", label: "Kokoro (via ai33.pro)" },
        ],
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
    subtitle: "When NO relevant real photo is found, the app can generate an on-topic image, re-check it, and regenerate until it fits — instead of a weak stock photo. Real footage is always tried first. Mostly affects the slow photo body.",
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
        key: "GENAIPRO_IMAGE_MODEL",
        label: "GenAIPro image model",
        desc: "Image model for GenAIPro.",
        examples: "nano_banana_pro (default) · nano_banana_2 · imagen_4",
        showIf: [{ key: "IMAGE_PROVIDER", in: ["genaipro"] }],
      },
      {
        key: "IMAGE_MODEL",
        label: "Gemini image model",
        desc: "Image model for Gemini.",
        examples: "gemini-2.5-flash-image (default)",
        showIf: [{ key: "IMAGE_PROVIDER", in: ["gemini"] }],
      },
      {
        key: "KIE_API_KEY",
        label: "kie.ai key",
        desc: "Your kie.ai key (only needed if you pick the kie provider).",
        examples: "Paste locally only.",
        showIf: [{ key: "IMAGE_PROVIDER", in: ["kie"] }],
      },
      {
        key: "KIE_IMAGE_MODEL",
        label: "kie.ai image model",
        desc: "Image model for kie.ai.",
        examples: "google/nano-banana (default)",
        showIf: [{ key: "IMAGE_PROVIDER", in: ["kie"] }],
      },
      {
        key: "AI_MATCH_THRESHOLD",
        label: "AI relevance bar (%)",
        desc: "A generated image must score at least this on the relevance check, or it is regenerated.",
        examples: "60 default",
        showIf: [{ key: "AI_FALLBACK_ENABLED", in: ["on"] }],
      },
      {
        key: "AI_REGEN_ATTEMPTS",
        label: "Max regenerations",
        desc: "How many times to regenerate (different composition each time) before keeping the best.",
        examples: "3 default · 1-8",
        showIf: [{ key: "AI_FALLBACK_ENABLED", in: ["on"] }],
      },
      {
        key: "AI_IMAGE_STYLE",
        label: "AI style hint (optional)",
        desc: "Optional extra style words for every AI image. Empty = plain documentary realism.",
        examples: "empty = documentary realism",
        showIf: [{ key: "AI_FALLBACK_ENABLED", in: ["on"] }],
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
        desc: "How long the fast, engaging intro lasts. Everything after is the slow photo body. Set 0 for no intro (whole video = slow photos).",
        examples: "150 = 2.5 min (default) · 120 · 180 · 0 = off",
      },
      { key: "INTRO_CLIP_SECONDS", label: "Intro: seconds per visual", desc: "How often the picture changes during the intro.", examples: "5 default" },
      { key: "BODY_CLIP_SECONDS", label: "Body: seconds per photo", desc: "How often the photo changes during the slow body.", examples: "15 default" },
      {
        key: "INTRO_PHOTO_RATIO",
        label: "Intro photo / video mix (%)",
        desc: "Percent of intro visuals that are photos; the rest are video clips. The body is always photos.",
        examples: "20 default (mostly video) · 0 all video",
      },
    ],
  },

  // ── ADVANCED (all collapsed) ─────────────────────────────────────────────
  {
    title: "Voice — advanced",
    collapsed: true,
    subtitle: "Fine voice settings. Defaults are fine for most videos.",
    fields: [
      { key: "TTS_MODE", label: "Voice mode", desc: "single-shot records one continuous take and aligns it (recommended). per-scene records each scene separately (legacy).", type: "select", options: [{ value: "single-shot", label: "Single continuous take (recommended)" }, { value: "per-scene", label: "Per-scene (legacy)" }] },
      { key: "TTS_MODEL", label: "TTS model", desc: "Model id for ElevenLabs-compatible engines.", examples: "eleven_multilingual_v2" },
      { key: "TTS_VOICE_PROVIDER", label: "69labs voice path", desc: "Backend path for the 69labs engine.", examples: "elevenlabs · edgetts · voice-clone", showIf: [{ key: "TTS_PROVIDER", in: ["69labs"] }] },
      { key: "MINIMAX_MODEL", label: "MiniMax model", desc: "MiniMax TTS model.", examples: "speech-02-hd", showIf: [{ key: "TTS_PROVIDER", in: ["minimax", "minimax-ai33pro"] }] },
      { key: "MIN_SCENE_SECONDS", label: "Min seconds per shot", desc: "Shortest time a visual stays on screen before scenes merge (single-shot).", examples: "3 default" },
      { key: "MAX_CLIP_SECONDS", label: "Max seconds per clip", desc: "Long segments split into clips up to this length (single-shot).", examples: "7 default" },
      { key: "MAX_PAUSE_SECONDS", label: "Max pause between sentences", desc: "Caps long silences in the continuous voiceover.", examples: "0.6 default" },
    ],
  },
  {
    title: "Footage & relevance",
    collapsed: true,
    subtitle: "How the app searches and judges real stock footage. Defaults are tuned already.",
    fields: [
      { key: "VIDEO_CONTEXT", label: "Video context (optional)", desc: "Short hint about the setting/style. Helps keep footage on-theme. Leave empty unless it drifts.", examples: "WWII-era firearms, historical photos", multiline: true, maxLength: 300 },
      { key: "FOOTAGE_SOURCES", label: "Footage sources", desc: "Comma-separated stock libraries to search.", examples: "pexels,pixabay,openverse,wikimedia" },
      { key: "PIXABAY_API_KEY", label: "Pixabay key (optional)", desc: "Adds Pixabay as an extra source.", examples: "Get it at https://pixabay.com/api/docs/" },
      { key: "OPENVERSE_TOKEN", label: "Openverse token (optional)", desc: "Optional — raises Openverse rate limits.", examples: "empty works (anonymous)" },
      { key: "FOOTAGE_AI_PICK", label: "AI picks best footage", desc: "When on, Gemini Vision looks at candidate images and scores fit.", examples: "on · off" },
      { key: "GEMINI_VISION_MODEL", label: "Gemini Vision model", desc: "Gemini model used for visual relevance scoring.", examples: "gemini-2.5-flash" },
      { key: "PRODUCTION_MODE", label: "Production mode", desc: "quality = best matches · balanced (default) · batch = conservative for bulk.", examples: "quality · balanced · batch" },
      { key: "FOOTAGE_SEARCH_ATTEMPTS", label: "Search attempts", desc: "Search attempts per scene before accepting the best.", examples: "3 default" },
      { key: "VISION_CONCURRENCY", label: "Vision concurrency", desc: "Max parallel Gemini Vision calls.", examples: "4 default" },
      { key: "VISION_CANDIDATE_LIMIT", label: "Vision candidate limit", desc: "Max candidates sent to Vision per scene.", examples: "12 default" },
      { key: "VISION_COOLDOWN_ON_429_SEC", label: "Vision cooldown on rate-limit", desc: "Seconds to pause after a Gemini rate-limit.", examples: "120 default" },
      { key: "STOCK_FOOTAGE_ORIENTATION", label: "Orientation", desc: "Preferred footage orientation.", examples: "landscape · portrait · square" },
      { key: "STOCK_FOOTAGE_MAX_HEIGHT", label: "Max clip height", desc: "Caps downloaded clip resolution.", examples: "720 · 1080 · 2160" },
      { key: "STOCK_FOOTAGE_MIN_DURATION", label: "Min clip duration", desc: "Filters out clips shorter than this (seconds).", examples: "4 default" },
      { key: "SCENE_PHOTO_RATIO", label: "Photo / video mix (%)", desc: "Legacy per-scene mode only (the two-zone settings govern the real mix).", examples: "40 default" },
      { key: "SCENE_MIX_MODE", label: "Photo distribution", desc: "How photo scenes are spread across the timeline.", examples: "random · alternating" },
      { key: "IMAGE_RATIO", label: "Output aspect ratio", desc: "Final video aspect ratio.", examples: "16:9 · 9:16 · 1:1" },
    ],
  },
  {
    title: "Script breakdown (LLM)",
    collapsed: true,
    subtitle: "Which model splits the script into scenes. Default Gemini is fine.",
    fields: [
      { key: "SCENE_SPLIT_PROVIDER", label: "Provider", desc: "gemini (default) or an OpenAI-compatible provider.", examples: "gemini · openai" },
      { key: "SCENE_SPLIT_MODEL", label: "Model id", desc: "Model for scene splitting.", examples: "gemini-2.5-flash (recommended)" },
      { key: "OPENAI_API_KEY", label: "OpenAI-compatible key", desc: "Only if provider is openai (DeepSeek/OpenRouter/OpenAI).", examples: "", showIf: [{ key: "SCENE_SPLIT_PROVIDER", in: ["openai"] }] },
      { key: "OPENAI_BASE_URL", label: "Custom base URL", desc: "Only if provider is openai.", examples: "https://api.deepseek.com", showIf: [{ key: "SCENE_SPLIT_PROVIDER", in: ["openai"] }] },
    ],
  },
  {
    title: "Storage & FFmpeg",
    collapsed: true,
    fields: [
      { key: "RUNS_OUTPUT_DIR", label: "Output folder", desc: "Where finished videos are saved. Empty = default app data folder.", examples: "Mac: /Users/you/Documents/Conveyer-Runs · Windows: D:\\YouTube\\Conveyer-Runs" },
      { key: "FFMPEG_PATH", label: "FFmpeg path", desc: "Only if FFmpeg is not on your system PATH.", examples: "Mac: /opt/homebrew/bin/ffmpeg · Windows: C:\\ffmpeg\\bin\\ffmpeg.exe" },
    ],
  },
  {
    title: "Video assembly",
    collapsed: true,
    fields: [
      { key: "VIDEO_RESOLUTION", desc: "Final video resolution.", examples: "1920x1080 · 1280x720 · 3840x2160" },
      { key: "VIDEO_FPS", desc: "Frames per second.", examples: "24 · 30 · 60" },
      { key: "TRANSITION_MIN", label: "Transition min", desc: "Shortest transition.", examples: "0.3 default" },
      { key: "TRANSITION_MAX", label: "Transition max", desc: "Longest transition. 0 = hard cuts.", examples: "0.7 default · 0 hard cuts" },
      { key: "SCENE_TAIL_SILENCE", label: "Pause between scenes", desc: "Per-scene mode only.", examples: "0.4 default" },
      { key: "SCENE_DURATION_SECONDS", desc: "Fallback clip duration when audio length is unknown.", examples: "5 default" },
    ],
  },
  {
    title: "On-screen text",
    collapsed: true,
    subtitle: "Off by default (Ori's channels want no captions).",
    fields: [
      { key: "TEXT_OVERLAY_MODE", label: "Captions", desc: "off (default) · hook = opening only · all = anywhere.", type: "select", options: [{ value: "off", label: "Off (default)" }, { value: "hook", label: "Opening only (hook)" }, { value: "all", label: "Anywhere" }] },
      { key: "TEXT_OVERLAY_HOOK_SECONDS", label: "Hook length", desc: "For hook mode: captions only within this many seconds.", examples: "30 default", showIf: [{ key: "TEXT_OVERLAY_MODE", in: ["hook"] }] },
      { key: "TEXT_OVERLAY_FONT", label: "Caption font", desc: "Path to a .ttf/.otf font. Empty = auto.", examples: "empty = auto", showIf: [{ key: "TEXT_OVERLAY_MODE", in: ["hook", "all"] }] },
      { key: "CAPTION_LEAD_IN_SEC", label: "Caption lead-in", desc: "How early captions appear before the word.", examples: "0 default", showIf: [{ key: "TEXT_OVERLAY_MODE", in: ["hook", "all"] }] },
      { key: "CAPTION_TRAIL_SEC", label: "Caption trail", desc: "How long captions stay after the word.", examples: "0.35 default", showIf: [{ key: "TEXT_OVERLAY_MODE", in: ["hook", "all"] }] },
      { key: "CAPTION_FONT_SIZE_PERCENT", label: "Caption size (%)", desc: "Font size as % of video height.", examples: "13 default", showIf: [{ key: "TEXT_OVERLAY_MODE", in: ["hook", "all"] }] },
      { key: "CAPTION_POSITION_Y_PERCENT", label: "Caption vertical (%)", desc: "Vertical position as % of height.", examples: "72 default", showIf: [{ key: "TEXT_OVERLAY_MODE", in: ["hook", "all"] }] },
      { key: "CAPTION_DETECTION_MODE", label: "Detection", desc: "literal = only explicit values · off.", examples: "literal · off", showIf: [{ key: "TEXT_OVERLAY_MODE", in: ["hook", "all"] }] },
    ],
  },
  {
    title: "Step overlays",
    collapsed: true,
    subtitle: "Animated STEP titles (only if your script uses 'Step 1: ...' lines).",
    fields: [
      { key: "STEP_OVERLAY_TRAIL_SEC", label: "Trail", desc: "How long the step title stays after it's spoken.", examples: "1.0 default" },
      { key: "STEP_OVERLAY_ANIMATION", label: "Animation", desc: "Entrance/exit style.", examples: "slide-up · fade · none" },
      { key: "STEP_OVERLAY_ENTER_SEC", label: "Entrance", desc: "Entrance duration.", examples: "0.35 default" },
      { key: "STEP_OVERLAY_EXIT_SEC", label: "Exit", desc: "Exit duration.", examples: "0.25 default" },
    ],
  },
  {
    title: "Performance",
    collapsed: true,
    subtitle: "Parallel job limits. Lower = slower but gentler on rate limits.",
    fields: [
      { key: "TTS_CONCURRENCY", desc: "Simultaneous voice jobs.", examples: "3 default" },
      { key: "ANIMATION_CONCURRENCY", desc: "Simultaneous footage jobs.", examples: "5 default" },
      { key: "ASSEMBLE_CONCURRENCY", desc: "Simultaneous FFmpeg renders.", examples: "4 default" },
    ],
  },
  {
    title: "Reliability",
    collapsed: true,
    fields: [
      { key: "FAILURE_THRESHOLD_PERCENT", desc: "Abort the run if more than this percent of scenes fail.", examples: "25 default" },
    ],
  },
];
