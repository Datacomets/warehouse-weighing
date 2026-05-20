import { describe, it, expect } from "vitest";
import { escapeCsvField, buildCsv } from "./exportCsv";

describe("escapeCsvField()", () => {
  it("returns empty string for null/undefined", () => {
    expect(escapeCsvField(null)).toBe("");
    expect(escapeCsvField(undefined)).toBe("");
  });

  it("passes through simple values without quoting", () => {
    expect(escapeCsvField("hello")).toBe("hello");
    expect(escapeCsvField(123)).toBe("123");
    expect(escapeCsvField(0)).toBe("0");
  });

  it("quotes fields containing commas", () => {
    expect(escapeCsvField("a,b")).toBe('"a,b"');
  });

  it("quotes fields containing double quotes and escapes them", () => {
    expect(escapeCsvField('she said "hi"')).toBe('"she said ""hi"""');
  });

  it("quotes fields containing CR/LF", () => {
    expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
    expect(escapeCsvField("line1\r\nline2")).toBe('"line1\r\nline2"');
  });

  it("passes Thai text through unchanged when no special chars", () => {
    expect(escapeCsvField("กำลังดำเนินการ")).toBe("กำลังดำเนินการ");
  });
});

describe("buildCsv()", () => {
  it("emits a UTF-8 BOM prefix so Excel reads Thai correctly", () => {
    const csv = buildCsv([], ["a"]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("emits header line + CRLF line endings", () => {
    const csv = buildCsv([{ a: 1, b: 2 }], ["a", "b"]);
    expect(csv).toBe("﻿a,b\r\n1,2");
  });

  it("respects header order even when row keys differ", () => {
    const csv = buildCsv([{ b: 2, a: 1 }], ["a", "b"]);
    expect(csv).toBe("﻿a,b\r\n1,2");
  });

  it("renders missing keys as empty cells", () => {
    const csv = buildCsv([{ a: 1 }], ["a", "b", "c"]);
    expect(csv).toBe("﻿a,b,c\r\n1,,");
  });

  it("escapes values containing the delimiter", () => {
    const csv = buildCsv([{ a: "x,y" }], ["a"]);
    expect(csv).toBe('﻿a\r\n"x,y"');
  });

  it("returns just the header line when rows is empty", () => {
    const csv = buildCsv([], ["a", "b"]);
    expect(csv).toBe("﻿a,b");
  });
});
