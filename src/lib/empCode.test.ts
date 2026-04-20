import { describe, it, expect } from "vitest";
import {
  normalizeEmpCode,
  isValidEmpCode,
  empCodeToEmail,
  emailToEmpCode,
  EMP_EMAIL_DOMAIN,
} from "./empCode";

describe("normalizeEmpCode", () => {
  it.each([
    ["emp001", "EMP001"],
    ["  emp001  ", "EMP001"],
    ["Emp-001", "EMP-001"],
  ])("normalizes %s -> %s", (input, expected) => {
    expect(normalizeEmpCode(input)).toBe(expected);
  });
});

describe("isValidEmpCode", () => {
  it.each(["EMP001", "E1", "EMP_001", "EMP-001", "12345"])(
    "accepts %s",
    (code) => {
      expect(isValidEmpCode(code)).toBe(true);
    }
  );

  it.each([
    "",
    "E",
    "emp001",
    "EMP 001",
    "EMP@001",
    "_EMP001",
    "-EMP001",
    "A".repeat(33),
  ])("rejects %s", (code) => {
    expect(isValidEmpCode(code)).toBe(false);
  });
});

describe("empCodeToEmail", () => {
  it("builds pseudo-email with domain", () => {
    expect(empCodeToEmail("EMP001")).toBe(`EMP001@${EMP_EMAIL_DOMAIN}`);
  });

  it("normalizes before building", () => {
    expect(empCodeToEmail("  emp001 ")).toBe(`EMP001@${EMP_EMAIL_DOMAIN}`);
  });
});

describe("emailToEmpCode", () => {
  it("extracts emp code from pseudo-email", () => {
    expect(emailToEmpCode(`EMP001@${EMP_EMAIL_DOMAIN}`)).toBe("EMP001");
  });

  it("returns null for non-pseudo emails", () => {
    expect(emailToEmpCode("real@example.com")).toBeNull();
  });
});
