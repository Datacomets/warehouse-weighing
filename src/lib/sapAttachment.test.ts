import { describe, it, expect } from "vitest";
import {
  validateSapEntry,
  SAP_ATTACHMENT_MAX_SIZE,
  SAP_ATTACHMENT_ALLOWED_TYPES,
} from "./sapAttachment";

describe("validateSapEntry()", () => {
  it("returns null when CFSD is provided and no file is attached", () => {
    expect(validateSapEntry({ cfsd: "CFSD-8634" })).toBeNull();
  });

  it("returns null for CFSD + valid file", () => {
    const file = { type: "application/pdf", size: 1024 * 1024 };
    expect(validateSapEntry({ cfsd: "CFSD-8634", file })).toBeNull();
  });

  describe("CFSD", () => {
    it("rejects empty string", () => {
      expect(validateSapEntry({ cfsd: "" })).toBe("กรุณากรอกเลข CFSD");
    });

    it("rejects whitespace-only string", () => {
      expect(validateSapEntry({ cfsd: "   " })).toBe("กรุณากรอกเลข CFSD");
    });

    it("accepts CFSD with surrounding whitespace (trimmed)", () => {
      expect(validateSapEntry({ cfsd: "  CFSD-8634  " })).toBeNull();
    });
  });

  describe("file type", () => {
    it.each(SAP_ATTACHMENT_ALLOWED_TYPES)("accepts %s", (type) => {
      expect(validateSapEntry({ cfsd: "CFSD-1", file: { type, size: 100 } })).toBeNull();
    });

    it.each([
      "application/msword",
      "text/plain",
      "image/gif",
      "image/svg+xml",
      "application/zip",
      "",
    ])("rejects %s", (type) => {
      expect(validateSapEntry({ cfsd: "CFSD-1", file: { type, size: 100 } })).toBe(
        "ไฟล์ต้องเป็น PDF หรือรูปภาพ (JPEG, PNG, WEBP) เท่านั้น"
      );
    });
  });

  describe("file size", () => {
    it("accepts files at exactly the 20 MB limit", () => {
      expect(
        validateSapEntry({
          cfsd: "CFSD-1",
          file: { type: "application/pdf", size: SAP_ATTACHMENT_MAX_SIZE },
        })
      ).toBeNull();
    });

    it("rejects files 1 byte over the limit", () => {
      expect(
        validateSapEntry({
          cfsd: "CFSD-1",
          file: { type: "application/pdf", size: SAP_ATTACHMENT_MAX_SIZE + 1 },
        })
      ).toBe("ไฟล์ใหญ่เกิน 20 MB");
    });
  });

  describe("skipped when no file", () => {
    it("ignores file checks when file is null", () => {
      expect(validateSapEntry({ cfsd: "CFSD-1", file: null })).toBeNull();
    });

    it("ignores file checks when file is undefined", () => {
      expect(validateSapEntry({ cfsd: "CFSD-1", file: undefined })).toBeNull();
    });
  });

  describe("ordering", () => {
    it("reports CFSD-missing before file-invalid", () => {
      const err = validateSapEntry({
        cfsd: "",
        file: { type: "text/plain", size: 999_999_999 },
      });
      expect(err).toBe("กรุณากรอกเลข CFSD");
    });

    it("reports invalid type before invalid size", () => {
      const err = validateSapEntry({
        cfsd: "CFSD-1",
        file: { type: "text/plain", size: SAP_ATTACHMENT_MAX_SIZE + 1 },
      });
      expect(err).toContain("PDF");
    });
  });
});
