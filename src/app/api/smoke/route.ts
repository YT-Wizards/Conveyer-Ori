import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import {
  assembleSingleShot,
  resolveFfmpegBinary,
  probeDurationSafe,
  type SingleShotInput,
} from "@/lib/services/video-assemble";
import type { Scene } from "@/lib/services/scene-split";
import { DATA_DIR } from "@/lib/db";
import { ensureInit } from "@/lib/init";

export const dynamic = "force-dynamic";

/**
 * Keyless smoke render. Synthesises a few solid-colour stills, one moving test
 * clip and a tone, then pushes them through the REAL assembly path
 * (Ken-Burns + text overlay + video scale + concat + master-audio mux) to a
 * final.mp4 — with ZERO external API calls and zero spend.
 *
 * Purpose:
 *  - CI / dev: prove the whole FFmpeg machinery works end-to-end without keys.
 *  - Client: a one-click "is my install working?" check (does FFmpeg render?).
 *
 * Visit GET /api/smoke. Success → JSON with the output path, size and duration.
 */

function ff(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(resolveFfmpegBinary(), args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => { err += d.toString(); });
    p.on("error", reject);
    p.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${err.slice(-600)}`))
    );
  });
}

function scene(index: number, text: string): Scene {
  return { index, text, visual_prompt: text, visual_queries: [text], duration_hint_sec: 2 };
}

export async function GET() {
  const startedAt = Date.now();
  try {
    ensureInit();
    const ffmpegBin = resolveFfmpegBinary();
    const dir = path.join(DATA_DIR, "_smoke");
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });

    // 1. Synthesise inputs — solid-colour stills, one moving test clip, a tone.
    const colors = ["red", "green", "blue"];
    const photos: string[] = [];
    for (let i = 0; i < colors.length; i++) {
      const p = path.join(dir, `still_${i}.jpg`);
      await ff(["-y", "-f", "lavfi", "-i", `color=c=${colors[i]}:s=1280x720`, "-frames:v", "1", p]);
      photos.push(p);
    }
    const videoClip = path.join(dir, "clip.mp4");
    await ff(["-y", "-f", "lavfi", "-i", "testsrc=size=1280x720:rate=30:duration=3", "-pix_fmt", "yuv420p", videoClip]);

    const totalSec = 8;
    const audioPath = path.join(dir, "tone.mp3");
    await ff(["-y", "-f", "lavfi", "-i", `sine=frequency=220:duration=${totalSec}`, "-ac", "2", "-ar", "44100", audioPath]);

    // 2. Sub-clip plan exercising both lanes + a burned text overlay.
    const inputs: SingleShotInput[] = [
      { scene: scene(0, "intro one"), assetPath: photos[0], kind: "photo", startMs: 0, endMs: 2000, overlay: { text: "$400", atSec: 0.3 } },
      { scene: scene(1, "intro two"), assetPath: videoClip, kind: "video", startMs: 2000, endMs: 4000 },
      { scene: scene(2, "body one"), assetPath: photos[1], kind: "photo", startMs: 4000, endMs: 6000 },
      { scene: scene(3, "body two"), assetPath: photos[2], kind: "photo", startMs: 6000, endMs: 8000 },
    ];

    // 3. Run the REAL assembly. Ken-Burns + overlay + concat + audio mux. No APIs.
    const finalPath = await assembleSingleShot("smoke", inputs, audioPath, dir);
    const sizeBytes = fs.statSync(finalPath).size;
    const durationSec = await probeDurationSafe(finalPath);

    return NextResponse.json({
      ok: true,
      ffmpeg: ffmpegBin,
      finalPath,
      sizeBytes,
      durationSec,
      expectedSec: totalSec,
      clips: inputs.length,
      elapsedMs: Date.now() - startedAt,
      note: "Synthetic stills + tone through the real Ken-Burns → concat → mux path. No external APIs, no spend.",
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message, elapsedMs: Date.now() - startedAt },
      { status: 500 }
    );
  }
}
