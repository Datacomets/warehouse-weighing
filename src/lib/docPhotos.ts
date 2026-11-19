import type { SupabaseClient } from "@supabase/supabase-js";
import { validateWeightPhoto } from "./photoUpload";
import { compressImage } from "./itemPhoto";
import { translateSupabaseError } from "./supabaseError";

/**
 * Product photos that belong to a document (ใบงาน) — migration 0013.
 * Up to DOC_PHOTO_MAX per document (enforced again by a DB trigger).
 * Files: gr-photos/<documentId>/item/<timestamp>.jpg
 */
export const DOC_PHOTO_MAX = 4;
export const DOC_PHOTO_BUCKET = "gr-photos";

export interface DocPhoto {
  id: string;
  url: string;
  is_primary: boolean;
  created_by: string | null;
}

export interface PhotoGroup {
  document_id: string;
  wh_number: string;
  lot: string | null;
  status: string;
  created_at: string;
  can_open: boolean;
  photos: DocPhoto[] | null;
}

export function buildDocPhotoPath(documentId: string, nowMs: number, ext = "jpg"): string {
  return `${documentId}/item/${nowMs}.${ext}`;
}

export async function listDocPhotos(supabase: SupabaseClient, documentId: string): Promise<DocPhoto[]> {
  const { data } = await supabase
    .from("doc_item_photos")
    .select("id,url,is_primary,created_by")
    .eq("document_id", documentId)
    .order("is_primary", { ascending: false })
    .order("created_at");
  return (data as DocPhoto[]) || [];
}

export async function uploadDocPhoto(
  supabase: SupabaseClient,
  { documentId, userId, file, nowMs = Date.now() }: { documentId: string; userId: string; file: File; nowMs?: number }
): Promise<{ ok: true; photo: DocPhoto } | { ok: false; error: string }> {
  const invalid = validateWeightPhoto(file);
  if (invalid) return { ok: false, error: invalid };
  const body = await compressImage(file);
  const isJpeg = body !== file || file.type === "image/jpeg";
  const ext = isJpeg ? "jpg" : (file.name.split(".").pop() || "img").toLowerCase();
  const path = buildDocPhotoPath(documentId, nowMs, ext);
  const up = await supabase.storage.from(DOC_PHOTO_BUCKET).upload(path, body, {
    upsert: false,
    contentType: isJpeg ? "image/jpeg" : file.type,
  });
  if (up.error || !up.data) return { ok: false, error: translateSupabaseError(up.error) };
  const url = supabase.storage.from(DOC_PHOTO_BUCKET).getPublicUrl(up.data.path).data.publicUrl;
  const { data, error } = await supabase
    .from("doc_item_photos")
    .insert({ document_id: documentId, path, url, created_by: userId })
    .select("id,url,is_primary,created_by")
    .single();
  if (error || !data) return { ok: false, error: error?.message?.includes("4 รูป") ? error.message : translateSupabaseError(error) };
  return { ok: true, photo: data as DocPhoto };
}

/** Photos of an item, grouped by document (newest first). */
export async function itemPhotoGroups(supabase: SupabaseClient, itemCode: string): Promise<PhotoGroup[]> {
  if (!itemCode.trim()) return [];
  const { data } = await supabase.rpc("item_photo_groups", { p_code: itemCode.trim() });
  return ((data as PhotoGroup[]) || []).filter((g) => g.photos && g.photos.length > 0);
}

export interface CardPhoto {
  url: string | null; // ★ primary (or first) photo
  count: number;
}
/** ★ photo + number of photos for each listed document — one query per 200 ids, for list cards. */
export async function cardPhotos(supabase: SupabaseClient, ids: string[]): Promise<Map<string, CardPhoto>> {
  const map = new Map<string, CardPhoto>();
  for (const id of ids) map.set(id, { url: null, count: 0 });
  const jobs: Promise<void>[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    jobs.push(
      (async () => {
        const { data } = await supabase
          .from("doc_item_photos")
          .select("document_id, url, is_primary, created_at")
          .in("document_id", ids.slice(i, i + 200))
          .order("is_primary", { ascending: false })
          .order("created_at");
        for (const r of (data as any[]) || []) {
          const c = map.get(r.document_id);
          if (!c) continue;
          c.count++;
          if (!c.url && r.url) c.url = r.url;
        }
      })()
    );
  }
  await Promise.all(jobs);
  return map;
}
