/**
 * Thai labels + formatting for the admin activity log (/logs).
 * Sources: audit_log (semantic events written by the app / RPCs) and
 * activity_log (row-level changes written by DB triggers, migration 0010).
 */

export const EVENT_LABEL: Record<string, string> = {
  create_doc: "สร้างเอกสาร",
  edit_header: "แก้ไขข้อมูลหลัก",
  edit_remainder: "แก้ไขจำนวนเศษ",
  edit_cartons_per_pallet: "แก้ไขลังต่อพาเลท",
  submit_work: "ส่งงาน",
  complete_sap: "นำเข้า SAP",
  unlock: "ปลดล็อกเพื่อแก้ไข",
  reopen_completed: "เปิดเอกสารใหม่ (post-SAP)",
  recall_submission: "ถอนส่งงาน",
  cancel_doc: "ยกเลิกใบงาน",
  restore_doc: "กู้คืนใบงาน",
  add_item_photo: "เพิ่มรูปสินค้า",
};

export const TABLE_LABEL: Record<string, string> = {
  gr_documents: "ใบงาน",
  weight_measurements: "ค่าน้ำหนัก",
  count_grid_entries: "ตารางชั่งต่อลัง",
  issue_reports: "รายการปัญหา",
  weight_photos: "รูปประกอบ",
  item_master: "ฐานข้อมูลสินค้า",
  profiles: "ผู้ใช้",
  doc_cancelers: "สิทธิ์ยกเลิกใบงาน",
};

export const OP_LABEL: Record<string, string> = { INSERT: "เพิ่ม", UPDATE: "แก้ไข", DELETE: "ลบ" };

export const STATUS_LABEL: Record<string, string> = {
  in_progress: "กำลังดำเนินการ",
  pending_sap: "รอนำเข้า SAP",
  completed: "เสร็จสมบูรณ์",
};

const KIND_LABEL: Record<string, string> = { per_pcs: "ชั่งต่อชิ้น", per_inner: "ชั่งต่อถุง/ถาด", per_carton: "ชั่งต่อลัง" };

export const FIELD_LABEL: Record<string, string> = {
  status: "สถานะ",
  lot: "LOT",
  po_number: "PO",
  item_code: "Item Code",
  description: "Description",
  supplier: "ชื่อ Supplier",
  delivery_date: "Delivery Date",
  scale_name: "เครื่องชั่ง",
  qty_per_carton: "ชิ้น/ลัง",
  width_cm: "กว้าง",
  length_cm: "ยาว",
  height_cm: "สูง",
  gross_weight: "Gross",
  net_weight: "Net",
  mfg_date: "MFG",
  exp_date: "EXP",
  lot_number: "Lot Number",
  qc_status: "QC",
  remarks: "หมายเหตุ",
  sap_inbound_id: "CFSD",
  sap_notification_id: "Notification ID",
  sap_attachment_url: "ไฟล์แนบ SAP",
  remainder_pcs: "เศษ (ชิ้น)",
  weight_unit: "หน่วย",
  cartons_per_pallet: "ลัง/พาเลท",
  skip_per_pcs: "ข้ามชั่งต่อชิ้น",
  skip_per_inner: "ข้ามชั่งต่อถุง",
  skip_per_carton: "ข้ามชั่งต่อลัง",
  skip_reason_per_pcs: "เหตุผลข้าม (ชิ้น)",
  skip_reason_per_inner: "เหตุผลข้าม (ถุง)",
  skip_reason_per_carton: "เหตุผลข้าม (ลัง)",
  unlock_reason: "เหตุผลปลดล็อก",
  cancelled_at: "ยกเลิกเมื่อ",
  cancel_reason: "เหตุผลยกเลิก",
  cancel_dup_wh: "ซ้ำกับ",
  cancel_note: "รายละเอียดยกเลิก",
  value: "ค่า",
  kind: "ประเภท",
  full_name: "ชื่อ",
  role: "บทบาท",
  active: "ใช้งาน",
  quantity: "จำนวน",
  issue_type: "ประเภทปัญหา",
  defect_code: "รหัสของเสีย",
  notes: "หมายเหตุ",
  product_category: "หมวด",
  obsolete: "Obsolete",
};

/** Fields never shown in the change list (internal ids / bookkeeping). */
const HIDDEN = new Set([
  "id", "document_id", "created_by", "submitted_by", "closed_by", "cancelled_by", "started_at", "ended_at",
  "submitted_at", "closed_at", "created_at", "updated_at", "per_100", "seq", "photos", "url", "user_id",
  "source_updated_at", "in_house_production", "purchased", "qty_per_inner", "actual_count",
]);

function show(v: unknown): string {
  if (v === null || v === undefined || v === "") return "–";
  if (typeof v === "boolean") return v ? "ใช่" : "ไม่";
  const s = String(v);
  return STATUS_LABEL[s] || KIND_LABEL[s] || s;
}

export interface ActivityRow {
  tbl: string;
  op: string;
  changes: Record<string, unknown> | null;
}

/** Short Thai headline, e.g. "ยกเลิกใบงาน", "แก้ไข ใบงาน", "เพิ่ม ค่าน้ำหนัก". */
export function activityTitle(r: ActivityRow): string {
  const c = r.changes || {};
  if (r.tbl === "gr_documents" && r.op === "UPDATE") {
    const ca = c["cancelled_at"] as unknown[] | undefined;
    if (Array.isArray(ca)) return ca[1] ? "ยกเลิกใบงาน" : "กู้คืนใบงาน";
    const st = c["status"] as unknown[] | undefined;
    if (Array.isArray(st)) {
      if (st[1] === "pending_sap") return "ส่งงาน";
      if (st[1] === "completed") return "นำเข้า SAP";
      if (st[1] === "in_progress") return "ปลดล็อก / ถอนส่งงาน";
    }
  }
  if (r.tbl === "gr_documents" && r.op === "INSERT") return "สร้างใบงาน";
  if (r.tbl === "gr_documents" && r.op === "DELETE") return "ลบใบงาน";
  return `${OP_LABEL[r.op] || r.op} ${TABLE_LABEL[r.tbl] || r.tbl}`;
}

/** Human-readable detail lines for one activity row. */
export function activityDetails(r: ActivityRow, max = 8): string[] {
  const c = r.changes || {};
  const out: string[] = [];
  if (r.op === "UPDATE") {
    for (const [k, pair] of Object.entries(c)) {
      if (HIDDEN.has(k) && k !== "cancelled_at") continue;
      if (k === "cancelled_at") continue; // shown by the title
      const [a, b] = Array.isArray(pair) ? pair : [undefined, pair];
      out.push(`${FIELD_LABEL[k] || k}: ${show(a)} → ${show(b)}`);
    }
  } else {
    if (r.tbl === "weight_measurements") out.push(`${show(c["kind"])} = ${show(c["value"])}`);
    else if (r.tbl === "count_grid_entries") out.push(`ลังที่ ${Number(c["row_index"] ?? 0) * 10 + Number(c["col_index"] ?? 0) + 1} = ${show(c["value"])}`);
    else if (r.tbl === "weight_photos") out.push(`รูป ${show(c["kind"] || "ทั่วไป")}`);
    else if (r.tbl === "doc_cancelers") out.push("สิทธิ์ยกเลิกใบงาน");
    else
      for (const [k, v] of Object.entries(c)) {
        if (HIDDEN.has(k) || k === "row_index" || k === "col_index" || v === null || v === "" || v === false) continue;
        out.push(`${FIELD_LABEL[k] || k}: ${show(v)}`);
      }
  }
  return out.slice(0, max);
}

/** Thai one-liner for an audit_log event detail. */
export function eventDetail(action: string, detail: Record<string, unknown> | null): string {
  const d = detail || {};
  const parts: string[] = [];
  if (action === "cancel_doc" || action === "restore_doc") {
    const reason = d["reason"] === "wrong_entry" ? "บันทึกผิด" : d["reason"] === "duplicate" ? `บันทึกซ้ำกับ ${d["dup_wh"] || "-"}` : d["reason"] === "other" ? "อื่น ๆ" : "";
    if (reason) parts.push(reason);
    if (d["note"]) parts.push(String(d["note"]));
  } else if (action === "add_item_photo") {
    if (d["item_code"]) parts.push(`สินค้า ${d["item_code"]}`);
  } else {
    if (Array.isArray(d["fields"])) parts.push((d["fields"] as string[]).map((f) => FIELD_LABEL[f] || f).join(", "));
    if (d["reason"]) parts.push(`เหตุผล: ${d["reason"]}`);
    if (d["sap_inbound_id"]) parts.push(`CFSD ${d["sap_inbound_id"]}`);
    if (d["cfsd"]) parts.push(`CFSD ${d["cfsd"]}`);
    if (d["value"] !== undefined && d["value"] !== null) parts.push(`→ ${d["value"]}`);
  }
  return parts.join(" · ");
}
