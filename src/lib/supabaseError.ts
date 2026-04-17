/**
 * Translates a Supabase / Postgres / fetch error into a Thai message that is
 * friendly for warehouse operators. Unknown errors fall back to the original
 * message so nothing is hidden — we just provide a nicer top layer for common
 * cases.
 *
 * Input can be:
 *   - A Supabase `{ message, code?, details? }` object
 *   - A native Error
 *   - A plain string (already-extracted message)
 *   - null / undefined → generic fallback
 */

export interface SupabaseErrorLike {
  message?: string | null;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
}

export type ErrorInput =
  | SupabaseErrorLike
  | Error
  | string
  | null
  | undefined;

const GENERIC_FALLBACK = "เกิดข้อผิดพลาด กรุณาลองใหม่";

/**
 * Postgres SQLSTATE-based translations. These fire first because codes are
 * more stable than message text across versions.
 */
const CODE_MAP: Record<string, string> = {
  "23505": "ข้อมูลซ้ำ มีรายการนี้ในระบบแล้ว",
  "23503": "ลบ/แก้ไขไม่ได้ เพราะมีข้อมูลอื่นอ้างอิงอยู่",
  "23502": "กรุณากรอกข้อมูลให้ครบ",
  "23514": "ข้อมูลไม่ผ่านเงื่อนไขของระบบ",
  "42501": "ไม่มีสิทธิ์ดำเนินการนี้",
  "PGRST301": "ไม่มีสิทธิ์เข้าถึงข้อมูลนี้",
  "PGRST116": "ไม่พบข้อมูล",
};

/**
 * Pattern-based translations for when the error code is missing or generic.
 * Ordered — first match wins.
 */
const PATTERN_MAP: Array<[RegExp, string]> = [
  [/row-level security/i, "ไม่มีสิทธิ์ดำเนินการนี้"],
  [/duplicate key value/i, "ข้อมูลซ้ำ มีรายการนี้ในระบบแล้ว"],
  [/violates foreign key/i, "ลบ/แก้ไขไม่ได้ เพราะมีข้อมูลอื่นอ้างอิงอยู่"],
  [/violates not-null/i, "กรุณากรอกข้อมูลให้ครบ"],
  [/violates check constraint/i, "ข้อมูลไม่ผ่านเงื่อนไขของระบบ"],
  [/jwt expired/i, "เซสชันหมดอายุ — กรุณาเข้าสู่ระบบใหม่"],
  [/invalid (login|credentials)/i, "อีเมลหรือรหัสผ่านไม่ถูกต้อง"],
  [/email not confirmed/i, "ยังไม่ได้ยืนยันอีเมล"],
  [/rate limit/i, "ส่งคำขอบ่อยเกินไป กรุณารอสักครู่"],
  [/fetch.* failed|network.*error|networkerror/i, "เชื่อมต่อไม่ได้ ตรวจสอบอินเทอร์เน็ต"],
  [/timeout/i, "ใช้เวลานานเกินกำหนด — ลองใหม่อีกครั้ง"],
  [/payload too large|file too large/i, "ไฟล์ใหญ่เกินไป"],
  [/bucket.*not found/i, "ไม่พบที่เก็บไฟล์ — แจ้งผู้ดูแลระบบ"],
];

function extractBits(err: ErrorInput): { message: string; code?: string } {
  if (err == null) return { message: "" };
  if (typeof err === "string") return { message: err };
  if (err instanceof Error) return { message: err.message };
  const e = err as SupabaseErrorLike;
  return {
    message: e.message ?? "",
    code: e.code ?? undefined,
  };
}

export function translateSupabaseError(err: ErrorInput): string {
  const { message, code } = extractBits(err);

  if (code && CODE_MAP[code]) return CODE_MAP[code];

  if (message) {
    for (const [pattern, thai] of PATTERN_MAP) {
      if (pattern.test(message)) return thai;
    }
  }

  // Empty / unknown: fall back. We prefer original message when available so
  // developers can still debug issues surfaced in production.
  return message || GENERIC_FALLBACK;
}
