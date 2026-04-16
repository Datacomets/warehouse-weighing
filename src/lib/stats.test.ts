import { describe, it, expect } from "vitest";
import { stats, fmt, fmtDate, fmtDateTime, leadTimeMinutes, leadTimeText } from "./stats";

describe("stats()", () => {
  it("computes avg / min / max / count for positive integers", () => {
    expect(stats([1, 2, 3, 4, 5])).toEqual({ avg: 3, min: 1, max: 5, count: 5 });
  });

  it("returns zeros for empty array", () => {
    expect(stats([])).toEqual({ avg: 0, min: 0, max: 0, count: 0 });
  });

  it("handles single-value input", () => {
    expect(stats([42])).toEqual({ avg: 42, min: 42, max: 42, count: 1 });
  });

  it("filters out NaN and Infinity (only finite values counted)", () => {
    const result = stats([1, NaN, 2, Infinity, -Infinity, 3]);
    expect(result).toEqual({ avg: 2, min: 1, max: 3, count: 3 });
  });

  it("returns zeros when all values are non-finite", () => {
    expect(stats([NaN, Infinity, -Infinity])).toEqual({
      avg: 0,
      min: 0,
      max: 0,
      count: 0,
    });
  });

  it("handles decimals (weight scale values)", () => {
    const result = stats([0.123, 0.125, 0.124]);
    expect(result.avg).toBeCloseTo(0.124, 3);
    expect(result.min).toBe(0.123);
    expect(result.max).toBe(0.125);
    expect(result.count).toBe(3);
  });

  it("handles negative values", () => {
    expect(stats([-5, 0, 5])).toEqual({ avg: 0, min: -5, max: 5, count: 3 });
  });
});

describe("fmt()", () => {
  it("formats number with default 3 decimals", () => {
    expect(fmt(1.23456)).toBe("1.235");
  });

  it("respects custom digits", () => {
    expect(fmt(1.23456, 1)).toBe("1.2");
    expect(fmt(1.23456, 5)).toBe("1.23456");
  });

  it("pads trailing zeros", () => {
    expect(fmt(1)).toBe("1.000");
  });

  it("adds thousand separators (en-US locale)", () => {
    expect(fmt(1234567.89, 2)).toBe("1,234,567.89");
  });

  it("returns '-' for non-finite", () => {
    expect(fmt(NaN)).toBe("-");
    expect(fmt(Infinity)).toBe("-");
  });
});

describe("fmtDate()", () => {
  it("returns '-' for null/undefined/empty", () => {
    expect(fmtDate(null)).toBe("-");
    expect(fmtDate(undefined)).toBe("-");
    expect(fmtDate("")).toBe("-");
  });

  it("returns original string for unparseable date", () => {
    expect(fmtDate("not-a-date")).toBe("not-a-date");
  });

  it("formats valid ISO date to Thai locale dd/mm/yyyy style", () => {
    const result = fmtDate("2026-04-16T00:00:00Z");
    // Thai locale uses Buddhist year; exact output varies by runtime ICU,
    // so we just verify format shape (dd/mm/yyyy-ish).
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });
});

describe("fmtDateTime()", () => {
  it("returns '-' for null/undefined", () => {
    expect(fmtDateTime(null)).toBe("-");
    expect(fmtDateTime(undefined)).toBe("-");
  });

  it("returns original string for unparseable input", () => {
    expect(fmtDateTime("garbage")).toBe("garbage");
  });

  it("formats valid ISO date to Thai locale with time", () => {
    const result = fmtDateTime("2026-04-16T10:30:00Z");
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(result).toMatch(/\d{2}:\d{2}/);
  });
});

describe("leadTimeMinutes()", () => {
  it("rounds diff in minutes", () => {
    expect(leadTimeMinutes("2026-04-16T10:00:00Z", "2026-04-16T10:30:00Z")).toBe(30);
  });

  it("returns 0 for same timestamp", () => {
    const t = "2026-04-16T10:00:00Z";
    expect(leadTimeMinutes(t, t)).toBe(0);
  });

  it("rounds sub-minute to nearest minute", () => {
    // 29.5s → rounds to 0 (< 30s), 30s → rounds to 1
    expect(leadTimeMinutes("2026-04-16T10:00:00Z", "2026-04-16T10:00:29Z")).toBe(0);
    expect(leadTimeMinutes("2026-04-16T10:00:00Z", "2026-04-16T10:00:30Z")).toBe(1);
  });

  it("returns negative if end before start", () => {
    expect(leadTimeMinutes("2026-04-16T10:30:00Z", "2026-04-16T10:00:00Z")).toBe(-30);
  });
});

describe("leadTimeText()", () => {
  it("returns '-' when either timestamp is null", () => {
    expect(leadTimeText(null, "2026-04-16T10:00:00Z")).toBe("-");
    expect(leadTimeText("2026-04-16T10:00:00Z", null)).toBe("-");
    expect(leadTimeText(null, null)).toBe("-");
  });

  it("formats sub-hour as 'X นาที'", () => {
    expect(leadTimeText("2026-04-16T10:00:00Z", "2026-04-16T10:45:00Z")).toBe("45 นาที");
  });

  it("formats hour-plus as 'H ชม. MM นาที'", () => {
    expect(leadTimeText("2026-04-16T10:00:00Z", "2026-04-16T12:30:00Z")).toBe("2 ชม. 30 นาที");
  });

  it("formats exact hours as 'H ชม. 0 นาที'", () => {
    expect(leadTimeText("2026-04-16T10:00:00Z", "2026-04-16T11:00:00Z")).toBe("1 ชม. 0 นาที");
  });

  it("formats 59 minutes as 'นาที' (not 'ชม.')", () => {
    expect(leadTimeText("2026-04-16T10:00:00Z", "2026-04-16T10:59:00Z")).toBe("59 นาที");
  });
});
