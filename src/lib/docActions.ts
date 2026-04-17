import type { SupabaseClient } from "@supabase/supabase-js";
import { validateSapEntry } from "./sapAttachment";
import { translateSupabaseError } from "./supabaseError";

export type DocActionResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Submits an in_progress document to the SAP queue.
 * Transitions: in_progress → pending_sap.
 */
export async function submitDocument(
  supabase: SupabaseClient,
  {
    docId,
    userId,
    now = new Date(),
  }: { docId: string; userId: string | null; now?: Date }
): Promise<DocActionResult> {
  const iso = now.toISOString();
  const { error } = await supabase
    .from("gr_documents")
    .update({
      status: "pending_sap",
      submitted_by: userId,
      submitted_at: iso,
      ended_at: iso,
    })
    .eq("id", docId);
  if (error) return { ok: false, error: translateSupabaseError(error) };

  await supabase.from("audit_log").insert({
    document_id: docId,
    actor: userId,
    action: "submit_work",
  });
  return { ok: true };
}

/**
 * Unlocks a pending_sap document back to in_progress so the operator can edit.
 * Transitions: pending_sap → in_progress. Resets submitted_at / ended_at.
 */
export async function unlockDocument(
  supabase: SupabaseClient,
  {
    docId,
    userId,
    reason,
  }: { docId: string; userId: string | null; reason: string }
): Promise<DocActionResult> {
  if (!reason.trim()) {
    return { ok: false, error: "กรุณากรอกเหตุผล" };
  }

  const { error } = await supabase
    .from("gr_documents")
    .update({
      status: "in_progress",
      unlock_reason: reason,
      submitted_at: null,
      ended_at: null,
    })
    .eq("id", docId);
  if (error) return { ok: false, error: translateSupabaseError(error) };

  await supabase.from("audit_log").insert({
    document_id: docId,
    actor: userId,
    action: "unlock",
    detail: { reason },
  });
  return { ok: true };
}

export interface CompleteSapEntryInput {
  doc: { id: string; sap_attachment_url: string | null };
  cfsd: string;
  notif: string;
  file: File | null;
  userId: string | null;
  /** Injected for testability. Defaults to `Date.now()`. */
  nowMs?: number;
  /** Injected for testability. Defaults to `new Date().toISOString()`. */
  closedAt?: string;
}

/**
 * Completes the SAP entry: optional file upload → update gr_documents with
 * CFSD + status=completed → audit log.
 *
 * If file upload fails, the doc is NOT updated (caller sees the error).
 * If upload succeeds but the doc update fails, the uploaded file is orphaned —
 * this matches existing behavior; callers that care about cleanup should
 * handle it.
 */
export async function completeSapEntry(
  supabase: SupabaseClient,
  input: CompleteSapEntryInput
): Promise<DocActionResult & { attachmentUrl?: string | null }> {
  const validationError = validateSapEntry({ cfsd: input.cfsd, file: input.file });
  if (validationError) return { ok: false, error: validationError };

  let attachmentUrl: string | null = input.doc.sap_attachment_url;
  if (input.file) {
    const ms = input.nowMs ?? Date.now();
    const path = `${input.doc.id}/${ms}-${input.file.name}`;
    const { data: uploaded, error: uploadErr } = await supabase.storage
      .from("sap-attachments")
      .upload(path, input.file);
    if (uploadErr || !uploaded) {
      return { ok: false, error: translateSupabaseError(uploadErr) };
    }
    const { data: pub } = supabase.storage.from("sap-attachments").getPublicUrl(uploaded.path);
    attachmentUrl = pub.publicUrl;
  }

  const closedAt = input.closedAt ?? new Date().toISOString();
  const { error } = await supabase
    .from("gr_documents")
    .update({
      sap_inbound_id: input.cfsd.trim(),
      sap_notification_id: input.notif.trim() || null,
      sap_attachment_url: attachmentUrl,
      status: "completed",
      closed_by: input.userId,
      closed_at: closedAt,
    })
    .eq("id", input.doc.id);
  if (error) return { ok: false, error: translateSupabaseError(error) };

  await supabase.from("audit_log").insert({
    document_id: input.doc.id,
    actor: input.userId,
    action: "complete_sap",
    detail: { sap_inbound_id: input.cfsd.trim() },
  });

  return { ok: true, attachmentUrl };
}
