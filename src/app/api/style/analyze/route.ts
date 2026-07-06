import { NextResponse } from "next/server";
import { ensureInit } from "@/lib/init";
import { analyzeStyle } from "@/lib/services/style";

/** POST → Gemini looks at the reference images + text and saves a style profile. */
export async function POST() {
  ensureInit();
  try {
    const profile = await analyzeStyle();
    return NextResponse.json({ profile });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
