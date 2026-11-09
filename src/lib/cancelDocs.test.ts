import { describe, it, expect, vi } from "vitest";
import {
  validateCancelItem,
  cancelReasonText,
  isCancelableStatus,
  normalizeWh,
  cancelDocuments,
  type CancelItemInput,
} from "./cancelDocs";

const base: CancelItemInput = { id: "a", wh: "WH-2611-074", reason: "", dupWh: "", note: "" };
const none = new Set<string>();
const exists = (map: Record<string, boolean>) => (wh: string) => map[wh];

describe("isCancelableStatus()", () => {
  it("allows only documents not yet imported to SAP", () => {
    expect(isCancelableStatus("in_progress")).toBe(true);
    expect(isCancelableStatus("pending_sap")).toBe(true);
    expect(isCancelableStatus("completed")).toBe(false);
  });
});

describe("validateCancelItem()", () => {
  it("requires a reason", () => {
    expect(validateCancelItem(base, none, exists({}))).toBe("กรุณาเลือกเหตุผล");
  });
  it("accepts wrong_entry with or without detail", () => {
    expect(validateCancelItem({ ...base, reason: "wrong_entry" }, none, exists({}))).toBeNull();
    expect(validateCancelItem({ ...base, reason: "wrong_entry", note: "ผิดรหัส" }, none, exists({}))).toBeNull();
  });
  it("requires a note for 'other'", () => {
    expect(validateCancelItem({ ...base, reason: "other", note: "  " }, none, exists({}))).toBe("กรุณาระบุเหตุผล");
    expect(validateCancelItem({ ...base, reason: "other", note: "ตีกลับ" }, none, exists({}))).toBeNull();
  });
  it("limits note length", () => {
    expect(validateCancelItem({ ...base, reason: "other", note: "x".repeat(201) }, none, exists({}))).toMatch(/ยาวเกิน/);
  });
  describe("duplicate", () => {
    const dup = { ...base, reason: "duplicate" as const };
    it("requires the duplicate WH", () => {
      expect(validateCancelItem(dup, none, exists({}))).toBe("กรุณาระบุเลข WH ของใบที่ซ้ำ");
    });
    it("rejects its own WH (case/space-insensitive)", () => {
      expect(validateCancelItem({ ...dup, dupWh: " wh-2611-074 " }, none, exists({}))).toBe("ระบุเลขของใบงานนี้เองไม่ได้");
    });
    it("rejects a WH that is also being cancelled", () => {
      expect(validateCancelItem({ ...dup, dupWh: "WH-2611-070" }, new Set(["WH-2611-070"]), exists({}))).toMatch(/ถูกเลือกยกเลิกด้วย/);
    });
    it("reports pending / missing / found", () => {
      expect(validateCancelItem({ ...dup, dupWh: "WH-2611-073" }, none, exists({}))).toBe("กำลังตรวจสอบเลข WH...");
      expect(validateCancelItem({ ...dup, dupWh: "WH-2611-037" }, none, exists({ "WH-2611-037": false }))).toBe("ไม่พบใบงาน WH-2611-037 ในระบบ");
      expect(validateCancelItem({ ...dup, dupWh: "wh-2611-073" }, none, exists({ "WH-2611-073": true }))).toBeNull();
    });
  });
});

describe("cancelReasonText()", () => {
  it("formats each reason", () => {
    expect(cancelReasonText("wrong_entry")).toBe("บันทึกผิด");
    expect(cancelReasonText("wrong_entry", null, "ผิดรหัส")).toBe("บันทึกผิด — ผิดรหัส");
    expect(cancelReasonText("duplicate", "WH-2611-073")).toBe("บันทึกซ้ำกับ WH-2611-073");
    expect(cancelReasonText("other", null, "ตีกลับ")).toBe("อื่น ๆ — ตีกลับ");
    expect(cancelReasonText(null)).toBe("-");
  });
});

describe("normalizeWh()", () => {
  it("trims and upper-cases", () => expect(normalizeWh(" wh-2611-001 ")).toBe("WH-2611-001"));
});

describe("cancelDocuments()", () => {
  it("sends a normalized payload to the cancel_documents RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ id: "a", ok: true }], error: null });
    const res = await cancelDocuments({ rpc } as any, [
      { id: "a", wh: "WH-1", reason: "duplicate", dupWh: " wh-2 ", note: " " },
      { id: "b", wh: "WH-3", reason: "other", dupWh: "WH-9", note: " ตีกลับ " },
    ]);
    expect(rpc).toHaveBeenCalledWith("cancel_documents", {
      p_items: [
        { id: "a", reason: "duplicate", dup_wh: "WH-2", note: null },
        { id: "b", reason: "other", dup_wh: null, note: "ตีกลับ" },
      ],
    });
    expect(res).toEqual({ ok: true, results: [{ id: "a", ok: true }] });
  });
  it("returns the database error message", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "ไม่มีสิทธิ์ยกเลิกใบงาน" } });
    expect(await cancelDocuments({ rpc } as any, [])).toEqual({ ok: false, error: "ไม่มีสิทธิ์ยกเลิกใบงาน" });
  });
});
