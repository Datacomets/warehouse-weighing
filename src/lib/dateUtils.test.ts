import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { startOfDayTH, endOfDayTH } from "./dateUtils";

const TH_OFFSET_MS = 7 * 60 * 60 * 1000;

function setNow(iso: string) {
  vi.setSystemTime(new Date(iso));
}

describe("startOfDayTH()", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 00:00 Thai-time for a midday UTC moment", () => {
    // 2026-04-16 05:30 UTC = 2026-04-16 12:30 Thai → start of Thai day = 2026-04-15T17:00:00Z
    setNow("2026-04-16T05:30:00Z");
    expect(startOfDayTH().toISOString()).toBe("2026-04-15T17:00:00.000Z");
  });

  it("returns the same Thai day when UTC time is just past Thai midnight", () => {
    // 2026-04-15 17:00 UTC = 2026-04-16 00:00 Thai → start of Thai day = 2026-04-15T17:00:00Z
    setNow("2026-04-15T17:00:00Z");
    expect(startOfDayTH().toISOString()).toBe("2026-04-15T17:00:00.000Z");
  });

  it("returns previous Thai day when UTC time is just before Thai midnight", () => {
    // 2026-04-15 16:59 UTC = 2026-04-15 23:59 Thai → start of Thai day = 2026-04-14T17:00:00Z
    setNow("2026-04-15T16:59:00Z");
    expect(startOfDayTH().toISOString()).toBe("2026-04-14T17:00:00.000Z");
  });

  it("handles month boundary (Thai time rolls over at UTC 17:00)", () => {
    // 2026-04-30 17:00 UTC = 2026-05-01 00:00 Thai
    setNow("2026-04-30T17:00:00Z");
    expect(startOfDayTH().toISOString()).toBe("2026-04-30T17:00:00.000Z");
    // 2026-04-30 16:59 UTC = 2026-04-30 23:59 Thai
    setNow("2026-04-30T16:59:00Z");
    expect(startOfDayTH().toISOString()).toBe("2026-04-29T17:00:00.000Z");
  });

  it("handles year boundary", () => {
    // 2026-12-31 17:00 UTC = 2027-01-01 00:00 Thai
    setNow("2026-12-31T17:00:00Z");
    expect(startOfDayTH().toISOString()).toBe("2026-12-31T17:00:00.000Z");
  });

  it("result always lies exactly on a Thai-midnight boundary (multiple of 24h + TH offset)", () => {
    setNow("2026-04-16T05:30:00Z");
    const start = startOfDayTH();
    const thLocalMs = start.getTime() + TH_OFFSET_MS;
    // Should be a midnight in Thai-local: divides evenly by a day
    expect(thLocalMs % (24 * 60 * 60 * 1000)).toBe(0);
  });
});

describe("endOfDayTH()", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is exactly 24 hours after startOfDayTH", () => {
    setNow("2026-04-16T05:30:00Z");
    const diff = endOfDayTH().getTime() - startOfDayTH().getTime();
    expect(diff).toBe(24 * 60 * 60 * 1000);
  });

  it("returns next Thai day at 00:00", () => {
    setNow("2026-04-16T05:30:00Z");
    // Start of Thai 2026-04-16 = 2026-04-15T17:00Z; end = 2026-04-16T17:00Z
    expect(endOfDayTH().toISOString()).toBe("2026-04-16T17:00:00.000Z");
  });

  it("startOfDayTH() < now() < endOfDayTH() — sanity window contains current instant", () => {
    setNow("2026-04-16T05:30:00Z");
    const now = Date.now();
    expect(startOfDayTH().getTime()).toBeLessThanOrEqual(now);
    expect(endOfDayTH().getTime()).toBeGreaterThan(now);
  });
});
