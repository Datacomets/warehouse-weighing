import { describe, it, expect } from "vitest";
import { activityTitle, activityDetails, eventDetail } from "./activityLog";

describe("activityTitle()", () => {
  it("recognises cancel / restore / status transitions on gr_documents", () => {
    expect(activityTitle({ tbl: "gr_documents", op: "UPDATE", changes: { cancelled_at: [null, "2026-11-09"] } })).toBe("ยกเลิกใบงาน");
    expect(activityTitle({ tbl: "gr_documents", op: "UPDATE", changes: { cancelled_at: ["2026-11-09", null] } })).toBe("กู้คืนใบงาน");
    expect(activityTitle({ tbl: "gr_documents", op: "UPDATE", changes: { status: ["in_progress", "pending_sap"] } })).toBe("ส่งงาน");
    expect(activityTitle({ tbl: "gr_documents", op: "UPDATE", changes: { status: ["pending_sap", "completed"] } })).toBe("นำเข้า SAP");
    expect(activityTitle({ tbl: "gr_documents", op: "INSERT", changes: {} })).toBe("สร้างใบงาน");
  });
  it("falls back to operation + table label", () => {
    expect(activityTitle({ tbl: "weight_measurements", op: "DELETE", changes: {} })).toBe("ลบ ค่าน้ำหนัก");
    expect(activityTitle({ tbl: "gr_documents", op: "UPDATE", changes: { lot: ["A", "B"] } })).toBe("แก้ไข ใบงาน");
  });
});

describe("activityDetails()", () => {
  it("lists changed fields with Thai labels and hides bookkeeping fields", () => {
    expect(
      activityDetails({ tbl: "gr_documents", op: "UPDATE", changes: { lot: ["A", "B"], status: ["in_progress", "pending_sap"], submitted_at: [null, "x"] } })
    ).toEqual(["LOT: A → B", "สถานะ: กำลังดำเนินการ → รอนำเข้า SAP"]);
  });
  it("summarises inserted weights, grid cells and photos", () => {
    expect(activityDetails({ tbl: "weight_measurements", op: "INSERT", changes: { kind: "per_pcs", value: 0.01 } })).toEqual(["ชั่งต่อชิ้น = 0.01"]);
    expect(activityDetails({ tbl: "count_grid_entries", op: "DELETE", changes: { row_index: 1, col_index: 2, value: 4.7 } })).toEqual(["ลังที่ 13 = 4.7"]);
  });
  it("shows key fields of other inserted rows", () => {
    expect(activityDetails({ tbl: "profiles", op: "INSERT", changes: { id: "x", full_name: "Team Data", role: "admin", active: true } })).toEqual([
      "ชื่อ: Team Data",
      "บทบาท: admin",
      "ใช้งาน: ใช่",
    ]);
  });
});

describe("eventDetail()", () => {
  it("formats cancel reasons", () => {
    expect(eventDetail("cancel_doc", { reason: "duplicate", dup_wh: "WH-2611-073" })).toBe("บันทึกซ้ำกับ WH-2611-073");
    expect(eventDetail("cancel_doc", { reason: "other", note: "ตีกลับ" })).toBe("อื่น ๆ · ตีกลับ");
  });
  it("formats edited header fields", () => {
    expect(eventDetail("edit_header", { fields: ["lot", "po_number"] })).toBe("LOT, PO");
  });
  it("formats item photo events", () => {
    expect(eventDetail("add_item_photo", { item_code: "1110001" })).toBe("สินค้า 1110001");
  });
});
