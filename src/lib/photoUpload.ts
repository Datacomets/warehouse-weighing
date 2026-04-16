import type { SupabaseClient } from "@supabase/supabase-js";
import type { WeightKind } from "./types";

export const WEIGHT_PHOTO_MAX_SIZE = 10 * 1024 * 1024; // 10 MB
export const WEIGHT_PHOTO_ALLOWED_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  // iPhone Safari may upload HEIC/HEIF without conversion — accept silently
  // (the error message below still only mentions JPEG/PNG/WEBP since those
  // are the "expected" types for users).
  "image/heic",
  "image/heif",
];

export type PhotoFileLike = { name: string; type: string; size: number };

/** Returns a Thai error message or `null` when the file is acceptable. */
export function validateWeightPhoto(file: PhotoFileLike): string | null {
  if (!WEIGHT_PHOTO_ALLOWED_TYPES.includes(file.type)) {
    return `ไฟล์ "${file.name}" ไม่ใช่รูปภาพที่รองรับ (JPEG, PNG, WEBP)`;
  }
  if (file.size > WEIGHT_PHOTO_MAX_SIZE) {
    return `ไฟล์ "${file.name}" ใหญ่เกิน 10 MB`;
  }
  return null;
}

/** Storage path: `{documentId}/{kind|'general'}/{timestamp}-{filename}`. */
export function buildWeightPhotoPath({
  documentId,
  kind,
  nowMs,
  filename,
}: {
  documentId: string;
  kind?: WeightKind | null;
  nowMs: number;
  filename: string;
}): string {
  return `${documentId}/${kind || "general"}/${nowMs}-${filename}`;
}

export interface UploadedPhoto {
  id: string;
  url: string;
}

export type PhotoActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

export interface UploadWeightPhotoInput {
  documentId: string;
  kind?: WeightKind | null;
  file: File;
  nowMs?: number;
}

/**
 * Uploads one photo to Storage and inserts a matching `weight_photos` row.
 * Returns the newly-inserted row (id + public URL) on success.
 *
 * Note: if the DB insert fails after Storage upload, the file remains in
 * the bucket (orphaned) — matches existing component behavior.
 */
export async function uploadWeightPhoto(
  supabase: SupabaseClient,
  { documentId, kind, file, nowMs = Date.now() }: UploadWeightPhotoInput
): Promise<{ ok: true; data: UploadedPhoto } | { ok: false; error: string }> {
  const validationError = validateWeightPhoto(file);
  if (validationError) return { ok: false, error: validationError };

  const path = buildWeightPhotoPath({
    documentId,
    kind,
    nowMs,
    filename: file.name,
  });

  const { data: uploaded, error: uploadErr } = await supabase.storage
    .from("gr-photos")
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (uploadErr || !uploaded) {
    return { ok: false, error: "Upload failed: " + (uploadErr?.message ?? "unknown") };
  }

  const { data: pub } = supabase.storage.from("gr-photos").getPublicUrl(uploaded.path);
  const url = pub.publicUrl;

  const { data: row, error: insertErr } = await supabase
    .from("weight_photos")
    .insert({ document_id: documentId, kind, url })
    .select("id,url")
    .single();

  if (insertErr || !row) {
    return { ok: false, error: insertErr?.message ?? "insert failed" };
  }

  return { ok: true, data: row as UploadedPhoto };
}

/** Deletes a weight_photos row by id. */
export async function deleteWeightPhoto(
  supabase: SupabaseClient,
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from("weight_photos").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
