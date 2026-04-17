import type { SupabaseClient } from "@supabase/supabase-js";
import { translateSupabaseError } from "./supabaseError";

export interface IssueDraft {
  issue_type: string;
  defect_code: string;
  quantity: string;
  notes: string;
}

export interface NormalizedIssue {
  issue_type: string;
  defect_code: string | null;
  quantity: number | null;
  notes: string | null;
}

/**
 * Converts the UI draft into a DB row payload:
 *   - defect_code "" → null
 *   - notes "" → null
 *   - quantity "" → null; numeric string → number (rejects NaN → null)
 */
export function normalizeIssueDraft(draft: IssueDraft): NormalizedIssue {
  const qty = draft.quantity === "" ? null : Number(draft.quantity);
  return {
    issue_type: draft.issue_type,
    defect_code: draft.defect_code || null,
    quantity: qty == null || !Number.isFinite(qty) ? null : qty,
    notes: draft.notes || null,
  };
}

export type IssueActionFailure = { ok: false; error: string };
export type IssueActionSuccess<T> = { ok: true; data: T };
export type IssueActionVoidSuccess = { ok: true };
export type IssueActionResult<T> = IssueActionSuccess<T> | IssueActionFailure;
export type IssueActionResultVoid = IssueActionVoidSuccess | IssueActionFailure;

/**
 * Uploads an issue photo to the `gr-photos` bucket under
 * `{documentId}/issues/{timestamp}-{filename}`. Returns the public URL.
 */
export async function uploadIssuePhoto(
  supabase: SupabaseClient,
  {
    documentId,
    file,
    nowMs = Date.now(),
  }: { documentId: string; file: File; nowMs?: number }
): Promise<IssueActionResult<string>> {
  const path = `${documentId}/issues/${nowMs}-${file.name}`;
  const { data, error } = await supabase.storage.from("gr-photos").upload(path, file);
  if (error || !data) {
    return { ok: false, error: translateSupabaseError(error) };
  }
  const { data: pub } = supabase.storage.from("gr-photos").getPublicUrl(data.path);
  return { ok: true, data: pub.publicUrl };
}

/**
 * Inserts a new issue_report row and returns the inserted record.
 * Photo URLs are stored as a text[] array on the row.
 */
export async function createIssue(
  supabase: SupabaseClient,
  {
    documentId,
    userId,
    draft,
    photoUrls,
  }: {
    documentId: string;
    userId: string | null;
    draft: IssueDraft;
    photoUrls: string[];
  }
): Promise<IssueActionResult<any>> {
  const normalized = normalizeIssueDraft(draft);
  const { data, error } = await supabase
    .from("issue_reports")
    .insert({
      document_id: documentId,
      ...normalized,
      photos: photoUrls,
      created_by: userId,
    })
    .select("*")
    .single();
  if (error) return { ok: false, error: translateSupabaseError(error) };
  return { ok: true, data };
}

/** Deletes an issue_reports row by id. */
export async function deleteIssue(
  supabase: SupabaseClient,
  id: string
): Promise<IssueActionResultVoid> {
  const { error } = await supabase.from("issue_reports").delete().eq("id", id);
  if (error) return { ok: false, error: translateSupabaseError(error) };
  return { ok: true };
}
