import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocStatus } from "./types";

/**
 * Soft-cancel of GR documents (migration 0009). Only users listed in
 * `doc_cancelers` may cancel/restore; the database enforces every rule again
 * in `cancel_documents()` — the checks here only give instant feedback.
 */
export type CancelReason = "wrong_entry" | "duplicate" | "other";

export const CANCEL_REASONS: { value: CancelReason; label: string; hint: string }[] = [
  { value: "wrong_entry", label: "1. บันทึกผิด", hint: "กรอกข้อมูลผิด เลือกรหัสสินค้าผิด หรือเปิดใบงานผิดรายการ" },
  { value: "duplicate", label: "2. บันทึกซ้ำกับ WH-xxxx", hint: "สินค้าล็อตเดียวกันถูกบันทึกไว้แล้วในใบงานอื่น" },
  { value: "other", label: "3. อื่น ๆ (ระบุ)", hint: "เหตุผลอื่น ต้องพิมพ์อธิบาย" },
];

export const CANCEL_NOTE_MAX = 200;

export const CANCELABLE_STATUSES: readonly DocStatus[] = ["in_progress", "pending_sap"];

export function isCancelableStatus(status: DocStatus): boolean {
  return CANCELABLE_STATUSES.includes(status);
}

export interface CancelItemInput {
  id: string;
  wh: string;
  reason: CancelReason | "";
  dupWh: string;
  note: string;
}

export function normalizeWh(raw: string): string {
  return raw.trim().toUpperCase();
}

/**
 * Returns a Thai error for one item, or null when it can be submitted.
 * `selectedWhs` = WH numbers of every document being cancelled in this batch;
 * `existsWh` = whether a (non-cancelled) document with that WH exists.
 */
export function validateCancelItem(
  item: CancelItemInput,
  selectedWhs: ReadonlySet<string>,
  existsWh: (wh: string) => boolean | undefined
): string | null {
  if (!item.reason) return "กรุณาเลือกเหตุผล";
  if (item.note.length > CANCEL_NOTE_MAX) return `เหตุผลยาวเกิน ${CANCEL_NOTE_MAX} ตัวอักษร`;
  if (item.reason === "duplicate") {
    const wh = normalizeWh(item.dupWh);
    if (!wh) return "กรุณาระบุเลข WH ของใบที่ซ้ำ";
    if (wh === normalizeWh(item.wh)) return "ระบุเลขของใบงานนี้เองไม่ได้";
    if (selectedWhs.has(wh)) return "ใบนี้ถูกเลือกยกเลิกด้วย — ต้องซ้ำกับใบที่เก็บไว้";
    const exists = existsWh(wh);
    if (exists === undefined) return "กำลังตรวจสอบเลข WH...";
    if (!exists) return `ไม่พบใบงาน ${wh} ในระบบ`;
  }
  if (item.reason === "other" && !item.note.trim()) return "กรุณาระบุเหตุผล";
  return null;
}

/** One-line Thai description of why a document was cancelled. */
export function cancelReasonText(reason: string | null, dupWh?: string | null, note?: string | null): string {
  const n = note?.trim();
  switch (reason) {
    case "wrong_entry":
      return n ? `บันทึกผิด — ${n}` : "บันทึกผิด";
    case "duplicate":
      return `บันทึกซ้ำกับ ${dupWh || "-"}` + (n ? ` — ${n}` : "");
    case "other":
      return n ? `อื่น ๆ — ${n}` : "อื่น ๆ";
    default:
      return n || "-";
  }
}

export interface CancelResult {
  id: string;
  wh?: string;
  ok: boolean;
  error?: string;
}

export async function isDocCanceler(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await supabase.from("doc_cancelers").select("user_id").eq("user_id", userId).maybeSingle();
  // table missing (migration not run yet) → feature simply stays hidden
  return !error && !!data;
}

export async function cancelDocuments(
  supabase: SupabaseClient,
  items: CancelItemInput[]
): Promise<{ ok: true; results: CancelResult[] } | { ok: false; error: string }> {
  const payload = items.map((i) => ({
    id: i.id,
    reason: i.reason,
    dup_wh: i.reason === "duplicate" ? normalizeWh(i.dupWh) : null,
    note: i.note.trim() || null,
  }));
  const { data, error } = await supabase.rpc("cancel_documents", { p_items: payload });
  if (error) return { ok: false, error: error.message };
  return { ok: true, results: (data || []) as CancelResult[] };
}

export async function restoreDocuments(
  supabase: SupabaseClient,
  ids: string[]
): Promise<{ ok: true; results: CancelResult[] } | { ok: false; error: string }> {
  const { data, error } = await supabase.rpc("restore_documents", { p_ids: ids });
  if (error) return { ok: false, error: error.message };
  return { ok: true, results: (data || []) as CancelResult[] };
}
