import type { SupabaseClient } from "@supabase/supabase-js";
import { validateWeightPhoto } from "./photoUpload";
import { translateSupabaseError } from "./supabaseError";

/**
 * Product photos for item_master, stored in the existing `gr-photos` bucket
 * under `items/{itemCode}/{timestamp}.jpg`. No DB column — the newest file in
 * the folder is the item's photo. Lives in gr-photos so the existing storage
 * policies and the daily storage backup already cover it.
 *
 * Note for maintenance scripts: files under `items/` are NOT referenced by any
 * table, so orphan cleanup must skip this prefix.
 */
export const ITEM_PHOTO_BUCKET = "gr-photos";
export const ITEM_PHOTO_PREFIX = "items";
export const ITEM_PHOTO_MAX_EDGE = 1280;
export const ITEM_PHOTO_QUALITY = 0.82;

/** Storage-safe folder name for an item code (codes can contain e.g. "/", " "). */
export function itemPhotoFolder(itemCode: string): string {
  const safe = itemCode
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, (c) => "_" + c.charCodeAt(0).toString(16));
  return `${ITEM_PHOTO_PREFIX}/${safe}`;
}

export function buildItemPhotoPath(itemCode: string, nowMs: number, ext = "jpg"): string {
  return `${itemPhotoFolder(itemCode)}/${nowMs}.${ext}`;
}

/** Returns the public URL of the newest photo for the item, or null. */
export async function findItemPhoto(
  supabase: SupabaseClient,
  itemCode: string
): Promise<string | null> {
  if (!itemCode.trim()) return null;
  const folder = itemPhotoFolder(itemCode);
  const { data, error } = await supabase.storage
    .from(ITEM_PHOTO_BUCKET)
    .list(folder, { limit: 1, sortBy: { column: "name", order: "desc" } });
  if (error || !data) return null;
  const file = data.find((f) => f.name && !f.name.startsWith("."));
  if (!file) return null;
  return supabase.storage.from(ITEM_PHOTO_BUCKET).getPublicUrl(`${folder}/${file.name}`).data.publicUrl;
}

/**
 * Downscales an image in the browser to keep product photos small
 * (~100–250 KB). Falls back to the original file when the browser cannot
 * decode it (e.g. HEIC on non-Safari browsers).
 */
export async function compressImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, ITEM_PHOTO_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", ITEM_PHOTO_QUALITY));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

export async function uploadItemPhoto(
  supabase: SupabaseClient,
  { itemCode, file, nowMs = Date.now() }: { itemCode: string; file: File; nowMs?: number }
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!itemCode.trim()) return { ok: false, error: "กรุณากรอก Item Code ก่อน" };
  const validationError = validateWeightPhoto(file);
  if (validationError) return { ok: false, error: validationError };

  const body = await compressImage(file);
  const isJpeg = body !== file || file.type === "image/jpeg";
  const ext = isJpeg ? "jpg" : (file.name.split(".").pop() || "img").toLowerCase();
  const path = buildItemPhotoPath(itemCode, nowMs, ext);

  const { data, error } = await supabase.storage.from(ITEM_PHOTO_BUCKET).upload(path, body, {
    cacheControl: "3600",
    upsert: false,
    contentType: isJpeg ? "image/jpeg" : file.type,
  });
  if (error || !data) return { ok: false, error: translateSupabaseError(error) };
  return { ok: true, url: supabase.storage.from(ITEM_PHOTO_BUCKET).getPublicUrl(data.path).data.publicUrl };
}
