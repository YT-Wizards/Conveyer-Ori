import fs from "node:fs";
import path from "node:path";
import { ensureInit } from "@/lib/init";
import { styleDir, listStyleImages } from "@/lib/services/style";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/** GET → serve one reference image (thumbnails on the /style page). */
export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  ensureInit();
  const { name } = await ctx.params;
  // Whitelist by directory listing — no traversal possible.
  if (!listStyleImages().includes(name)) {
    return new Response("not found", { status: 404 });
  }
  const buf = fs.readFileSync(path.join(styleDir(), name));
  const mime = MIME[path.extname(name).toLowerCase()] ?? "application/octet-stream";
  return new Response(new Uint8Array(buf), {
    headers: { "Content-Type": mime, "Cache-Control": "no-store" },
  });
}
