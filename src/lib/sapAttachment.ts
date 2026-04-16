export const SAP_ATTACHMENT_MAX_SIZE = 20 * 1024 * 1024; // 20 MB
export const SAP_ATTACHMENT_ALLOWED_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

export interface SapEntryInput {
  /** CFSD (SAP Inbound Delivery ID) — required, trimmed before check. */
  cfsd: string;
  /** Optional file to attach. Undefined/null means no file was picked. */
  file?: { type: string; size: number } | null;
}

/** Returns a Thai error message, or `null` if the SAP entry payload is valid. */
export function validateSapEntry(input: SapEntryInput): string | null {
  if (!input.cfsd || !input.cfsd.trim()) {
    return "กรุณากรอกเลข CFSD";
  }
  if (input.file) {
    if (!SAP_ATTACHMENT_ALLOWED_TYPES.includes(input.file.type)) {
      return "ไฟล์ต้องเป็น PDF หรือรูปภาพ (JPEG, PNG, WEBP) เท่านั้น";
    }
    if (input.file.size > SAP_ATTACHMENT_MAX_SIZE) {
      return "ไฟล์ใหญ่เกิน 20 MB";
    }
  }
  return null;
}
