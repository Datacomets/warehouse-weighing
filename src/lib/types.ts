// Auto-generatable types — kept manual & minimal for now.
// You can replace with output of `supabase gen types typescript` later.

export type UserRole = "operator" | "qc" | "manager" | "admin_sap" | "admin";
export type DocStatus = "in_progress" | "pending_sap" | "completed";
export type WeightKind = "per_pcs" | "per_inner" | "per_carton";

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  active: boolean;
  created_at: string;
}

export interface GrDocument {
  id: string;
  wh_number: string;
  status: DocStatus;
  scale_name: string | null;
  lot: string | null;
  po_number: string | null;
  item_code: string | null;
  description: string | null;
  supplier: string | null;
  delivery_date: string | null;
  qty_per_carton: number | null;
  actual_count: number | null;
  width_cm: number | null;
  length_cm: number | null;
  height_cm: number | null;
  gross_weight: number | null;
  net_weight: number | null;
  mfg_date: string | null;
  exp_date: string | null;
  lot_number: string | null;
  qc_status: string | null;
  remarks: string | null;
  sap_inbound_id: string | null;
  sap_notification_id: string | null;
  sap_attachment_url: string | null;
  created_by: string | null;
  submitted_by: string | null;
  submitted_at: string | null;
  closed_by: string | null;
  closed_at: string | null;
  unlock_reason: string | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WeightMeasurement {
  id: string;
  document_id: string;
  kind: WeightKind;
  seq: number;
  value: number;
  per_100: boolean;
  qty_per_inner: number | null;
  created_at: string;
}

export interface CountGridEntry {
  id: string;
  document_id: string;
  row_index: number;
  col_index: number;
  value: number;
}

export interface IssueReport {
  id: string;
  document_id: string;
  issue_type: string;
  defect_code: string | null;
  quantity: number | null;
  notes: string | null;
  photos: string[];
  created_by: string | null;
  created_at: string;
}

// Generic Database type stub for supabase-js generics.
// Using `any` keeps the codebase compiling without generated types.
export type Database = any;
