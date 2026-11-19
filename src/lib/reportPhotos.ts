/**
 * Photos for report exports: product photos of each document (doc_item_photos, ★ primary
 * first) and issue reports with their photos. Used by the Report page, its confirm dialog,
 * and the Excel / PDF / CSV exports so all of them count and show the same pictures.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { ISSUE_LABEL, type PhotoMode } from "@/lib/report";

export interface IssueInfo {
  type: string; // Thai label
  qty: number | null;
  notes: string | null;
  photos: string[];
}
export interface DocPhotos {
  product: string[]; // ★ primary first, max 4
  issues: IssueInfo[];
}

const CHUNK = 200;

export async function fetchDocPhotos(
  supabase: SupabaseClient<any>,
  ids: string[],
  want: { product: boolean; issues: boolean }
): Promise<Map<string, DocPhotos>> {
  const map = new Map<string, DocPhotos>();
  const get = (id: string) => {
    let d = map.get(id);
    if (!d) map.set(id, (d = { product: [], issues: [] }));
    return d;
  };
  const jobs: Promise<void>[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const part = ids.slice(i, i + CHUNK);
    if (want.product)
      jobs.push(
        (async () => {
          const { data } = await supabase
            .from("doc_item_photos")
            .select("document_id, url, is_primary, created_at")
            .in("document_id", part)
            .order("is_primary", { ascending: false })
            .order("created_at");
          for (const p of (data as any[]) || []) if (p.url) get(p.document_id).product.push(p.url);
        })()
      );
    if (want.issues)
      jobs.push(
        (async () => {
          const { data } = await supabase
            .from("issue_reports")
            .select("document_id, issue_type, quantity, notes, photos, created_at")
            .in("document_id", part)
            .order("created_at");
          for (const r of (data as any[]) || [])
            get(r.document_id).issues.push({
              type: ISSUE_LABEL[r.issue_type] || r.issue_type,
              qty: r.quantity == null ? null : Number(r.quantity),
              notes: r.notes || null,
              photos: (r.photos as string[]) || [],
            });
        })()
      );
  }
  await Promise.all(jobs);
  return map;
}

type PhotoPick = { pphoto: PhotoMode; pslots: number[] };
/** Chosen photo positions for one document, one entry per position (null = that photo does not exist). */
export function productSlots(d: DocPhotos | undefined, f: PhotoPick): (string | null)[] {
  if (f.pphoto === "none") return [];
  return f.pslots.map((n) => d?.product[n - 1] ?? null);
}
/** Chosen product photos that exist for one document. */
export function productPhotos(d: DocPhotos | undefined, f: PhotoPick): string[] {
  return productSlots(d, f).filter((u): u is string => !!u);
}

export function issuePhotos(d: DocPhotos | undefined, max = 4): string[] {
  return (d?.issues || []).flatMap((i) => i.photos).slice(0, max);
}

/** "ชำรุด · จำนวน 3 · ลังบุบ" — one line per issue, joined. */
export function issueText(d: DocPhotos | undefined): string {
  return (d?.issues || [])
    .map((i) => [i.type, i.qty != null ? `จำนวน ${i.qty.toLocaleString()}` : "", i.notes || ""].filter(Boolean).join(" · "))
    .join(" / ");
}

/** Smaller copy of a stored photo (resized by /api/img — originals are full-size phone photos). */
export function thumbUrl(url: string, w = 160): string {
  if (!/^https?:\/\//.test(url)) return url;
  return `/api/img?w=${w}&src=${encodeURIComponent(url)}`;
}

export interface PhotoCounts {
  prodPics: number;
  prodDocs: number;
  issuePics: number;
  issueCount: number;
  issueDocs: number;
}
export function countPhotos(ids: string[], map: Map<string, DocPhotos>, f: PhotoPick & { iphoto: boolean }): PhotoCounts {
  let prodPics = 0, prodDocs = 0, issuePics = 0, issueCount = 0, issueDocs = 0;
  for (const id of ids) {
    const d = map.get(id);
    const p = productPhotos(d, f).length;
    prodPics += p;
    if (p) prodDocs++;
    if (f.iphoto && d?.issues.length) {
      issueCount += d.issues.length;
      issueDocs++;
      issuePics += d.issues.reduce((a, i) => a + i.photos.length, 0);
    }
  }
  return { prodPics, prodDocs, issuePics, issueCount, issueDocs };
}
