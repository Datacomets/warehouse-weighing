import type { DocStatus, UserRole } from "./types";

/**
 * Status workflow for GR documents.
 *
 *   in_progress  ──submit──▶  pending_sap  ──sap_entry──▶  completed
 *                             pending_sap  ──unlock────▶  in_progress
 *
 * `completed` is terminal — no further transitions.
 */
export type WorkflowAction = "submit" | "sap_entry" | "unlock";

/** Can operator edit weights / header / remainder? (i.e. write access to the doc data) */
export function canEdit(status: DocStatus): boolean {
  return status === "in_progress";
}

/** Can operator press "ส่งงาน" to move to the SAP queue? */
export function canSubmit(status: DocStatus): boolean {
  return status === "in_progress";
}

/** Can admin_sap post the CFSD / attachment to close the doc? */
export function canEnterSap(status: DocStatus): boolean {
  return status === "pending_sap";
}

/** Can admin_sap unlock a submitted doc back to the operator? */
export function canUnlock(status: DocStatus): boolean {
  return status === "pending_sap";
}

/**
 * Can the given role edit weight / grid / header / issue data on a doc
 * given its current status?
 *
 * - admin / admin_sap / manager: in_progress (normal) OR completed (late
 *   corrections in place — no status change, doc stays closed). For
 *   pending_sap they must still use Unlock first to bounce it back to
 *   the operator.
 * - operator / qc: only while status is in_progress (existing rule —
 *   submit locks them out until admin unlocks)
 */
export function canEditDocumentData(role: UserRole, status: DocStatus): boolean {
  if (role === "admin" || role === "admin_sap" || role === "manager") {
    return status === "in_progress" || status === "completed";
  }
  return status === "in_progress";
}

/**
 * Computes the next status given a current status + action, or `null` when the
 * transition is not allowed.
 */
export function nextStatus(current: DocStatus, action: WorkflowAction): DocStatus | null {
  switch (action) {
    case "submit":
      return current === "in_progress" ? "pending_sap" : null;
    case "sap_entry":
      return current === "pending_sap" ? "completed" : null;
    case "unlock":
      return current === "pending_sap" ? "in_progress" : null;
    default:
      return null;
  }
}
