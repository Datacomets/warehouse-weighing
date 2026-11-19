import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";

/**
 * GET /api/img?w=160&src=<public Supabase Storage URL>
 * Small JPEG of a stored photo for lists, cards and report previews — the originals are
 * full-size phone photos (issue photos are often 3 MB). Only our own Supabase public
 * storage URLs are accepted. Storage paths embed a timestamp and are never reused, so
 * the result is cached hard by the browser and Vercel's CDN.
 */
export const runtime = "nodejs";

const BASE = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "") + "/storage/v1/object/public/";

export async function GET(req: NextRequest) {
  const src = req.nextUrl.searchParams.get("src") || "";
  const w = Math.min(800, Math.max(48, Math.round(Number(req.nextUrl.searchParams.get("w")) || 160)));
  if (!BASE.startsWith("http") || !src.startsWith(BASE) || src.includes("..")) {
    return NextResponse.json({ message: "Invalid image source" }, { status: 400 });
  }
  const r = await fetch(src, { cache: "no-store" });
  if (!r.ok) return NextResponse.json({ message: "Image not found" }, { status: r.status === 404 ? 404 : 502 });
  const input = Buffer.from(await r.arrayBuffer());
  try {
    const out = await sharp(input).rotate().resize(w, w, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 72 }).toBuffer();
    return new Response(new Uint8Array(out), {
      headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=31536000, immutable" },
    });
  } catch {
    // not decodable (e.g. HEIC) — hand back the original
    return new Response(new Uint8Array(input), {
      headers: { "content-type": r.headers.get("content-type") || "application/octet-stream", "cache-control": "public, max-age=86400" },
    });
  }
}
