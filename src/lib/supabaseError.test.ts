import { describe, it, expect } from "vitest";
import { translateSupabaseError } from "./supabaseError";

describe("translateSupabaseError() — SQLSTATE codes", () => {
  it.each([
    ["23505", "ข้อมูลซ้ำ มีรายการนี้ในระบบแล้ว"],
    ["23503", "ลบ/แก้ไขไม่ได้ เพราะมีข้อมูลอื่นอ้างอิงอยู่"],
    ["23502", "กรุณากรอกข้อมูลให้ครบ"],
    ["23514", "ข้อมูลไม่ผ่านเงื่อนไขของระบบ"],
    ["42501", "ไม่มีสิทธิ์ดำเนินการนี้"],
    ["PGRST301", "ไม่มีสิทธิ์เข้าถึงข้อมูลนี้"],
    ["PGRST116", "ไม่พบข้อมูล"],
  ])("maps code %s → Thai", (code, expected) => {
    expect(translateSupabaseError({ code, message: "some english error" })).toBe(expected);
  });

  it("code takes precedence over message (more reliable signal)", () => {
    // Message would match a different pattern, but code wins
    expect(
      translateSupabaseError({
        code: "23505",
        message: "row-level security policy violation",
      })
    ).toBe("ข้อมูลซ้ำ มีรายการนี้ในระบบแล้ว");
  });
});

describe("translateSupabaseError() — message patterns (no code)", () => {
  it.each([
    [`new row violates row-level security policy for table "gr_documents"`, "ไม่มีสิทธิ์ดำเนินการนี้"],
    [`duplicate key value violates unique constraint "gr_documents_wh_number_key"`, "ข้อมูลซ้ำ มีรายการนี้ในระบบแล้ว"],
    [`insert or update on table "x" violates foreign key constraint "y"`, "ลบ/แก้ไขไม่ได้ เพราะมีข้อมูลอื่นอ้างอิงอยู่"],
    [`null value in column "lot" violates not-null constraint`, "กรุณากรอกข้อมูลให้ครบ"],
    [`new row violates check constraint`, "ข้อมูลไม่ผ่านเงื่อนไขของระบบ"],
    ["JWT expired", "เซสชันหมดอายุ — กรุณาเข้าสู่ระบบใหม่"],
    ["Invalid login credentials", "อีเมลหรือรหัสผ่านไม่ถูกต้อง"],
    ["Email not confirmed", "ยังไม่ได้ยืนยันอีเมล"],
    ["rate limit exceeded", "ส่งคำขอบ่อยเกินไป กรุณารอสักครู่"],
    ["fetch failed", "เชื่อมต่อไม่ได้ ตรวจสอบอินเทอร์เน็ต"],
    ["NetworkError when attempting to fetch", "เชื่อมต่อไม่ได้ ตรวจสอบอินเทอร์เน็ต"],
    ["request timeout", "ใช้เวลานานเกินกำหนด — ลองใหม่อีกครั้ง"],
    ["payload too large", "ไฟล์ใหญ่เกินไป"],
    [`Bucket "sap-attachments" not found`, "ไม่พบที่เก็บไฟล์ — แจ้งผู้ดูแลระบบ"],
  ])("translates %s", (msg, expected) => {
    expect(translateSupabaseError({ message: msg })).toBe(expected);
  });

  it("case-insensitive matching", () => {
    expect(translateSupabaseError("ROW-LEVEL SECURITY policy")).toBe("ไม่มีสิทธิ์ดำเนินการนี้");
  });
});

describe("translateSupabaseError() — input shapes", () => {
  it("accepts a plain string message", () => {
    expect(translateSupabaseError("duplicate key value")).toBe("ข้อมูลซ้ำ มีรายการนี้ในระบบแล้ว");
  });

  it("accepts an Error instance", () => {
    expect(translateSupabaseError(new Error("JWT expired"))).toBe(
      "เซสชันหมดอายุ — กรุณาเข้าสู่ระบบใหม่"
    );
  });

  it("accepts a Supabase error object with code", () => {
    expect(translateSupabaseError({ code: "23505", message: "" })).toBe(
      "ข้อมูลซ้ำ มีรายการนี้ในระบบแล้ว"
    );
  });

  it("handles null → generic fallback", () => {
    expect(translateSupabaseError(null)).toBe("เกิดข้อผิดพลาด กรุณาลองใหม่");
  });

  it("handles undefined → generic fallback", () => {
    expect(translateSupabaseError(undefined)).toBe("เกิดข้อผิดพลาด กรุณาลองใหม่");
  });

  it("handles empty object → generic fallback", () => {
    expect(translateSupabaseError({})).toBe("เกิดข้อผิดพลาด กรุณาลองใหม่");
  });
});

describe("translateSupabaseError() — unknown errors", () => {
  it("returns the original message when no pattern matches (so devs can still debug)", () => {
    const msg = "Some unexpected Postgres error that isn't in our map";
    expect(translateSupabaseError(msg)).toBe(msg);
  });

  it("returns generic fallback when input has no message and no code", () => {
    expect(translateSupabaseError({ details: "only details, no message" })).toBe(
      "เกิดข้อผิดพลาด กรุณาลองใหม่"
    );
  });
});
